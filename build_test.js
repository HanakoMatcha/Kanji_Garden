import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

const URL_VOCAB = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPaoyAEqHNS1o3bsskqc1jwBABpBXGqvxP5c1hA4zBtpgQbWv7dd0pLZqrmo72MtB8H--ppoiYYhDD/pub?gid=0&single=true&output=csv";
const URL_KANJI = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPaoyAEqHNS1o3bsskqc1jwBABpBXGqvxP5c1hA4zBtpgQbWv7dd0pLZqrmo72MtB8H--ppoiYYhDD/pub?gid=2092672219&single=true&output=csv";

// Dominio y subruta de GitHub Pages
const MI_BASE_URL = "HanakoMatcha.github.io/Kanji_Garden";
const BASE_PATH = "/Kanji_Garden";

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
const ORDEN_IMG = ["origin", "tensho", "gyosho", "sousho", "kso_images"];

const CONTENT_DIR = "./content";

["vocab", "kanji", "componentes", "colecciones"].forEach((dir) => {
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
  const regex = /[\u4E00-\u9FAF\u3400-\u4DBF\u{20000}-\u{2A6DF}]/gu;
  return Array.from(new Set(texto.match(regex) || []));
}

function filtrarComponentesValidos(texto) {
  if (!texto) return [];
  const regex = /[\u2E80-\u2FD5\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u{20000}-\u{2EBEF}]/gu;
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

function esVerdadero(val) {
  const s = String(val).trim().toLowerCase();
  return s === "1" || s === "true" || s === "sí" || s === "si";
}

function limpiarEtimologiaWiktionary(raw) {
  if (!raw) return "Sin datos registrados.";

  let texto = raw
    .replace(/\[\[(?:[^\vert{}\]]*\Vert{})*([^\]]+)\]\]/g, "$1")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/(?:thumb|left|right)\|[^|]+\|/gi, "")
    .replace(/\b(zh|yue|cmn|hak|nan):\s*/gi, "")
    .replace(/\b(sit-pro|tbq-pro|sit-bai-pro|tbq-kuk-pro|tbq-lol-pro|mkh-vie-pro|mkh-mnc-pro|aav-pro|kar-pro|qfa-lic-pro)\s+\*/gi, "proto-*")
    .replace(/\b(bo|my|vi|und|omx|mnw|ssm|kac|cdm|lhu|lus|sti|bca)\s+/gi, "")
    .replace(/\s*\|\s*\*\s*/g, "\n\n- ")
    .replace(/\s*\|\s*/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \t]*-[ \t]*/gm, "- ")
    .trim();

  return texto || "Sin datos registrados.";
}

// Barra de paginación que siempre respeta el subdirectorio de GitHub Pages
function renderBarraPaginacion(numPagina, totalPaginas) {
  const enlaceAnterior = numPagina === 1
    ? `<span class="btn-nav-desactivado">← Anterior</span>`
    : numPagina === 2
      ? `<a href="./" class="btn-nav-catalogo">← Anterior</a>`
      : `<a href="./pagina-${numPagina - 1}" class="btn-nav-catalogo">← Anterior</a>`;

  const enlaceSiguiente = numPagina < totalPaginas
    ? `<a href="./pagina-${numPagina + 1}" class="btn-nav-catalogo">Siguiente →</a>`
    : `<span class="btn-nav-desactivado">Siguiente →</span>`;

  let opciones = "";
  for (let p = 1; p <= totalPaginas; p++) {
    const slugDestino = p === 1 ? "" : `pagina-${p}`;
    const selected = p === numPagina ? "selected" : "";
    opciones += `<option value="${slugDestino}" ${selected}>Página ${p} de ${totalPaginas}</option>`;
  }

  return `
<div class="barra-paginacion-catalogo">
  <div style="min-width: 100px; text-align: left;">${enlaceAnterior}</div>
  <div class="selector-pagina-wrapper">
    <select class="selector-pagina-dropdown" onchange="
      const segs = window.location.pathname.split('/').filter(Boolean);
      if (segs.length > 0 && segs[segs.length - 1].startsWith('pagina-')) {
        segs.pop();
      }
      const base = '/' + segs.join('/') + '/';
      window.location.href = base + this.value;
    ">
      ${opciones}
    </select>
  </div>
  <div style="min-width: 100px; text-align: right;">${enlaceSiguiente}</div>
</div>`;
}

