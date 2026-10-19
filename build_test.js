import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

// URLs públicas en formato CSV de Google Sheets
const URL_VOCAB = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPaoyAEqHNS1o3bsskqc1jwBABpBXGqvxP5c1hA4zBtpgQbWv7dd0pLZqrmo72MtB8H--ppoiYYhDD/pub?gid=0&single=true&output=csv";
const URL_KANJI = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPaoyAEqHNS1o3bsskqc1jwBABpBXGqvxP5c1hA4zBtpgQbWv7dd0pLZqrmo72MtB8H--ppoiYYhDD/pub?gid=2092672219&single=true&output=csv";

// RUTA DE GITHUB (sin https:// ni barra final)
const MI_BASE_URL = "HanakoMatcha.github.io/Kanji_Garden";

// Repositorio de imágenes (kanjium) servido por jsDelivr
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

// Crear carpetas de destino
["vocab", "kanji", "componentes"].forEach((dir) => {
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
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s ? `jlpt-${s}` : "";
}

// Búsqueda insensible a BOM (\uFEFF), mayúsculas y espacios
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

// Limpiador y formateador de etimología (remueve ruido de Wiktionary / MediaWiki)
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

// ---------- Practicador de kanji (Hanzi Writer) ----------
function seccionPracticadorKanji(caracter) {
  const containerId = `kanji-quiz-${caracter.codePointAt(0)}`;

  return `
## Práctica de trazo

<div class="kanji-quiz-container" style="display: flex; flex-direction: column; align-items: center; gap: 12px; margin: 1.5rem 0; padding: 1.2rem; background: rgba(0,0,0,0.03); border: 1px solid var(--lightgray); border-radius: 8px;">
  <div id="${containerId}" style="background: var(--light); border: 1px solid var(--gray); border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);"></div>
  <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;">
    <button type="button" id="btn-quiz-${containerId}" style="padding: 6px 14px; border-radius: 4px; border: 1px solid var(--secondary); background: var(--secondary); color: var(--light); cursor: pointer; font-size: 0.85rem; font-weight: bold;">Trazar</button>
    <button type="button" id="btn-anim-${containerId}" style="padding: 6px 14px; border-radius: 4px; border: 1px solid var(--gray); background: transparent; color: var(--dark); cursor: pointer; font-size: 0.85rem;">Ver orden</button>
    <button type="button" id="btn-reset-${containerId}" style="padding: 6px 14px; border-radius: 4px; border: 1px solid var(--gray); background: transparent; color: var(--dark); cursor: pointer; font-size: 0.85rem;">Limpiar</button>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.7/dist/hanzi-writer.min.js"></script>
<script>
  (function() {
    function initWriter() {
      if (typeof HanziWriter === 'undefined') {
        setTimeout(initWriter, 50);
        return;
      }
      const el = document.getElementById('${containerId}');
      if (!el || el.dataset.loaded) return;
      el.dataset.loaded = "true";

      const styles = getComputedStyle(document.documentElement);
      const colorTrazo = styles.getPropertyValue('--dark').trim() || '#333333';
      const colorGuia = styles.getPropertyValue('--lightgray').trim() || '#e0e0e0';
      const colorAcento = styles.getPropertyValue('--tertiary').trim() || '#e993b5';

      const writer = HanziWriter.create('${containerId}', '${caracter}', {
        width: 180,
        height: 180,
        padding: 10,
        showOutline: true,
        strokeAnimationSpeed: 1.2,
        delayBetweenStrokes: 120,
        strokeColor: colorTrazo,
        outlineColor: colorGuia,
        drawingColor: colorAcento
      });

      document.getElementById('btn-quiz-${containerId}')?.addEventListener('click', () => {
        writer.quiz({
          showOutline: false,
          showHintAfterMisses: 2
        });
      });

      document.getElementById('btn-anim-${containerId}')?.addEventListener('click', () => {
        writer.animateCharacter();
      });

      document.getElementById('btn-reset-${containerId}')?.addEventListener('click', () => {
        writer.cancelQuiz();
        writer.showOutline();
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initWriter);
    } else {
      initWriter();
    }
    document.addEventListener('nav', initWriter);
  })();
</script>
`;
}

// ---------- Imágenes de kanjium ----------
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
    if (data.truncated) {
      console.warn("AVISO: GitHub devolvió la lista de archivos truncada; faltarán imágenes.");
    }

    let total = 0;
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
      total++;
    }
    console.log(`Índice de imágenes: ${total} archivos, ${indiceImagenes.size} caracteres.`);
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
    const items = porCarpeta.get(carpeta).sort((a, b) => a.archivo.localeCompare(b.archivo));
    const imgs = items.map((it) => {
      const url = `${ASSETS_CDN}/${it.ruta.split("/").map(encodeURIComponent).join("/")}`;
      return `![${caracter} ${etiqueta}](${url})`;
    });
    md += `\n### ${etiqueta}\n${imgs.join(" ")}\n`;
  }
  return md;
}

