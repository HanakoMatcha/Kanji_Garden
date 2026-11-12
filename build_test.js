import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

const URL_VOCAB = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPaoyAEqHNS1o3bsskqc1jwBABpBXGqvxP5c1hA4zBtpgQbWv7dd0pLZqrmo72MtB8H--ppoiYYhDD/pub?gid=0&single=true&output=csv";
const URL_KANJI = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPaoyAEqHNS1o3bsskqc1jwBABpBXGqvxP5c1hA4zBtpgQbWv7dd0pLZqrmo72MtB8H--ppoiYYhDD/pub?gid=2092672219&single=true&output=csv";
const URL_GRAMATICA = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQOWZ3YGAYOMWOzphDzwDscyI032508NemgrNRv_T09EVWIgo4KIcVPX85ALjFcV_SVoXYwuep9qFz0/pub?output=csv";
const ASSETS_REPO = "HanakoMatcha/kanjium-assets";
const ASSETS_CDN = `https://cdn.jsdelivr.net/gh/${ASSETS_REPO}@main`;
const SIN_JLPT = "Sin nivel JLPT";

const ETIQUETAS_IMG = {
  origin: "Origen",
  tensho: "Tenshō (sello pequeño)",
  gyosho: "Gyōsho (semicursiva)",
  sousho: "Sōsho (cursiva)",
  kso_images: "KSO",
};

const TIPOS_GRAMATICA_ES = {
  Adverb: "Adverbio",
  "Compound Particle": "Partícula compuesta",
  "Noun / Nominalizer": "Sustantivo / Nominalizador",
  "Suffix / Prefix": "Sufijo / Prefijo",
  Keigo: "Keigo (敬語)",
  Expression: "Expresión",
  "Verb Form": "Forma verbal",
  Conjunction: "Conjunción",
  Particle: "Partícula",
  "Auxiliary Verb": "Verbo auxiliar",
};

const ORDEN_IMG = ["origin", "tensho", "gyosho", "sousho", "kso_images"];
const CONTENT_DIR = "./content";
// JSON con todas las entradas de cada catálogo filtrable; el workflow lo copia a public/static/catalogos.
const CATALOGOS_DIR = "./catalogos";