function renderFiltrosCatalogo(incluirTaxonomia = true) {
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
  }
</div>

<script>
  (function() {
    function initFiltrosCatalogo() {
      const panel = document.querySelector('.contenedor-filtros-catalogo');
      if (!panel || panel.dataset.bound) return;
      panel.dataset.bound = "true";

      const tarjetas = Array.from(document.querySelectorAll('.card-catalogo-item, .card-catalogo-vocab'));
      const botones = Array.from(panel.querySelectorAll('.btn-chip-filtro'));
      const btnReset = panel.querySelector('#btn-limpiar-chips');
      let filtrosActivos = new Set();

      function aplicar() {
        const arr = Array.from(filtrosActivos);
        tarjetas.forEach(t => {
          const tagsStr = (t.dataset.tags || '').toLowerCase();
          const visible = arr.length === 0 || arr.every(f => tagsStr.includes(f));
          t.style.display = visible ? '' : 'none';
        });
      }

      botones.forEach(b => {
        b.addEventListener('click', () => {
          const f = b.dataset.filtro;
          if (filtrosActivos.has(f)) {
            filtrosActivos.delete(f);
            b.classList.remove('activo');
          } else {
            filtrosActivos.add(f);
            b.classList.add('activo');
          }
          aplicar();
        });
      });

      if (btnReset) {
        btnReset.addEventListener('click', () => {
          filtrosActivos.clear();
          botones.forEach(b => b.classList.remove('activo'));
          aplicar();
        });
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initFiltrosCatalogo);
    } else {
      initFiltrosCatalogo();
    }
    document.addEventListener('nav', initFiltrosCatalogo);
  })();
</script>
`;
}

function seccionPracticadorKanji(caracter) {
  const containerId = `kanji-quiz-${caracter.codePointAt(0)}`;

  return `
## Práctica de trazo

<div class="kanji-quiz-container" style="display: flex; flex-direction: column; align-items: center; gap: 12px; margin: 1.5rem 0; padding: 1.2rem; background: rgba(0,0,0,0.03); border: 1px solid var(--lightgray); border-radius: 8px;">
  <div id="${containerId}" style="border: 2px solid var(--gray); border-radius: 8px; box-shadow: inset 0 0 10px rgba(0,0,0,0.04); position: relative; width: 180px; height: 180px;"></div>
  
  <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;">
    <button type="button" id="btn-quiz-${containerId}" style="padding: 6px 14px; border-radius: 4px; border: 1px solid var(--secondary); background: var(--secondary); color: var(--light); cursor: pointer; font-size: 0.85rem; font-weight: bold;">Trazar</button>
    <button type="button" id="btn-anim-${containerId}" style="padding: 6px 14px; border-radius: 4px; border: 1px solid var(--gray); background: transparent; color: var(--dark); cursor: pointer; font-size: 0.85rem;">Ver orden</button>
    <button type="button" id="btn-reset-${containerId}" style="padding: 6px 14px; border-radius: 4px; border: 1px solid var(--gray); background: transparent; color: var(--dark); cursor: pointer; font-size: 0.85rem;">Limpiar</button>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.7/dist/hanzi-writer.min.js"></script>