async function main() {
  const configPath = "./quartz.config.ts";
  if (fs.existsSync(configPath)) {
    console.log("Configurando baseUrl en quartz.config.ts...");
    let config = fs.readFileSync(configPath, "utf8");
    config = config.replace(/baseUrl:\s*"[^"]*"/, `baseUrl: "${MI_BASE_URL}"`);
    fs.writeFileSync(configPath, config, "utf8");
  }

  // 0. Cargar recursos de imágenes
  console.log("Cargando índice de imágenes de kanjium...");
  await cargarIndiceImagenes();

  // 1. Descargar y procesar kanjis
  console.log("Descargando hoja de kanjis...");
  const resKanji = await fetch(URL_KANJI);
  const textKanji = await resKanji.text();
  const kanjiRecords = parse(textKanji, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  });

  if (kanjiRecords.length > 0) {
    console.log(`Encabezados detectados en KANJI: ${Object.keys(kanjiRecords[0]).join(" | ")}`);
  }

  const componentesGlobales = new Set();
  let totalKanjis = 0;

  kanjiRecords.forEach((row) => {
    const kanji = getValor(row, ["Kanji", "Character"]);
    if (!kanji) return;

    totalKanjis++;

    const onyomi = getValor(row, ["Onyomi", "On'yomi", "音読み"]);
    const kunyomi = getValor(row, ["Kunyomi", "Kun'yomi", "訓読み"]);
    const significado = getValor(row, ["Significado", "Meaning"]);
    const componentesRaw = getValor(row, [
      "Componentes Reales (Completos)",
      "Componentes Reales",
      "Componentes",
    ]);
    const kyujitaiAntiguo = getValor(row, ["Kyujitai (Kanji Antiguo)", "Kyujitai"]);
    
    // Extracción y saneamiento de la etimología
    const etimologiaRaw = getValor(row, ["Etimología", "Etimologia", "Etymology"]);
    const etimologia = limpiarEtimologiaWiktionary(etimologiaRaw);

    // Nuevas columnas de clasificación y estatus
    const esKyujitai = esVerdadero(getValor(row, ["Kyūjitai (旧字体)", "Kyujitai (旧字体)", "Kyujitai"]));
    const esHyougaiji = esVerdadero(getValor(row, ["Hyōgaiji (表外字)", "Hyougaiji (表外字)", "Hyogaiji", "Hyougaiji"]));
    const esJoyo = esVerdadero(getValor(row, ["Jōyō Kanji (常用漢字)", "Joyo Kanji (常用漢字)", "Joyo", "Jōyō"]));
    const esJinmeiyo = esVerdadero(getValor(row, ["Jinmeiyō Kanji (人名用漢字)", "Jinmeiyo Kanji (人名用漢字)", "Jinmeiyo", "Jinmeiyō"]));
    const jlptKanji = getValor(row, ["JLPT"]);

    // Generar etiquetas (tags) para Quartz
    const tags = ["kanji"];
    if (esJoyo) tags.push("joyo");
    if (esJinmeiyo) tags.push("jinmeiyo");
    if (esHyougaiji) tags.push("hyougaiji");
    if (esKyujitai) tags.push("kyuujitai");

    const tagJlpt = etiquetaJlpt(jlptKanji);
    if (tagJlpt) tags.push(tagJlpt);

    // Texto descriptivo de clasificación para el cuerpo
    const listaClasificacion = [];
    if (esJoyo) listaClasificacion.push("Jōyō (常用漢字)");
    if (esJinmeiyo) listaClasificacion.push("Jinmeiyō (人名用漢字)");
    if (esHyougaiji) listaClasificacion.push("Hyōgaiji (表外字)");
    if (esKyujitai) listaClasificacion.push("Kyūjitai (旧字体)");
    const textoClasificacion = listaClasificacion.length > 0 ? listaClasificacion.join(" · ") : "Sin clasificar";

    const comps = filtrarComponentesValidos(componentesRaw);
    comps.forEach((c) => componentesGlobales.add(c));

    const compsLinks =
      comps.length > 0
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

  // Notas de componentes
  const listaComponentes = Array.from(componentesGlobales);
  listaComponentes.forEach((comp) => {
    const md = `---
title: "${yamlStr(comp)}"
tipo: componente
tags:
  - radical
---
# Componente: ${comp}

Revisa los backlinks para ver kanjis con este componente.
${seccionImagenes(comp)}`;
    escribirSiCambio(path.join(CONTENT_DIR, "componentes", `${nombreSeguro(comp)}.md`), md);
  });

  // 2. Descargar y procesar vocabulario
  console.log("Descargando hoja de vocabulario...");
  const resVocab = await fetch(URL_VOCAB);
  const textVocab = await resVocab.text();
  const vocabRecords = parse(textVocab, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  });

  if (vocabRecords.length > 0) {
    console.log(`Encabezados detectados en VOCAB: ${Object.keys(vocabRecords[0]).join(" | ")}`);
  }

  let totalVocab = 0;

  vocabRecords.forEach((row) => {
    const palabra = getValor(row, ["日本語", "Palabra", "Vocabulario"]);
    if (!palabra) return;

    totalVocab++;

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

    const kanjis = extraerKanjis(palabra);
    const kanjiLinks =
      kanjis.length > 0
        ? kanjis.map((k) => `[[kanji/${nombreSeguro(k)}|${k}]]`).join(", ")
        : "Kana puro";

    // Bloque de traducciones en la cabecera
    const lineasTraducciones = [
      es ? `> **ES:** ${es}` : null,
      en ? `> **EN:** ${en}` : null,
      fr ? `> **FR:** ${fr}` : null,
      de ? `> **DE:** ${de}` : null,
      tradChinese ? `> **繁體:** ${tradChinese}` : null,
      simpChinese ? `> **简体:** ${simpChinese}` : null,
      pinyin ? `> **Pinyin:** ${pinyin}` : null,
    ].filter(Boolean);

    const bloqueTraducciones = lineasTraducciones.length > 0
      ? lineasTraducciones.join("  \n")
      : "> —";

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

  // 3. Portada principal
  const indexMd = `---
title: "Inicio"
---

# Jardín Digital de Kanji y Vocabulario

Base de datos viva interconectada a partir de Google Sheets.

- [Explorar Kanjis](./kanji/) (${totalKanjis})
- [Explorar Vocabulario](./vocab/) (${totalVocab})
- [Explorar Componentes y Radicales](./componentes/) (${listaComponentes.length})
`;
  escribirSiCambio(path.join(CONTENT_DIR, "index.md"), indexMd);

  console.log(`¡Listo! ${totalKanjis} kanjis, ${listaComponentes.length} componentes, ${totalVocab} palabras.`);
}

main();