["vocab", "kanji", "componentes", "colecciones", "gramatica"].forEach((dir) => {
  const p = path.join(CONTENT_DIR, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

function escribirSiCambio(ruta, contenidoNuevo) {
  if (fs.existsSync(ruta)) {
    const contenidoViejo = fs.readFileSync(ruta, "utf8");
    if (contenidoViejo === contenidoNuevo) return;
  }
  fs.writeFileSync(ruta, contenidoNuevo);
}

function nombreSeguro(s) {
  return String(s).normalize("NFC").replace(/[\/\\?%*:|"<>#&\s]/g, "_");
}

function yamlStr(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function extraerKanjis(texto) {
  if (!texto) return [];
  const regex = /[一-龯㐀-䶿\u{20000}-\u{2A6DF}]/gu;
  return Array.from(new Set(texto.match(regex) || []));
}

function filtrarComponentesValidos(texto) {
  if (!texto) return [];
  const regex = /[⺀-⿕㐀-䶿一-鿿豈-﫿\u{20000}-\u{2EBEF}]/gu;
  return Array.from(new Set(texto.match(regex) || []));
}

function etiquetaJlpt(valor) {
  if (!valor || valor === SIN_JLPT) return "";
  const s = String(valor)
    .toLowerCase()
    .replace(/^jlpt[\s-_]*/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s ? `jlpt-${s}` : "";
}

function getValor(row, posiblesNombres) {
  const lista = Array.isArray(posiblesNombres) ? posiblesNombres : [posiblesNombres];
  const clavesFila = Object.keys(row);
  for (const nombre of lista) {
    const target = nombre.trim().toLowerCase();
    const claveEncontrada = clavesFila.find(
      (k) => k.replace(/^\uFEFF/, "").trim().toLowerCase() === target
    );
    if (claveEncontrada && row[claveEncontrada] !== undefined && row[claveEncontrada] !== null) {
      const val = String(row[claveEncontrada]).trim();
      if (val !== "") return val;
    }
  }
  return "";
}

function escaparHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Restos del scraping de la hoja: "飽 く" (furigana eliminado), "end ." o "( to the end )".
function limpiarTextoGramatica(s) {
  return String(s ?? "")
    .replace(/([一-龯々㐀-䶿])[ \t]+(?=[\u3040-\u309f])/gu, "$1")
    .replace(/[ \t]+([.,!?;:)])/g, "$1")
    .replace(/\([ \t]+/g, "(")
    .replace(/[ \t]{2,}/g, " ");
}

// Texto de la hoja -> Markdown seguro: evita que ~ (tachado GFM), $ (LaTeX), * _ [ ] ` |
// o etiquetas HTML sueltas se interpreten como formato.
function escaparMd(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([\\`*_\[\]~$|#])/g, "\\$1");
}

function slugSimple(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function esVerdadero(val) {
  const s = String(val).trim().toLowerCase();
  return s === "1" || s === "true" || s === "sí" || s === "si";
}

// Códigos de idioma de Wiktionary → nombre. La tabla vive en idiomas_wiktionary.json:
//  - nombres / familias: lenguas y familias frecuentes (nombres en inglés, como en Wiktionary)
//  - iso: tabla ISO 639-3/639-1 completa (nombres en inglés) como respaldo
const TABLA_IDIOMAS = JSON.parse(
  fs.readFileSync(new URL("./idiomas_wiktionary.json", import.meta.url), "utf8")
);

// Palabras inglesas que también son códigos ISO: nunca se tratan como idioma
const PALABRAS_NO_IDIOMA = new Set(`a an the of to in on at by as is it be or and for but not no so do if up us we he me my
are was has had may can see one two six ten how who why way out use due its his her she him our you any all few new old own
per via too yet now off far end act add age ago aid aim air arm art ask bad bag bar bat bed big bit box boy bus buy car cat
cow cry cup cut day did die dig dog dry ear eat egg eye fan fat fee fit fix fly fog fun gas get god got gun guy hat hit hot
ice ill job joy key kid lab law lay led leg let lie lip lot low mad man map mid mix mud net nor nut odd oil ore pan pay pen
pet pie pig pit pot put rat raw red rid rim rod row rub run sad sat saw say sea set sew shy sin sir sit ski sky son spy
sum sun tag tan tap tax tea tie tin tip toe ton top toy try tub van war wax web wet win wit won yes zoo et al ca cf vs pp ad
bc ce ie eg ok oh ah ha hi om tv pc id`.split(/\s+/));

// Lenguas de la entrada: en "zh sit-pro *naq" el primer código es la lengua
// de la entrada (Wiktionary no la muestra) y el segundo la lengua de origen.
const LENGUAS_ENTRADA = new Set(["zh", "ja", "ko", "vi", "yue", "cmn", "nan", "och", "ltc", "lzh", "okm", "ojp"]);
// Palabras tras las que un código conocido se lee como idioma
const CONTEXTO_IDIOMA = new Set(["from", "compare", "cf.", "cognate", "with", "and", "or", "of", "also", "see", "like", "whence", "vs."]);

function nombreProto(base) {
  const n = TABLA_IDIOMAS.familias[base] || TABLA_IDIOMAS.nombres[base];
  const nombre = n || TABLA_IDIOMAS.iso[base];
  return nombre ? `Proto-${nombre}` : null;
}

// Devuelve el nombre del idioma o null si el código no se conoce
function nombreIdioma(codigo) {
  const { nombres, familias, iso } = TABLA_IDIOMAS;
  if (nombres[codigo]) return nombres[codigo];
  if (familias[codigo]) return familias[codigo];
  if (codigo.endsWith("-pro")) return nombreProto(codigo.slice(0, -4));
  return iso[codigo] || null;
}

// ¿Es un código frecuente de la tabla (no solo del respaldo ISO)?
function esIdiomaConocido(codigo) {
  const { nombres, familias } = TABLA_IDIOMAS;
  if (codigo.endsWith("-pro")) {
    const base = codigo.slice(0, -4);
    return Boolean(familias[base] || nombres[base]);
  }
  return Boolean(nombres[codigo] || familias[codigo]);
}

// Plantillas que solo son de mantenimiento o maquetación: se descartan
const PLANTILLAS_DESCARTABLES = /^(rfe|rfv-etym|attention|wp|wikipedia|top\d?|mid\d?|bottom|multiple images|zh-see|ja-see|ja-kanjitab|picdic\w*|cln|c|C|tlb|lb|defdate|nb\.\.\.)$/i;
// Plantillas cuyos argumentos son "lengua destino | lengua origen | forma | alt | glosa"
const PLANTILLAS_ORIGEN = /^(inh|inh\+|der|der\+|bor|bor\+|lbor|slbor|cal|calque|sl|semantic loan|uder|ubor|noncog|ncog)$/i;
// Plantillas "lengua | forma | alt | glosa" que muestran el nombre de la lengua
const PLANTILLAS_COGNADO = /^(cog|cognate|m\+)$/i;
// Igual, pero Wiktionary solo muestra la forma (sin nombre de lengua)
const PLANTILLAS_MENCION = /^(m|mention|l|link|ll)$/i;

// Convierte una plantilla de Wiktionary en texto legible en vez de borrarla
function renderPlantillaWiktionary(cuerpo) {
  const partes = cuerpo.split("|").map((p) => p.trim());
  const nombre = partes.shift() || "";
  if (PLANTILLAS_DESCARTABLES.test(nombre)) return "";

  const posicionales = [];
  const nombrados = {};
  for (const p of partes) {
    const m = p.match(/^([\w-]+)=(.*)$/);
    if (m) nombrados[m[1]] = m[2].trim();
    else posicionales.push(p);
  }

  const forma = (lengua, palabra, alt, glosa) => {
    const glosaFinal = glosa || nombrados.t || nombrados.gloss || "";
    const tr = nombrados.tr ? ` (${nombrados.tr})` : "";
    return [
      lengua ? (nombreIdioma(lengua) ? marcarNombre(nombreIdioma(lengua)) : lengua) : "",
      (alt || (palabra === "-" ? "" : palabra) || "") + tr,
      glosaFinal ? `«${glosaFinal}»` : "",
    ].filter(Boolean).join(" ");
  };

  if (PLANTILLAS_ORIGEN.test(nombre)) {
    const [, origen, palabra, alt, glosa] = posicionales;
    return forma(origen, palabra, alt, glosa);
  }
  if (PLANTILLAS_COGNADO.test(nombre)) {
    const [lengua, palabra, alt, glosa] = posicionales;
    return forma(lengua, palabra, alt, glosa);
  }
  if (PLANTILLAS_MENCION.test(nombre)) {
    const [, palabra, alt, glosa] = posicionales;
    return forma("", palabra, alt, glosa);
  }

  // Plantilla desconocida: conservar sus argumentos visibles
  return posicionales
    .filter(Boolean)
    .map((p) => (esIdiomaConocido(p) ? marcarNombre(nombreIdioma(p)) : p))
    .join(" ");
}

const TOKEN_CODIGO = "[a-z]{2,3}(?:-[a-z]{2,5}){0,2}";

// Los nombres ya traducidos se envuelven en marcadores para que no se vuelvan
// a leer como códigos ("min del sur" → "del" no es Delaware)
const marcarNombre = (n) => `\u0001${n}\u0002`;
const quitarMarcas = (t) => t.replace(/[\u0001\u0002]/g, "");

// Traduce los códigos de idioma sueltos en el texto ya aplanado de Wiktionary.
// Solo se traduce cuando el contexto indica que es un idioma, para no tocar
// palabras inglesas que coinciden con códigos ISO ("to", "may", "sit"...).
function traducirCodigosIdioma(texto) {
  const re = new RegExp(`(?<![\\p{L}\\p{N}_*'’.-])(${TOKEN_CODIGO})(?![\\p{L}\\p{N}_'’=-])`, "gu");
  const reSiguiente = new RegExp(`^\\s+(${TOKEN_CODIGO})(?![\\p{L}\\p{N}_'’-])`, "u");
  const protegidos = [];
  texto = texto.replace(/\u0001[^\u0002]*\u0002/g, (t) => `\u0003${protegidos.push(t) - 1}\u0004`);
  let salida = "";
  let ultimo = 0;
  let m;

  while ((m = re.exec(texto))) {
    const codigo = m[1];
    const inicio = m.index;
    let fin = inicio + codigo.length;
    let reemplazo = null;

    // Cadena "lengua de entrada + lengua de origen": se queda solo la de origen
    const siguienteCodigo = texto.slice(fin).match(reSiguiente);
    const origen = siguienteCodigo && siguienteCodigo[1];
    // También "tbq-blg sit-pro": un código con guion desconocido seguido de otro
    const esLenguaEntrada =
      LENGUAS_ENTRADA.has(codigo) || (codigo.includes("-") && !nombreIdioma(codigo));
    if (
      esLenguaEntrada &&
      origen &&
      nombreIdioma(origen) &&
      // "sit", "map", "tai"... son palabras inglesas pero tras "zh" son familias
      (!PALABRAS_NO_IDIOMA.has(origen) || TABLA_IDIOMAS.familias[origen])
    ) {
      reemplazo = nombreIdioma(siguienteCodigo[1]);
      fin += siguienteCodigo[0].length;
    } else {
      reemplazo = decidirCodigoSuelto(codigo, texto.slice(0, inicio), texto.slice(fin));
    }

    if (reemplazo) {
      // "Old Chinese - /*ni[t]-s/": el guion es una forma vacía de la plantilla
      const formaVacia = texto.slice(fin).match(/^[ \t]+-(?=[ \t])/);
      if (formaVacia) fin += formaVacia[0].length;
      salida += texto.slice(ultimo, inicio) + reemplazo;
      ultimo = fin;
    }
    re.lastIndex = fin;
  }
  return (salida + texto.slice(ultimo)).replace(/\u0003(\d+)\u0004/g, (_, i) => protegidos[i]);
}

function decidirCodigoSuelto(codigo, antes, despues) {
  const nombre = nombreIdioma(codigo);
  if (!nombre) return null;

  const siguiente = (despues.match(/^\s+(\S+)/) || [])[1] || "";
  const anterior = (antes.match(/(\S+)\s*$/) || [])[1] || "";
  const inicioSegmento = /(^|\|)\s*$/.test(antes);
  const siguePalabra = /^\s+[\p{L}\p{N}*]/u.test(despues);
  const trasSeparador = /[,;]$/.test(anterior) && siguePalabra;
  const terminaEnPuntuacion = /^[.,;:)]/.test(despues) || despues.trim() === "";
  // Extranjero = lleva letras/números no ASCII (no basta con ⟩ o comillas tipográficas)
  const siguienteExtranjero =
    siguiente && (/(?![\x00-\x7F])[\p{L}\p{M}\p{N}]/u.test(siguiente) || /^[*-]/.test(siguiente));
  // Romanizaciones coreanas ("리 li 金寳"): no son códigos
  const trasHangul = /\p{Script=Hangul}/u.test(anterior);

  if (PALABRAS_NO_IDIOMA.has(codigo)) {
    // "my" es birmano solo si va seguido de escritura birmana u otra no latina (no china)
    return codigo === "my" && siguienteExtranjero && !/\p{Script=Han}/u.test(siguiente) ? nombre : null;
  }
  if (codigo.includes("-")) return nombre;
  if (siguienteExtranjero && !(trasHangul && !esIdiomaConocido(codigo))) return nombre;

  // A partir de aquí solo códigos frecuentes de la tabla (no familias sueltas,
  // que coinciden con palabras como "map", "sit" o "tai")
  const esFamiliaSuelta = TABLA_IDIOMAS.familias[codigo] && !TABLA_IDIOMAS.nombres[codigo];
  if (!esIdiomaConocido(codigo) || esFamiliaSuelta) return null;
  if ((CONTEXTO_IDIOMA.has(anterior.toLowerCase()) && siguePalabra) || trasSeparador || inicioSegmento) return nombre;
  if (terminaEnPuntuacion && LENGUAS_ENTRADA.has(codigo)) return nombre;
  return null;
}

function limpiarEtimologiaWiktionary(raw) {
  if (!raw) return "Sin datos registrados.";
  let texto = raw
    .replace(/\[\[(?:[^|{}]*\|)*([^\]]+)\]\]/g, "$1")
    .replace(/\{\{([^{}]*)\}\}/g, (_, cuerpo) => renderPlantillaWiktionary(cuerpo));

  // Resúmenes de etimón: "zh :inh sit-pro:*ku(w)" → "Heredado de Proto-Sino-Tibetan *ku(w)"
  texto = texto.replace(
    new RegExp(`(?:(?<![\\w-])(?:${TOKEN_CODIGO})\\s+)?:(inh|der|bor|cal|uder|ubor)\\s+((?:${TOKEN_CODIGO}:\\S+\\s*)+)`, "g"),
    (todo, tipo, pares) => {
      const VERBOS = { inh: "Heredado de", der: "Derivado de", uder: "Derivado de", bor: "Préstamo de", ubor: "Préstamo de", cal: "Calco de" };
      const partes = pares.trim().split(/\s+/).map((par) => {
        const [codigo, ...resto] = par.split(":");
        const nombre = nombreIdioma(codigo);
        return nombre ? `${marcarNombre(nombre)} ${resto.join(":")}` : null;
      });
      if (partes.some((x) => !x)) return todo;
      return `${VERBOS[tipo]} ${partes.join(", ")} `;
    }
  );

  // Leyendas de imagen: "thumb|zh 女性 |" → "Ilustración (Chinese): 女性 |"
  texto = texto.replace(/(?:thumb|left|right)\|([^|]+)\|/gi, (_, leyenda) => {
    const m = leyenda.trim().match(new RegExp(`^(${TOKEN_CODIGO})\\s+(.+)$`));
    return m && esIdiomaConocido(m[1])
      ? `Ilustración (${marcarNombre(nombreIdioma(m[1]))}): ${m[2].trim()} |`
      : `Ilustración: ${leyenda.trim()} |`;
  });

  // Lista de idiomas al inicio de un segmento: "zh:,yue: |" → "Lenguas: Chinese, Cantonese |"
  texto = texto.replace(
    new RegExp(`(^|\\|)\\s*((?:${TOKEN_CODIGO}:\\s*,?\\s*)+)(?=\\||$)`, "g"),
    (todo, inicio, lista) => {
      const codigos = lista.split(/[:,\s]+/).filter(Boolean);
      if (!codigos.every(esIdiomaConocido)) return todo;
      return `${inicio} Lenguas: ${codigos.map((c) => marcarNombre(nombreIdioma(c))).join(", ")} `;
    }
  );

  // Etiquetas sueltas "zh: texto" → "Chinese: texto"
  texto = texto.replace(
    new RegExp(`(?<![\\w-])(${TOKEN_CODIGO}):`, "g"),
    (todo, c) => (esIdiomaConocido(c) && !PALABRAS_NO_IDIOMA.has(c) ? `${marcarNombre(nombreIdioma(c))}:` : todo)
  );

  texto = quitarMarcas(traducirCodigosIdioma(texto));

  texto = texto
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s*\|\s*\*\s*/g, "\n\n- ")
    .replace(/\s*\|\s*/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \t]*-[ \t]*/gm, "- ")
    .trim();
  return texto || "Sin datos registrados.";
}

function renderBarraPaginacion(numPagina, totalPaginas, rutaBase) {
  const anteriorHref = numPagina === 1
    ? ""
    : (numPagina === 2 ? `${rutaBase}/` : `${rutaBase}/pagina-${numPagina - 1}`);
  const siguienteHref = numPagina < totalPaginas
    ? `${rutaBase}/pagina-${numPagina + 1}`
    : "";

  const enlaceAnterior = numPagina === 1
    ? `<span class="btn-nav-desactivado">← Anterior</span>`
    : `<a href="${anteriorHref}" class="btn-nav-catalogo">← Anterior</a>`;

  const enlaceSiguiente = numPagina < totalPaginas
    ? `<a href="${siguienteHref}" class="btn-nav-catalogo">Siguiente →</a>`
    : `<span class="btn-nav-desactivado">Siguiente →</span>`;

  let opciones = "";
  for (let p = 1; p <= totalPaginas; p++) {
    const valorOpcion = p === 1 ? `${rutaBase}/` : `${rutaBase}/pagina-${p}`;
    const selected = p === numPagina ? "selected" : "";
    opciones += `<option value="${valorOpcion}" ${selected}>Página ${p} de ${totalPaginas}</option>`;
  }

  return `
<div class="barra-paginacion-catalogo">
  <div style="min-width: 100px; text-align: left;">${enlaceAnterior}</div>
  <div class="selector-pagina-wrapper">
    <select class="selector-pagina-dropdown" onchange="const b = window.location.pathname.startsWith('/Kanji_Garden') ? '/Kanji_Garden' : ''; window.location.href = b + this.value;">
      ${opciones}
    </select>
  </div>
  <div style="min-width: 100px; text-align: right;">${enlaceSiguiente}</div>
</div>`;
}

// gruposExtra: [{ etiqueta, opciones: [{ filtro, texto }] }] para chips adicionales (p. ej. tipo gramatical).
// Solo genera el panel: la lógica vive en catalogo.js (inyectado por el workflow), que filtra
// sobre el catálogo completo (static/catalogos/<id>.json) y no solo sobre la página actual.
function renderFiltrosCatalogo(incluirTaxonomia = true, gruposExtra = []) {
  const htmlGruposExtra = gruposExtra
    .map(
      (g) => `
  <div class="grupo-filtro-chips">
    <span class="etiqueta-filtro-chip">${escaparHtml(g.etiqueta)}:</span>
    ${g.opciones
      .map((o) => `<button type="button" class="btn-chip-filtro" data-filtro="${escaparHtml(o.filtro)}">${escaparHtml(o.texto)}</button>`)
      .join("\n    ")}
  </div>`
    )
    .join("");
  return `
<div class="contenedor-filtros-catalogo">
  <div class="grupo-filtro-chips">
    <span class="etiqueta-filtro-chip">JLPT:</span>
    <button type="button" class="btn-chip-filtro" data-filtro="jlpt-n5">N5</button>
    <button type="button" class="btn-chip-filtro" data-filtro="jlpt-n4">N4</button>
    <button type="button" class="btn-chip-filtro" data-filtro="jlpt-n3">N3</button>
    <button type="button" class="btn-chip-filtro" data-filtro="jlpt-n2">N2</button>
    <button type="button" class="btn-chip-filtro" data-filtro="jlpt-n1">N1</button>
    <button type="button" class="btn-chip-reset" id="btn-limpiar-chips">Limpiar</button>
  </div>
  ${
    incluirTaxonomia
      ? `
  <div class="grupo-filtro-chips">
    <span class="etiqueta-filtro-chip">Taxonomía:</span>
    <button type="button" class="btn-chip-filtro" data-filtro="joyo">Jōyō</button>
    <button type="button" class="btn-chip-filtro" data-filtro="jinmeiyo">Jinmeiyō</button>
    <button type="button" class="btn-chip-filtro" data-filtro="hyougaiji">Hyougaiji</button>
    <button type="button" class="btn-chip-filtro" data-filtro="kyuujitai">Kyūjitai</button>
  </div>`
      : ""
  }${htmlGruposExtra}
</div>
`;
}

// Contenedor semántico puro: el script global se encargará de HanziWriter
function seccionPracticadorKanji(caracter) {
  return `
## Práctica de trazo
<div class="kanji-quiz-container" data-kanji="${caracter}" style="display: flex; flex-direction: column; align-items: center; gap: 12px; margin: 1.5rem 0; padding: 1.2rem; background: rgba(0,0,0,0.03); border: 1px solid var(--lightgray); border-radius: 8px;">
  <div class="kanji-writer-target" style="border: 2px solid var(--gray); border-radius: 8px; box-shadow: inset 0 0 10px rgba(0,0,0,0.04); position: relative; width: 180px; height: 180px;"></div>

  <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;">
    <button type="button" class="btn-quiz-start" style="padding: 6px 14px; border-radius: 4px; border: 1px solid var(--secondary); background: var(--secondary); color: var(--light); cursor: pointer; font-size: 0.85rem; font-weight: bold;">Trazar</button>
    <button type="button" class="btn-quiz-animate" style="padding: 6px 14px; border-radius: 4px; border: 1px solid var(--gray); background: transparent; color: var(--dark); cursor: pointer; font-size: 0.85rem;">Ver orden</button>
    <button type="button" class="btn-quiz-reset" style="padding: 6px 14px; border-radius: 4px; border: 1px solid var(--gray); background: transparent; color: var(--dark); cursor: pointer; font-size: 0.85rem;">Limpiar</button>
  </div>
</div>
`;
}

const indiceImagenes = new Map();
async function cargarIndiceImagenes() {
  try {
    const headers = {
      "User-Agent": "kanji-garden-build",
      Accept: "application/vnd.github+json",
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const res = await fetch(
      `https://api.github.com/repos/${ASSETS_REPO}/git/trees/main?recursive=1`,
      { headers }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    for (const item of data.tree || []) {
      if (item.type !== "blob") continue;
      const partes = item.path.split("/");
      if (partes[0] !== "images" || partes.length < 3) continue;
      const carpeta = partes[1];
      const archivo = partes[partes.length - 1];
      const m = archivo.match(/^(.+)\.(png|jpg|jpeg|webp|svg)$/i);
      if (!m) continue;
      const stem = m[1];
      let clave = null;
      const num = stem.match(/^(\d+)/);
      if (num) clave = num[1];
      else if (Array.from(stem).length === 1) clave = String(stem.codePointAt(0));
      if (!clave) continue;
      if (!indiceImagenes.has(clave)) indiceImagenes.set(clave, []);
      indiceImagenes.get(clave).push({ carpeta, archivo, ruta: item.path });
    }
  } catch (err) {
    console.warn("No se pudo cargar el índice de imágenes:", err.message);
  }
}

function seccionImagenes(caracter) {
  const lista = indiceImagenes.get(String(caracter.codePointAt(0)));
  if (!lista || lista.length === 0) return "";
  const porCarpeta = new Map();
  for (const it of lista) {
    if (!porCarpeta.has(it.carpeta)) porCarpeta.set(it.carpeta, []);
    porCarpeta.get(it.carpeta).push(it);
  }
  const carpetas = Array.from(porCarpeta.keys()).sort((a, b) => {
    const ia = ORDEN_IMG.indexOf(a);
    const ib = ORDEN_IMG.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
  let md = "\n## Escritura\n";
  for (const carpeta of carpetas) {
    const etiqueta = ETIQUETAS_IMG[carpeta] || carpeta;
    const esOrigen = carpeta === "origin";
    const claseTipo = esOrigen ? "img-origen" : "img-estilo";
    const items = porCarpeta.get(carpeta).sort((a, b) => a.archivo.localeCompare(b.archivo));
    const imgs = items.map((it) => {
      const url = `${ASSETS_CDN}/${it.ruta.split("/").map(encodeURIComponent).join("/")}`;
      return `<img src="${url}" alt="${caracter} ${etiqueta}" class="${claseTipo}" loading="lazy" />`;
    });
    md += `\n### ${etiqueta}\n<div class="contenedor-imagenes ${esOrigen ? "contenedor-origen" : "contenedor-estilos"}">\n${imgs.join("\n")}\n</div>\n`;
  }
  return md;
}

function generarCatalogoPaginado({
  directorioDestino,
  rutaBase,
  tituloCatalogo,
  items,
  porPagina = 50,
  renderItemMarkdown,
  filtrosHtml = "",
  tipoGrid = "grid-catalogo-general",
}) {
  if (!fs.existsSync(directorioDestino)) {
    fs.mkdirSync(directorioDestino, { recursive: true });
  }
  const totalPaginas = Math.ceil(items.length / porPagina) || 1;

  // Catálogo con filtros: se exporta el universo completo para que los chips filtren
  // todas las entradas y paginen los resultados, no solo las 50 de la página abierta.
  if (filtrosHtml) {
    const idCatalogo = rutaBase.replace(/^\/+|\/+$/g, "").replace(/\//g, "__");
    if (!fs.existsSync(CATALOGOS_DIR)) fs.mkdirSync(CATALOGOS_DIR, { recursive: true });
    const datos = {
      porPagina,
      items: items.map((it) => {
        const html = renderItemMarkdown(it);
        const tags = (html.match(/data-tags="([^"]*)"/) || [])[1] || "";
        return [tags, html];
      }),
    };
    escribirSiCambio(path.join(CATALOGOS_DIR, `${idCatalogo}.json`), JSON.stringify(datos));
    filtrosHtml = filtrosHtml.replace(
      '<div class="contenedor-filtros-catalogo">',
      `<div class="contenedor-filtros-catalogo" data-catalogo="${idCatalogo}" data-por-pagina="${porPagina}">`
    );
  }

  for (let i = 0; i < totalPaginas; i++) {
    const numPagina = i + 1;
    const inicio = i * porPagina;
    const lote = items.slice(inicio, inicio + porPagina);
    const navBar = renderBarraPaginacion(numPagina, totalPaginas, rutaBase);

    const itemsMarkdown = lote.map((it) => renderItemMarkdown(it)).join("\n");

    // Wikilinks CON carpeta (sin "/" inicial, igual que los enlaces a componentes de las
    // fichas). Sin carpeta, Quartz ("shortest") no puede resolver nombres que existen en
    // varias carpetas (日 está en kanji/, componentes/ y vocab/) y el nodo desaparece del grafo.
    const enlacesOcultosGrafo = lote
      .map((it) => {
        if (it.enlaceGrafo) return it.enlaceGrafo;
        const id = it.kanji || it.comp || it.palabra;
        const sub = it.kanji ? "kanji" : it.comp ? "componentes" : "vocab";
        return `[[${sub}/${nombreSeguro(id)}|${id}]]`;
      })
      .join(" ");

    const contenidoIndice = `---
title: "${tituloCatalogo} (Pág. ${numPagina})"
showTitle: false
showDate: false
showReadingTime: false
showToc: false
enableFolderListing: false
---
# ${tituloCatalogo}
<p class="resumen-catalogo">Mostrando <strong>${lote.length}</strong> de <strong>${items.length}</strong> entradas registradas.</p>
${filtrosHtml}
${navBar}

<div class="${tipoGrid}">
${itemsMarkdown}
</div>

${navBar}

<div class="seccion-oculta-grafo">
${enlacesOcultosGrafo}
</div>
`;
    const nombreArchivo = numPagina === 1 ? "index.md" : `pagina-${numPagina}.md`;
    escribirSiCambio(path.join(directorioDestino, nombreArchivo), contenidoIndice);
  }
}

async function main() {
  await cargarIndiceImagenes();

  // 1. Kanjis
  console.log("Descargando y procesando kanjis...");
  const resKanji = await fetch(URL_KANJI);
  const textKanji = await resKanji.text();
  const kanjiRecords = parse(textKanji, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  });

  const mapaSignificados = new Map();
  kanjiRecords.forEach((row) => {
    const k = getValor(row, ["Kanji", "Character"]);
    const s = getValor(row, ["Significado", "Meaning"]);
    if (k && s) mapaSignificados.set(k, s);
  });

  const componentesGlobales = new Set();
  const listaKanjisCatalogo = [];
  const colecciones = {
    joyo: [],
    jinmeiyo: [],
    kyuujitai: [],
    hyougaiji: [],
    "jlpt-n5": [],
    "jlpt-n4": [],
    "jlpt-n3": [],
    "jlpt-n2": [],
    "jlpt-n1": [],
  };

  kanjiRecords.forEach((row) => {
    const kanji = getValor(row, ["Kanji", "Character"]);
    if (!kanji) return;

    const onyomi = getValor(row, ["Onyomi", "On'yomi", "音読み"]);
    const kunyomi = getValor(row, ["Kunyomi", "Kun'yomi", "訓読み"]);
    const significado = getValor(row, ["Significado", "Meaning"]);
    const componentesRaw = getValor(row, ["Componentes Reales (Completos)", "Componentes Reales", "Componentes"]);
    const kyujitaiAntiguo = getValor(row, ["Kyujitai (Kanji Antiguo)", "Kyujitai"]);
    const etimologiaRaw = getValor(row, ["Etimología", "Etimologia", "Etymology"]);
    const etimologia = limpiarEtimologiaWiktionary(etimologiaRaw);
    const esKyujitai = esVerdadero(getValor(row, ["Kyūjitai (旧字体)", "Kyujitai (旧字体)", "Kyujitai"]));
    const esHyougaiji = esVerdadero(getValor(row, ["Hyōgaiji (表外字)", "Hyougaiji (表外字)", "Hyogaiji", "Hyougaiji"]));
    const esJoyo = esVerdadero(getValor(row, ["Jōyō Kanji (常用漢字)", "Joyo Kanji (常用漢字)", "Joyo", "Jōyō"]));
    const esJinmeiyo = esVerdadero(getValor(row, ["Jinmeiyō Kanji (人名用漢字)", "Jinmeiyo Kanji (人名用漢字)", "Jinmeiyo", "Jinmeiyō"]));
    const jlptKanji = getValor(row, ["JLPT"]);

    const tags = ["kanji"];
    if (esJoyo) tags.push("joyo");
    if (esJinmeiyo) tags.push("jinmeiyo");
    if (esHyougaiji) tags.push("hyougaiji");
    if (esKyujitai) tags.push("kyuujitai");
    const tagJlpt = etiquetaJlpt(jlptKanji);
    if (tagJlpt) tags.push(tagJlpt);

    const itemData = {
      kanji,
      significado,
      onyomi,
      kunyomi,
      tags: tags.join(" "),
    };

    listaKanjisCatalogo.push(itemData);
    if (esJoyo) colecciones.joyo.push(itemData);
    if (esJinmeiyo) colecciones.jinmeiyo.push(itemData);
    if (esKyujitai) colecciones.kyuujitai.push(itemData);
    if (esHyougaiji) colecciones.hyougaiji.push(itemData);
    if (tagJlpt && colecciones[tagJlpt]) colecciones[tagJlpt].push(itemData);

    const listaClasificacion = [];
    if (esJoyo) listaClasificacion.push("Jōyō (常用漢字)");
    if (esJinmeiyo) listaClasificacion.push("Jinmeiyō (人名用漢字)");
    if (esHyougaiji) listaClasificacion.push("Hyōgaiji (表外字)");
    if (esKyujitai) listaClasificacion.push("Kyūjitai (旧字体)");
    const textoClasificacion = listaClasificacion.length > 0 ? listaClasificacion.join(" · ") : "Sin clasificar";

    const comps = filtrarComponentesValidos(componentesRaw);
    comps.forEach((c) => componentesGlobales.add(c));
    const compsLinks = comps.length > 0
      ? comps.map((c) => `[[componentes/${nombreSeguro(c)}|${c}]]`).join(", ")
      : "Ninguno";

    const kyujitaiLink = kyujitaiAntiguo
      ? `[[kanji/${nombreSeguro(kyujitaiAntiguo)}|${kyujitaiAntiguo}]]`
      : "—";

    const md = `---
title: "${yamlStr(kanji)}"
tipo: kanji
onyomi: "${yamlStr(onyomi)}"
kunyomi: "${yamlStr(kunyomi)}"
jlpt: "${yamlStr(jlptKanji || SIN_JLPT)}"
tags:
${tags.map((t) => `  - ${t}`).join("\n")}
---
# ${kanji}
> **${significado}**

**Clasificación:** ${textoClasificacion}
${jlptKanji && jlptKanji !== SIN_JLPT ? `**JLPT:** ${jlptKanji}\n` : ""}**On:** ${onyomi || "—"}
**Kun:** ${kunyomi || "—"}
**Kyūjitai:** ${kyujitaiLink}
**Componentes:** ${compsLinks}

---

## Etimología
${etimologia}

${seccionPracticadorKanji(kanji)}
${seccionImagenes(kanji)}`;

    escribirSiCambio(path.join(CONTENT_DIR, "kanji", `${nombreSeguro(kanji)}.md`), md);
  });

  // Catálogo Kanji
  generarCatalogoPaginado({
    directorioDestino: path.join(CONTENT_DIR, "kanji"),
    rutaBase: "/kanji",
    tituloCatalogo: "Catálogo de Kanjis",
    items: listaKanjisCatalogo,
    tipoGrid: "grid-catalogo-kanjis",
    renderItemMarkdown: (it) =>
      `<a href="/kanji/${nombreSeguro(it.kanji)}" class="card-catalogo-item" data-tags="${it.tags}"><div class="glifo-item-kanji">${it.kanji}</div></a>`,
    filtrosHtml: renderFiltrosCatalogo(true),
  });

  // 2. Componentes / Radicales
  console.log("Procesando componentes...");
  const catalogoComponentes = Array.from(componentesGlobales).map((comp) => {
    const significadoComp = mapaSignificados.get(comp) || "Componente estructural / radical";
    const md = `---
title: "${yamlStr(comp)}"
tipo: componente
tags:
  - radical
---
# Componente: ${comp}
> **${significadoComp}**

Revisa los backlinks o el gráfico para ver los kanjis que contienen este componente.
${seccionImagenes(comp)}`;
    escribirSiCambio(path.join(CONTENT_DIR, "componentes", `${nombreSeguro(comp)}.md`), md);
    return { comp, significado: significadoComp };
  });

  generarCatalogoPaginado({
    directorioDestino: path.join(CONTENT_DIR, "componentes"),
    rutaBase: "/componentes",
    tituloCatalogo: "Catálogo de Radicales y Componentes",
    items: catalogoComponentes,
    tipoGrid: "grid-catalogo-kanjis",
    renderItemMarkdown: (it) =>
      `<a href="/componentes/${nombreSeguro(it.comp)}" class="card-catalogo-item"><div class="glifo-item-kanji">${it.comp}</div></a>`,
  });

  // 3. Vocabulario
  console.log("Descargando y procesando vocabulario...");
  const resVocab = await fetch(URL_VOCAB);
  const textVocab = await resVocab.text();
  const vocabRecords = parse(textVocab, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  });

  const listaVocabCatalogo = [];
  vocabRecords.forEach((row) => {
    const palabra = getValor(row, ["日本語", "Palabra", "Vocabulario"]);
    if (!palabra) return;

    const kana = getValor(row, ["かな", "Kana"]);
    const en = getValor(row, ["English", "Inglés", "Ingles"]);
    const es = getValor(row, ["Español", "Espanol"]);
    const tradChinese = getValor(row, ["Traditional Chinese", "繁體中文"]);
    const simpChinese = getValor(row, ["Simplified Chinese", "简体中文"]);
    const pinyin = getValor(row, ["Pinyin"]);
    const fr = getValor(row, ["Français", "Francais", "French"]);
    const de = getValor(row, ["Deutsche", "Deutsch", "German"]);
    const jlpt = getValor(row, ["JLPT"]) || SIN_JLPT;
    const jlptTag = etiquetaJlpt(jlpt);

    const tagsVocab = ["vocabulario"];
    if (jlptTag) tagsVocab.push(jlptTag);

    const itemVocab = {
      palabra,
      kana,
      es,
      en,
      fr,
      de,
      tradChinese,
      simpChinese,
      pinyin,
      jlpt,
      tags: tagsVocab.join(" "),
    };
    listaVocabCatalogo.push(itemVocab);

    const kanjis = extraerKanjis(palabra);
    const kanjiLinks = kanjis.length > 0
      ? kanjis.map((k) => `[[kanji/${nombreSeguro(k)}|${k}]]`).join(", ")
      : "Kana puro";

    const lineasTraducciones = [
      es ? `> **ES:** ${es}` : null,
      en ? `> **EN:** ${en}` : null,
      fr ? `> **FR:** ${fr}` : null,
      de ? `> **DE:** ${de}` : null,
      tradChinese ? `> **繁體:** ${tradChinese}` : null,
      simpChinese ? `> **简体:** ${simpChinese}` : null,
      pinyin ? `> **Pinyin:** ${pinyin}` : null,
    ].filter(Boolean);

    const bloqueTraducciones = lineasTraducciones.length > 0 ? lineasTraducciones.join("  \n") : "> —";
    const encabezadoTitulo = kana ? `# ${palabra} (${kana})` : `# ${palabra}`;

    const md = `---
title: "${yamlStr(palabra)}"
kana: "${yamlStr(kana)}"
jlpt: "${yamlStr(jlpt)}"
tipo: vocabulario
tags:
  - vocabulario${jlptTag ? `\n  - ${jlptTag}` : ""}
---
${encabezadoTitulo}
${bloqueTraducciones}

**Kanjis:** ${kanjiLinks}
**JLPT:** ${jlpt}
`;
    escribirSiCambio(path.join(CONTENT_DIR, "vocab", `${nombreSeguro(palabra)}.md`), md);
  });

  generarCatalogoPaginado({
    directorioDestino: path.join(CONTENT_DIR, "vocab"),
    rutaBase: "/vocab",
    tituloCatalogo: "Catálogo de Vocabulario",
    items: listaVocabCatalogo,
    tipoGrid: "grid-catalogo-vocab",
    renderItemMarkdown: (it) => {
      const partesIdiomas = [
        it.en ? `EN: ${it.en}` : null,
        it.fr ? `FR: ${it.fr}` : null,
        it.de ? `DE: ${it.de}` : null,
        it.tradChinese ? `繁: ${it.tradChinese}` : null,
        it.simpChinese ? `简: ${it.simpChinese}` : null,
        it.pinyin ? `Pin: ${it.pinyin}` : null,
      ].filter(Boolean);
      const glosa = partesIdiomas.length > 0
        ? `<div class="glosa-multilingue">${partesIdiomas.join(" · ")}</div>`
        : "";
      return `<a href="/vocab/${nombreSeguro(it.palabra)}" class="card-catalogo-vocab" data-tags="${it.tags}"><div class="cabecera-card-vocab"><span class="palabra-card-vocab">${it.palabra}</span><span class="kana-card-vocab">${it.kana || ""}</span></div><div class="traduccion-es-card">${it.es || it.en || "—"}</div>${glosa}</a>`;
    },
    filtrosHtml: renderFiltrosCatalogo(false),
  });

  // 4. Gramática
  // Un fallo en la hoja de gramática no debe tumbar el resto del jardín.
  console.log("Descargando y procesando gramática...");
  const listaGramaticaCatalogo = [];
  const coleccionesGramatica = {
    "jlpt-n5": [],
    "jlpt-n4": [],
    "jlpt-n3": [],
    "jlpt-n2": [],
    "jlpt-n1": [],
  };
  const tiposGramaticaVistos = new Map();
  try {
    const resGram = await fetch(URL_GRAMATICA);
    if (!resGram.ok) throw new Error(`HTTP ${resGram.status}`);
    const gramRecords = parse(await resGram.text(), {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
      relax_column_count: true,
    });

    const kanjisExistentes = new Set(listaKanjisCatalogo.map((it) => it.kanji));
    const vocabExistente = new Set(listaVocabCatalogo.map((it) => it.palabra));
    const slugsUsados = new Map();

    gramRecords.forEach((row) => {
      const puntoRaw = getValor(row, ["Grammar point", "Gramática", "Gramatica", "Punto gramatical"]);
      const lectura = getValor(row, ["Reading", "Lectura", "かな", "Kana"]);
      const jlpt = getValor(row, ["JLPT Level", "JLPT", "Nivel"]) || SIN_JLPT;
      const tipoEn = getValor(row, ["Type", "Tipo"]);
      const significado = limpiarTextoGramatica(getValor(row, ["Meaning", "Significado"]));
      const explicacion = limpiarTextoGramatica(getValor(row, ["Explanation", "Explicación", "Explicacion"]));
      const ejemplosRaw = limpiarTextoGramatica(getValor(row, ["Examples", "Ejemplos"]));
      if (!puntoRaw && !significado) return;

      // La hoja trae restos de scraping: "ことだし()", "とあって...(", "風に~", o solo "()".
      const punto = puntoRaw
        .replace(/[（(][\s\-]*[)）]/g, "")
        .replace(/[\s.…~〜'（(]+$/u, "")
        .replace(/^[\s~〜]+/u, "")
        .trim();
      // Coma que no esté dentro de un paréntesis: "The 'one' that... (Indefinite pronoun, Adjective…)".
      const significadoCorto = significado.split(/,(?![^(]*\))/)[0].trim();
      const nombreVisible = punto || `「${significadoCorto}」`;
      // La columna Reading a veces contiene una categoría ("Adjective", "Verb[て]") en lugar de kana.
      const lecturaEsKana = /[぀-ヿ]/u.test(lectura) && !/[A-Za-z]/.test(lectura) && lectura !== punto;

      let base = punto
        ? nombreSeguro(punto.replace(/[\[\]()（）]/g, ""))
        : `punto-${slugSimple(significadoCorto).slice(0, 40)}`;
      // No pisar los índices del catálogo (index.md, pagina-N.md).
      if (!base || base === "index" || /^pagina-\d+$/.test(base)) base = `punto-${base || "gramatical"}`;
      const n = (slugsUsados.get(base) || 0) + 1;
      slugsUsados.set(base, n);
      const slug = n === 1 ? base : `${base}-${n}`;

      const jlptTag = etiquetaJlpt(jlpt);
      const tipoTag = tipoEn ? `gtipo-${slugSimple(tipoEn)}` : "";
      if (tipoEn && !tiposGramaticaVistos.has(tipoTag)) tiposGramaticaVistos.set(tipoTag, tipoEn);
      const tipoEs = TIPOS_GRAMATICA_ES[tipoEn] || tipoEn;

      const tags = ["gramatica"];
      if (jlptTag) tags.push(jlptTag);
      if (tipoTag) tags.push(tipoTag);

      const aliasSeguro = (s) => String(s).replace(/[\[\]|]/g, "");
      const item = {
        slug,
        nombre: nombreVisible,
        lectura: lecturaEsKana ? lectura : "",
        significado,
        jlpt,
        tipoEs,
        tags: tags.join(" "),
        enlaceGrafo: `[[gramatica/${slug}|${aliasSeguro(nombreVisible)}]]`,
      };
      listaGramaticaCatalogo.push(item);
      if (jlptTag && coleccionesGramatica[jlptTag]) coleccionesGramatica[jlptTag].push(item);

      // Conexiones con el resto del jardín (solo a páginas que existen, para no crear nodos fantasma).
      const kanjis = extraerKanjis(punto).filter((k) => kanjisExistentes.has(k));
      const kanjiLinks = kanjis.length > 0
        ? kanjis.map((k) => `[[kanji/${nombreSeguro(k)}|${k}]]`).join(", ")
        : "—";
      const vocabRelacionado = [punto, lecturaEsKana ? lectura : ""]
        .flatMap((s) => s.split(/[・／/]/))
        .map((s) => s.trim())
        .filter((s) => s && vocabExistente.has(s));
      const vocabLinks = Array.from(new Set(vocabRelacionado))
        .map((v) => `[[vocab/${nombreSeguro(v)}|${aliasSeguro(v)}]]`)
        .join(", ");

      // Ejemplos: bloques separados por línea en blanco; 1.ª línea japonés, resto traducción.
      const ejemplos = ejemplosRaw
        .split(/\n\s*\n/)
        .map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean))
        .filter((lineas) => lineas.length > 0)
        .map((lineas) => {
          const ja = escaparHtml(lineas[0]);
          const tr = escaparHtml(lineas.slice(1).join(" "));
          return `<div class="ejemplo-gramatica"><div class="ejemplo-ja" lang="ja">${ja}</div>${tr ? `<div class="ejemplo-tr">${tr}</div>` : ""}</div>`;
        });

      const encabezado = item.lectura ? `# ${escaparMd(nombreVisible)} (${escaparMd(item.lectura)})` : `# ${escaparMd(nombreVisible)}`;
      const md = `---
title: "${yamlStr(nombreVisible)}"
tipo: gramatica
lectura: "${yamlStr(item.lectura)}"
jlpt: "${yamlStr(jlpt)}"
categoria: "${yamlStr(tipoEs)}"
tags:
${tags.map((t) => `  - ${t}`).join("\n")}
---
${encabezado}
> **${escaparMd(significado) || "—"}**

${[
  jlpt !== SIN_JLPT ? `**JLPT:** [[colecciones/gramatica-${jlptTag.replace(/^jlpt-/, "")}/|${jlpt}]]` : "",
  `**Tipo:** ${escaparMd(tipoEs || "—")}${tipoEs && tipoEs !== tipoEn ? ` (${escaparMd(tipoEn)})` : ""}`,
  !lecturaEsKana && lectura && lectura !== punto ? `**Forma:** ${escaparMd(lectura)}` : "",
  `**Kanjis:** ${kanjiLinks}`,
  vocabLinks ? `**Vocabulario:** ${vocabLinks}` : "",
].filter(Boolean).join("  \n")}

---

## Explicación
${escaparMd(explicacion) || "Sin datos registrados."}
${ejemplos.length > 0 ? `
## Ejemplos
<div class="ejemplos-gramatica">
${ejemplos.join("\n")}
</div>
` : ""}`;
      escribirSiCambio(path.join(CONTENT_DIR, "gramatica", `${slug}.md`), md);
    });
  } catch (err) {
    console.warn("No se pudo generar la sección de gramática:", err.message);
  }

  const renderCardGramatica = (it) =>
    `<a href="/gramatica/${it.slug}" class="card-catalogo-gramatica" data-tags="${escaparHtml(it.tags)}"><div class="cabecera-card-vocab"><span class="punto-card-gramatica" lang="ja">${escaparHtml(it.nombre)}</span><span class="kana-card-vocab">${escaparHtml(it.lectura)}</span></div><div class="traduccion-es-card">${escaparHtml(it.significado || "—")}</div><div class="glosa-multilingue">${escaparHtml([it.jlpt !== SIN_JLPT ? it.jlpt : "", it.tipoEs].filter(Boolean).join(" · "))}</div></a>`;

  if (listaGramaticaCatalogo.length > 0) {
    const ordenNiveles = { "jlpt-n5": 0, "jlpt-n4": 1, "jlpt-n3": 2, "jlpt-n2": 3, "jlpt-n1": 4 };
    const nivelDe = (it) => {
      const t = it.tags.split(" ").find((x) => x.startsWith("jlpt-"));
      return t in ordenNiveles ? ordenNiveles[t] : 9;
    };
    // Orden pedagógico: N5 → N1, conservando el orden de la hoja dentro de cada nivel.
    const ordenada = listaGramaticaCatalogo
      .map((it, i) => ({ it, i }))
      .sort((a, b) => nivelDe(a.it) - nivelDe(b.it) || a.i - b.i)
      .map((x) => x.it);

    const chipsTipo = Array.from(tiposGramaticaVistos.entries())
      .map(([filtro, en]) => ({ filtro, texto: TIPOS_GRAMATICA_ES[en] || en }))
      .sort((a, b) => a.texto.localeCompare(b.texto, "es"));

    generarCatalogoPaginado({
      directorioDestino: path.join(CONTENT_DIR, "gramatica"),
      rutaBase: "/gramatica",
      tituloCatalogo: "Catálogo de Gramática",
      items: ordenada,
      tipoGrid: "grid-catalogo-vocab",
      renderItemMarkdown: renderCardGramatica,
      filtrosHtml: renderFiltrosCatalogo(false, [{ etiqueta: "Tipo", opciones: chipsTipo }]),
    });

    for (const [clave, listado] of Object.entries(coleccionesGramatica)) {
      if (listado.length === 0) continue;
      const nivel = clave.replace(/^jlpt-/, "");
      generarCatalogoPaginado({
        directorioDestino: path.join(CONTENT_DIR, "colecciones", `gramatica-${nivel}`),
        rutaBase: `/colecciones/gramatica-${nivel}`,
        tituloCatalogo: `Gramática JLPT ${nivel.toUpperCase()}`,
        items: listado,
        tipoGrid: "grid-catalogo-vocab",
        renderItemMarkdown: renderCardGramatica,
        filtrosHtml: renderFiltrosCatalogo(false, [{ etiqueta: "Tipo", opciones: chipsTipo }]).replace(
          /<div class="grupo-filtro-chips">\s*<span class="etiqueta-filtro-chip">JLPT:<\/span>[\s\S]*?<\/div>/,
          ""
        ),
      });
    }
  }

  // 5. Colecciones
  console.log("Generando catálogos paginados para colecciones y taxonomías...");
  const titulosColecciones = {
    joyo: "Kanjis Jōyō (常用漢字)",
    jinmeiyo: "Kanjis Jinmeiyō (人名用漢字)",
    kyuujitai: "Kanjis Kyūjitai (旧字体)",
    hyougaiji: "Kanjis Hyōgaiji (表外字)",
    "jlpt-n5": "Kanjis JLPT N5",
    "jlpt-n4": "Kanjis JLPT N4",
    "jlpt-n3": "Kanjis JLPT N3",
    "jlpt-n2": "Kanjis JLPT N2",
    "jlpt-n1": "Kanjis JLPT N1",
  };

  for (const [clave, listado] of Object.entries(colecciones)) {
    if (listado.length === 0) continue;
    generarCatalogoPaginado({
      directorioDestino: path.join(CONTENT_DIR, "colecciones", clave),
      rutaBase: `/colecciones/${clave}`,
      tituloCatalogo: titulosColecciones[clave] || `Colección: ${clave}`,
      items: listado,
      tipoGrid: "grid-catalogo-kanjis",
      renderItemMarkdown: (it) =>
        `<a href="/kanji/${nombreSeguro(it.kanji)}" class="card-catalogo-item" data-tags="${it.tags}"><div class="glifo-item-kanji">${it.kanji}</div></a>`,
    });
  }

  // 6. Portada principal
  const indexMd = `---
title: "Inicio"
showDate: false
showReadingTime: false
showToc: false
enableFolderListing: false
---
# Jardín Digital de Kanji y Léxico
Base de datos viva e interconectada a partir de Google Sheets.

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin: 2rem 0;">
  <a href="./kanji/" class="card-dashboard" style="padding: 20px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--lightgray); display: block; text-decoration: none;">
    <div style="font-size: 2.2rem; margin-bottom: 6px; color: var(--secondary);">漢</div>
    <div style="font-weight: bold; font-size: 1.15rem; color: var(--dark);">Kanjis</div>
    <div style="font-size: 0.85rem; color: var(--gray);">${listaKanjisCatalogo.length} entradas analizadas</div>
  </a>
  <a href="./vocab/" class="card-dashboard" style="padding: 20px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--lightgray); display: block; text-decoration: none;">
    <div style="font-size: 2.2rem; margin-bottom: 6px; color: var(--tertiary);">語</div>
    <div style="font-weight: bold; font-size: 1.15rem; color: var(--dark);">Vocabulario</div>
    <div style="font-size: 0.85rem; color: var(--gray);">${listaVocabCatalogo.length} términos y lecturas</div>
  </a>
  <a href="./componentes/" class="card-dashboard" style="padding: 20px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--lightgray); display: block; text-decoration: none;">
    <div style="font-size: 2.2rem; margin-bottom: 6px; color: var(--secondary);">部</div>
    <div style="font-weight: bold; font-size: 1.15rem; color: var(--dark);">Radicales</div>
    <div style="font-size: 0.85rem; color: var(--gray);">${catalogoComponentes.length} componentes glíficos</div>
  </a>${listaGramaticaCatalogo.length > 0 ? `
  <a href="./gramatica/" class="card-dashboard" style="padding: 20px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--lightgray); display: block; text-decoration: none;">
    <div style="font-size: 2.2rem; margin-bottom: 6px; color: var(--tertiary);">文</div>
    <div style="font-weight: bold; font-size: 1.15rem; color: var(--dark);">Gramática</div>
    <div style="font-size: 0.85rem; color: var(--gray);">${listaGramaticaCatalogo.length} puntos gramaticales</div>
  </a>` : ""}
</div>

### Exploración rápida por nivel (JLPT)
<div style="display: flex; gap: 10px; flex-wrap: wrap; margin: 1rem 0 2rem 0;">
  <a href="./colecciones/jlpt-n5/" class="chip-jlpt" style="padding: 4px 16px; border-radius: 20px; background: rgba(255, 79, 216, 0.08); border: 1px solid var(--tertiary); font-weight: bold; font-size: 0.9rem; color: var(--tertiary); text-decoration: none;">N5 (${colecciones["jlpt-n5"].length})</a>
  <a href="./colecciones/jlpt-n4/" class="chip-jlpt" style="padding: 4px 16px; border-radius: 20px; background: rgba(255, 79, 216, 0.08); border: 1px solid var(--tertiary); font-weight: bold; font-size: 0.9rem; color: var(--tertiary); text-decoration: none;">N4 (${colecciones["jlpt-n4"].length})</a>
  <a href="./colecciones/jlpt-n3/" class="chip-jlpt" style="padding: 4px 16px; border-radius: 20px; background: rgba(255, 79, 216, 0.08); border: 1px solid var(--tertiary); font-weight: bold; font-size: 0.9rem; color: var(--tertiary); text-decoration: none;">N3 (${colecciones["jlpt-n3"].length})</a>
  <a href="./colecciones/jlpt-n2/" class="chip-jlpt" style="padding: 4px 16px; border-radius: 20px; background: rgba(255, 79, 216, 0.08); border: 1px solid var(--tertiary); font-weight: bold; font-size: 0.9rem; color: var(--tertiary); text-decoration: none;">N2 (${colecciones["jlpt-n2"].length})</a>
  <a href="./colecciones/jlpt-n1/" class="chip-jlpt" style="padding: 4px 16px; border-radius: 20px; background: rgba(255, 79, 216, 0.08); border: 1px solid var(--tertiary); font-weight: bold; font-size: 0.9rem; color: var(--tertiary); text-decoration: none;">N1 (${colecciones["jlpt-n1"].length})</a>
</div>

${listaGramaticaCatalogo.length > 0 ? `### Gramática por nivel (JLPT)
<div style="display: flex; gap: 10px; flex-wrap: wrap; margin: 1rem 0 2rem 0;">
${["n5", "n4", "n3", "n2", "n1"]
  .filter((n) => coleccionesGramatica[`jlpt-${n}`].length > 0)
  .map((n) => `  <a href="./colecciones/gramatica-${n}/" class="chip-jlpt" style="padding: 4px 16px; border-radius: 20px; background: rgba(93, 255, 154, 0.06); border: 1px solid var(--secondary); font-weight: bold; font-size: 0.9rem; color: var(--secondary); text-decoration: none;">${n.toUpperCase()} (${coleccionesGramatica[`jlpt-${n}`].length})</a>`)
  .join("\n")}
</div>

` : ""}### Taxonomía de caracteres
<div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 1rem 0;">
  <a href="./colecciones/joyo/" class="chip-tax" style="padding: 6px 14px; border-radius: 6px; background: rgba(93, 255, 154, 0.06); border: 1px solid var(--secondary); font-weight: bold; color: var(--secondary); text-decoration: none;">Jōyō (${colecciones.joyo.length})</a>
  <a href="./colecciones/jinmeiyo/" class="chip-tax" style="padding: 6px 14px; border-radius: 6px; background: rgba(93, 255, 154, 0.06); border: 1px solid var(--secondary); font-weight: bold; color: var(--secondary); text-decoration: none;">Jinmeiyō (${colecciones.jinmeiyo.length})</a>
  <a href="./colecciones/kyuujitai/" class="chip-tax" style="padding: 6px 14px; border-radius: 6px; background: rgba(93, 255, 154, 0.06); border: 1px solid var(--secondary); font-weight: bold; color: var(--secondary); text-decoration: none;">Kyūjitai (${colecciones.kyuujitai.length})</a>
  <a href="./colecciones/hyougaiji/" class="chip-tax" style="padding: 6px 14px; border-radius: 6px; background: rgba(93, 255, 154, 0.06); border: 1px solid var(--secondary); font-weight: bold; color: var(--secondary); text-decoration: none;">Hyōgaiji (${colecciones.hyougaiji.length})</a>
</div>

<div class="seccion-oculta-grafo">
[[kanji/|Kanjis]] [[vocab/|Vocabulario]] [[componentes/|Componentes]]${listaGramaticaCatalogo.length > 0 ? " [[gramatica/|Gramática]]" : ""}
[[colecciones/jlpt-n5/|N5]] [[colecciones/jlpt-n4/|N4]] [[colecciones/jlpt-n3/|N3]] [[colecciones/jlpt-n2/|N2]] [[colecciones/jlpt-n1/|N1]]
[[colecciones/joyo/|Jōyō]] [[colecciones/jinmeiyo/|Jinmeiyō]] [[colecciones/kyuujitai/|Kyūjitai]] [[colecciones/hyougaiji/|Hyōgaiji]]
</div>
`;

  escribirSiCambio(path.join(CONTENT_DIR, "index.md"), indexMd);

  console.log("Compilación finalizada.");
}

main();