<script>
  (function() {
    let writerInstance = null;

    function getThemePalette() {
      const isDark = document.documentElement.getAttribute('saved-theme') === 'dark' ||
                     document.documentElement.getAttribute('theme') === 'dark' ||
                     document.body.classList.contains('dark') ||
                     document.documentElement.classList.contains('dark');

      if (isDark) {
        return {
          background: '#231634',
          strokeColor: '#f5f0fb',
          outlineColor: '#4d3b63',
          drawingColor: '#ff4fd8',
          radicalColor: '#5dff9a'
        };
      } else {
        return {
          background: '#ffffff',
          strokeColor: '#3e2a1e',
          outlineColor: '#bfae93',
          drawingColor: '#d64d7c',
          radicalColor: '#6a8f58'
        };
      }
    }

    function initWriter() {
      if (typeof HanziWriter === 'undefined') {
        setTimeout(initWriter, 50);
        return;
      }
      const el = document.getElementById('${containerId}');
      if (!el) return;

      el.innerHTML = '';
      const p = getThemePalette();
      el.style.backgroundColor = p.background;

      writerInstance = HanziWriter.create('${containerId}', '${caracter}', {
        width: 180,
        height: 180,
        padding: 12,
        showOutline: true,
        strokeAnimationSpeed: 1.2,
        delayBetweenStrokes: 120,
        strokeColor: p.strokeColor,
        outlineColor: p.outlineColor,
        drawingColor: p.drawingColor,
        radicalColor: p.radicalColor,
        highlightColor: p.drawingColor,
        showCharacter: true
      });

      const btnQuiz = document.getElementById('btn-quiz-${containerId}');
      const btnAnim = document.getElementById('btn-anim-${containerId}');
      const btnReset = document.getElementById('btn-reset-${containerId}');

      if (btnQuiz && !btnQuiz.dataset.bound) {
        btnQuiz.dataset.bound = "true";
        btnQuiz.addEventListener('click', () => {
          if (!writerInstance) return;
          writerInstance.quiz({ showOutline: true, showHintAfterMisses: 1 });
        });
      }

      if (btnAnim && !btnAnim.dataset.bound) {
        btnAnim.dataset.bound = "true";
        btnAnim.addEventListener('click', () => {
          if (writerInstance) writerInstance.animateCharacter();
        });
      }

      if (btnReset && !btnReset.dataset.bound) {
        btnReset.dataset.bound = "true";
        btnReset.addEventListener('click', () => {
          if (!writerInstance) return;
          writerInstance.cancelQuiz();
          writerInstance.showCharacter();
          writerInstance.showOutline();
        });
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initWriter);
    } else {
      initWriter();
    }
    document.addEventListener('nav', initWriter);

    const themeObserver = new MutationObserver(() => initWriter());
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['saved-theme', 'theme', 'class'] });
  })();
</script>
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

    md += `\n### ${etiqueta}\n<div class="contenedor-imagenes ${esOrigen ? 'contenedor-origen' : 'contenedor-estilos'}">\n${imgs.join("\n")}\n</div>\n`;
  }
  return md;
}

// Generador genérico de catálogos paginados
function generarCatalogoPaginado({
  directorioDestino,
  tituloCatalogo,
  items,
  porPagina = 50,
  renderTarjeta,
  obtenerEnlaceGrafo,
  filtrosHtml = ""
}) {
  if (!fs.existsSync(directorioDestino)) {
    fs.mkdirSync(directorioDestino, { recursive: true });
  }

  const totalPaginas = Math.ceil(items.length / porPagina) || 1;

  for (let i = 0; i < totalPaginas; i++) {
    const numPagina = i + 1;
    const inicio = i * porPagina;
    const lote = items.slice(inicio, inicio + porPagina);
    const navBar = renderBarraPaginacion(numPagina, totalPaginas);

    let gridHtml = `<div class="grid-catalogo-general">\n`;
    lote.forEach((item) => {
      gridHtml += renderTarjeta(item);
    });
    gridHtml += `</div>\n`;

    // Lista de enlaces nativos que Quartz lee para el Grafo
    const enlacesGrafoMarkdown = lote.map(it => `- ${obtenerEnlaceGrafo(it)}`).join("\n");

    const contenidoIndice = `---
title: "${tituloCatalogo} (Pág. ${numPagina})"
showDate: false
showReadingTime: false
showToc: false
enableFolderListing: false
---

# ${tituloCatalogo}

Mostrando **${lote.length}** de **${items.length}** entradas registradas.

${filtrosHtml}
${navBar}
${gridHtml}
${navBar}

### Conexiones de esta página
${enlacesGrafoMarkdown}
`;

    const nombreArchivo = numPagina === 1 ? "index.md" : `pagina-${numPagina}.md`;
    escribirSiCambio(path.join(directorioDestino, nombreArchivo), contenidoIndice);
  }
}

