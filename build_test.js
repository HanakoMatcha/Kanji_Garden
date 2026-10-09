import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

// URLs públicas en formato CSV de Google Sheets
// (si ya cambiaste los gid a las hojas reales, conserva los tuyos)
const URL_VOCAB = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPaoyAEqHNS1o3bsskqc1jwBABpBXGqvxP5c1hA4zBtpgQbWv7dd0pLZqrmo72MtB8H--ppoiYYhDD/pub?gid=654834278&single=true&output=csv";
const URL_KANJI = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPaoyAEqHNS1o3bsskqc1jwBABpBXGqvxP5c1hA4zBtpgQbWv7dd0pLZqrmo72MtB8H--ppoiYYhDD/pub?gid=1745742637&single=true&output=csv";

// RUTA DE GITHUB (sin https:// ni barra final)
const MI_BASE_URL = "HanakoMatcha.github.io/Kanji_Garden";

// Repositorio de imágenes (kanjium) servido por jsDelivr
const ASSETS_REPO = "HanakoMatcha/kanjium-assets";
const ASSETS_CDN = `https://cdn.jsdelivr.net/gh/${ASSETS_REPO}@main`;

// ---------- Idiomas extra (editables) ----------
// col = nombre EXACTO del encabezado en la hoja; etiqueta = cómo se muestra en la nota.
// Si una columna no existe o la celda está vacía, simplemente no se muestra.
const CAMPOS_VOCAB = [
  { col: "Traditional Chinese", etiqueta: "中文 繁體" },
  { col: "Simplified Chinese", etiqueta: "中文 简体" },
  { col: "Pinyin", etiqueta: "Pinyin" },
  { col: "Français", etiqueta: "Français" },
  { col: "Deutsche", etiqueta: "Deutsch" },
];
// Columnas extra de la hoja de kanjis (ejemplo: { col: "Pinyin", etiqueta: "Pinyin" })
const CAMPOS_KANJI = [];

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