async function main() {
  const configPath = "./quartz.config.ts";
  if (fs.existsSync(configPath)) {
    let config = fs.readFileSync(configPath, "utf8");
    config = config.replace(/baseUrl:\s*"[^"]*"/, `baseUrl: "${MI_BASE_URL}"`);
    fs.writeFileSync(configPath, config, "utf8");
  }

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
    const kyujitaiLink = kyujitaiAntiguo ? `[[kanji/${nombreSeguro(kyujitaiAntiguo)}|${kyujitaiAntiguo}]]` : "None";

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

  // Generar Catálogo Principal de Kanji con BASE_PATH
  generarCatalogoPaginado({
    directorioDestino: path.join(CONTENT_DIR, "kanji"),
    tituloCatalogo: "Catálogo de Kanjis",
    items: listaKanjisCatalogo,
    renderTarjeta: (it) => `  <a href="${BASE_PATH}/kanji/${nombreSeguro(it.kanji)}" class="card-catalogo-item" data-tags="${it.tags}">
    <div class="glifo-item-kanji">${it.kanji}</div>
    <div class="significado-item-kanji">${it.significado || "—"}</div>
  </a>\n`,
    obtenerEnlaceGrafo: (it) => `[[kanji/${nombreSeguro(it.kanji)}|${it.kanji}]]`,
    filtrosHtml: renderFiltrosCatalogo(true),
  });

  // 2. Componentes / Radicales con BASE_PATH
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
    tituloCatalogo: "Catálogo de Radicales y Componentes",
    items: catalogoComponentes,
    renderTarjeta: (it) => `  <a href="${BASE_PATH}/componentes/${nombreSeguro(it.comp)}" class="card-catalogo-item">
    <div class="glifo-item-kanji">${it.comp}</div>
    <div class="significado-item-kanji">${it.significado || "—"}</div>
  </a>\n`,
    obtenerEnlaceGrafo: (it) => `[[componentes/${nombreSeguro(it.comp)}|${it.comp}]]`,
  });

  // 3. Vocabulario con BASE_PATH
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
    tituloCatalogo: "Catálogo de Vocabulario",
    items: listaVocabCatalogo,
    renderTarjeta: (it) => {
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

      return `  <a href="${BASE_PATH}/vocab/${nombreSeguro(it.palabra)}" class="card-catalogo-vocab" data-tags="${it.tags}">
    <div class="cabecera-card-vocab">
      <span class="palabra-card-vocab">${it.palabra}</span>
      <span class="kana-card-vocab">${it.kana || ""}</span>
    </div>
    <div class="traduccion-es-card">${it.es || it.en || "—"}</div>
    ${glosa}
  </a>\n`;
    },
    obtenerEnlaceGrafo: (it) => `[[vocab/${nombreSeguro(it.palabra)}|${it.palabra}]]`,
    filtrosHtml: renderFiltrosCatalogo(false),
  });

  // 4. Catálogos dedicados para taxonomías (con enlaces directos al kanji)
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
      tituloCatalogo: titulosColecciones[clave] || `Colección: ${clave}`,
      items: listado,
      renderTarjeta: (it) => `  <a href="${BASE_PATH}/kanji/${nombreSeguro(it.kanji)}" class="card-catalogo-item" data-tags="${it.tags}">
    <div class="glifo-item-kanji">${it.kanji}</div>
    <div class="significado-item-kanji">${it.significado || "—"}</div>
  </a>\n`,
      obtenerEnlaceGrafo: (it) => `[[kanji/${nombreSeguro(it.kanji)}|${it.kanji}]]`,
    });
  }

  // 5. Portada principal
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
  <a href="./kanji/" class="card-dashboard" style="text-decoration: none; padding: 20px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--lightgray); display: block; transition: all 0.2s ease;">
    <div style="font-size: 2.2rem; margin-bottom: 6px; color: var(--secondary); text-shadow: 0 0 14px rgba(93, 255, 154, 0.4);">漢</div>
    <div style="font-weight: bold; font-size: 1.15rem; color: var(--dark);">Kanjis</div>
    <div style="font-size: 0.85rem; color: var(--gray);">${listaKanjisCatalogo.length} entradas analizadas</div>
  </a>

  <a href="./vocab/" class="card-dashboard" style="text-decoration: none; padding: 20px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--lightgray); display: block; transition: all 0.2s ease;">
    <div style="font-size: 2.2rem; margin-bottom: 6px; color: var(--tertiary); text-shadow: 0 0 14px rgba(255, 79, 216, 0.4);">語</div>
    <div style="font-weight: bold; font-size: 1.15rem; color: var(--dark);">Vocabulario</div>
    <div style="font-size: 0.85rem; color: var(--gray);">${listaVocabCatalogo.length} términos y lecturas</div>
  </a>

  <a href="./componentes/" class="card-dashboard" style="text-decoration: none; padding: 20px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--lightgray); display: block; transition: all 0.2s ease;">
    <div style="font-size: 2.2rem; margin-bottom: 6px; color: var(--secondary); text-shadow: 0 0 14px rgba(93, 255, 154, 0.4);">部</div>
    <div style="font-weight: bold; font-size: 1.15rem; color: var(--dark);">Radicales</div>
    <div style="font-size: 0.85rem; color: var(--gray);">${catalogoComponentes.length} componentes glíficos</div>
  </a>