// Una sola función para nombres de archivo Y enlaces
function nombreSeguro(s) {
  return String(s).normalize("NFC").replace(/[\/\\?%*:|"<>#&\s]/g, "_");
}

// Escapar texto para usarlo dentro de comillas en el frontmatter YAML
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

// Etiqueta a partir del nivel JLPT: "N3" -> "jlpt-n3" (vacío si no hay nivel)
function etiquetaJlpt(valor) {
  if (!valor || valor === SIN_JLPT) return "";
  const s = String(valor)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s ? `jlpt-${s}` : "";
}

// ---------- Idiomas extra ----------
function bloqueCampos(row, campos) {
  const lineas = campos
    .map(({ col, etiqueta }) => {
      const v = row[col]?.trim();
      return v ? `**${etiqueta}:** ${v}` : "";
    })
    .filter(Boolean);
  if (lineas.length === 0) return "";
  return "\n## Otros idiomas\n\n" + lineas.join("\n\n") + "\n";
}

function revisarColumnas(nombre, records, campos) {
  if (records.length === 0) {
    console.warn(`AVISO: ${nombre} no tiene filas.`);
    return;
  }
  const encabezados = Object.keys(records[0]);
  console.log(`Encabezados de ${nombre}: ${encabezados.join(" | ")}`);
  for (const { col } of campos) {
    if (!encabezados.includes(col)) {
      console.warn(`AVISO: ${nombre} no tiene una columna llamada "${col}".`);
    }
  }
}

// ---------- Imágenes de kanjium ----------
// código Unicode decimal -> [{ carpeta, archivo, ruta }]
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

      // Clave: dígitos iniciales (19978, 19978_1...) o el propio kanji como nombre
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

  // 0. Índice de imágenes disponibles
  console.log("Cargando índice de imágenes de kanjium...");
  await cargarIndiceImagenes();

  // 1. Descargar y procesar la hoja de kanjis
  console.log("Descargando hoja de kanjis...");
  const resKanji = await fetch(URL_KANJI);
  const textKanji = await resKanji.text();
  const kanjiRecords = parse(textKanji, { columns: true, skip_empty_lines: true });
  revisarColumnas("hoja de kanjis", kanjiRecords, CAMPOS_KANJI);

  const componentesGlobales = new Set();
  let totalKanjis = 0;

  kanjiRecords.forEach((row) => {
    const kanji = row["Kanji"]?.trim();
    if (!kanji) return;

    totalKanjis++;

    const onyomi = row["Onyomi"]?.trim() || "";
    const kunyomi = row["Kunyomi"]?.trim() || "";
    const significado = row["Significado"]?.trim() || "";
    const componentesRaw = row["Componentes Reales (Completos)"] || "";
    const kyujitai = row["Kyujitai (Kanji Antiguo)"]?.trim() || "";
    const etimologia = row["Etimología"]?.trim() || "";

    const comps = filtrarComponentesValidos(componentesRaw);
    comps.forEach((c) => componentesGlobales.add(c));

    const compsLinks =
      comps.length > 0
        ? comps.map((c) => `[[componentes/${nombreSeguro(c)}|${c}]]`).join(", ")
        : "Ninguno";
    const kyujitaiLink = kyujitai ? `[[kanji/${nombreSeguro(kyujitai)}|${kyujitai}]]` : "None";

    const md = `---
title: "${yamlStr(kanji)}"
tipo: kanji
onyomi: "${yamlStr(onyomi)}"
kunyomi: "${yamlStr(kunyomi)}"
tags:
  - kanji
---

# ${kanji}

> **${significado}**

**On:** ${onyomi || "—"}

**Kun:** ${kunyomi || "—"}

**Kyūjitai:** ${kyujitaiLink}

**Componentes:** ${compsLinks}

---

## Etimología
${etimologia || "Sin datos registrados."}
${bloqueCampos(row, CAMPOS_KANJI)}${seccionImagenes(kanji)}`;
    escribirSiCambio(path.join(CONTENT_DIR, "kanji", `${nombreSeguro(kanji)}.md`), md);
  });

  // Notas individuales de componentes válidos
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

  // 2. Descargar y procesar la hoja de vocabulario
  console.log("Descargando hoja de vocabulario...");
  const resVocab = await fetch(URL_VOCAB);
  const textVocab = await resVocab.text();
  const vocabRecords = parse(textVocab, { columns: true, skip_empty_lines: true });
  revisarColumnas("hoja de vocabulario", vocabRecords, CAMPOS_VOCAB);

  let totalVocab = 0;

  vocabRecords.forEach((row) => {
    const palabra = row["日本語"]?.trim();
    if (!palabra) return;

    totalVocab++;

    const kana = row["かな"]?.trim() || "";
    const en = row["English"]?.trim() || "";
    const es = row["Español"]?.trim() || "";
    const jlpt = row["JLPT"]?.trim() || SIN_JLPT;
    const jlptTag = etiquetaJlpt(jlpt);

    const kanjis = extraerKanjis(palabra);
    const kanjiLinks =
      kanjis.length > 0
        ? kanjis.map((k) => `[[kanji/${nombreSeguro(k)}|${k}]]`).join(", ")
        : "Kana puro";

    const md = `---
title: "${yamlStr(palabra)}"
kana: "${yamlStr(kana)}"
jlpt: "${yamlStr(jlpt)}"
tipo: vocabulario
tags:
  - vocabulario${jlptTag ? `\n  - ${jlptTag}` : ""}
---

# ${palabra} (${kana})

> **ES:** ${es || "—"}  
> **EN:** ${en || "—"}

**Kanjis:** ${kanjiLinks}

**JLPT:** ${jlpt}
${bloqueCampos(row, CAMPOS_VOCAB)}`;
    escribirSiCambio(path.join(CONTENT_DIR, "vocab", `${nombreSeguro(palabra)}.md`), md);
  });

  // 3. Sin index.md en kanji/, vocab/ ni componentes/:
  //    un índice con wikilinks a miles de notas satura el graph.
  //    Quartz genera por su cuenta la lista de cada carpeta.

  // 4. Portada principal
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