</div>

### Exploración rápida por nivel (JLPT)

<div style="display: flex; gap: 10px; flex-wrap: wrap; margin: 1rem 0 2rem 0;">
  <a href="./colecciones/jlpt-n5/" class="chip-jlpt" style="padding: 4px 16px; border-radius: 20px; background: rgba(255, 79, 216, 0.08); border: 1px solid var(--tertiary); text-decoration: none; font-weight: bold; font-size: 0.9rem; color: var(--tertiary); transition: all 0.2s ease;">N5 (${colecciones["jlpt-n5"].length})</a>
  <a href="./colecciones/jlpt-n4/" class="chip-jlpt" style="padding: 4px 16px; border-radius: 20px; background: rgba(255, 79, 216, 0.08); border: 1px solid var(--tertiary); text-decoration: none; font-weight: bold; font-size: 0.9rem; color: var(--tertiary); transition: all 0.2s ease;">N4 (${colecciones["jlpt-n4"].length})</a>
  <a href="./colecciones/jlpt-n3/" class="chip-jlpt" style="padding: 4px 16px; border-radius: 20px; background: rgba(255, 79, 216, 0.08); border: 1px solid var(--tertiary); text-decoration: none; font-weight: bold; font-size: 0.9rem; color: var(--tertiary); transition: all 0.2s ease;">N3 (${colecciones["jlpt-n3"].length})</a>
  <a href="./colecciones/jlpt-n2/" class="chip-jlpt" style="padding: 4px 16px; border-radius: 20px; background: rgba(255, 79, 216, 0.08); border: 1px solid var(--tertiary); text-decoration: none; font-weight: bold; font-size: 0.9rem; color: var(--tertiary); transition: all 0.2s ease;">N2 (${colecciones["jlpt-n2"].length})</a>
  <a href="./colecciones/jlpt-n1/" class="chip-jlpt" style="padding: 4px 16px; border-radius: 20px; background: rgba(255, 79, 216, 0.08); border: 1px solid var(--tertiary); text-decoration: none; font-weight: bold; font-size: 0.9rem; color: var(--tertiary); transition: all 0.2s ease;">N1 (${colecciones["jlpt-n1"].length})</a>
</div>

### Taxonomía de caracteres

<div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 1rem 0;">
  <a href="./colecciones/joyo/" class="chip-tax" style="padding: 6px 14px; border-radius: 6px; background: rgba(93, 255, 154, 0.06); border: 1px solid var(--secondary); text-decoration: none; font-weight: bold; color: var(--secondary); transition: all 0.2s ease;">Jōyō (${colecciones.joyo.length})</a>
  <a href="./colecciones/jinmeiyo/" class="chip-tax" style="padding: 6px 14px; border-radius: 6px; background: rgba(93, 255, 154, 0.06); border: 1px solid var(--secondary); text-decoration: none; font-weight: bold; color: var(--secondary); transition: all 0.2s ease;">Jinmeiyō (${colecciones.jinmeiyo.length})</a>
  <a href="./colecciones/kyuujitai/" class="chip-tax" style="padding: 6px 14px; border-radius: 6px; background: rgba(93, 255, 154, 0.06); border: 1px solid var(--secondary); text-decoration: none; font-weight: bold; color: var(--secondary); transition: all 0.2s ease;">Kyūjitai (${colecciones.kyuujitai.length})</a>
  <a href="./colecciones/hyougaiji/" class="chip-tax" style="padding: 6px 14px; border-radius: 6px; background: rgba(93, 255, 154, 0.06); border: 1px solid var(--secondary); text-decoration: none; font-weight: bold; color: var(--secondary); transition: all 0.2s ease;">Hyōgaiji (${colecciones.hyougaiji.length})</a>
</div>
`;
  escribirSiCambio(path.join(CONTENT_DIR, "index.md"), indexMd);

  console.log("Compilación de datos finalizada con éxito.");
}

main();
