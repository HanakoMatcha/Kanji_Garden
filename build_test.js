import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

// URLs públicas en formato CSV de Google Sheets (Versión TEST)
const URL_VOCAB = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPaoyAEqHNS1o3bsskqc1jwBABpBXGqvxP5c1hA4zBtpgQbWv7dd0pLZqrmo72MtB8H--ppoiYYhDD/pub?gid=654834278&single=true&output=csv";
const URL_KANJI = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPaoyAEqHNS1o3bsskqc1jwBABpBXGqvxP5c1hA4zBtpgQbWv7dd0pLZqrmo72MtB8H--ppoiYYhDD/pub?gid=1745742637&single=true&output=csv";

const MI_BASE_URL = "HanakoMatcha.github.io/Kanji_Garden";
const CONTENT_DIR = "./content";

// Crear carpetas de destino si no existen
["vocab", "kanji", "componentes"].forEach((dir) => {
  const p = path.join(CONTENT_DIR, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// 1. Limpieza de texto: remueve saltos de línea invisibles, caracteres de retorno (\r) y espacios
function limpiarTexto(cadena) {
  if (!cadena) return "";
  return String(cadena)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}

// 2. Limpieza para YAML Frontmatter: una sola línea y comillas escapadas
function escaparYaml(cadena) {
  if (!cadena) return "";
  return limpiarTexto(cadena)
    .replace(/\n+/g, " ")      // Reemplaza saltos de línea internos por espacios
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

// 3. Sanitizar nombres de archivo para el sistema operativo y URLs
function sanitizarNombre(cadena) {
  return limpiarTexto(cadena)
    .replace(/[/\\?%*:|"<>#\s]/g, "_");
}

function escribirSiCambio(ruta, contenidoNuevo) {
  if (fs.existsSync(ruta)) {
    const contenidoViejo = fs.readFileSync(ruta, "utf8");
    if (contenidoViejo === contenidoNuevo) return;
  }
  fs.writeFileSync(ruta, contenidoNuevo, "utf8");
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

async function descargarCsv(url) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const texto = new TextDecoder("utf-8").decode(buffer);
  return parse(texto, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true, // Tolera celdas vacías o irregulares en Google Sheets
    trim: true
  });
}

async function main() {
  const configPath = "./quartz.config.ts";
  if (fs.existsSync(configPath)) {
    let config = fs.readFileSync(configPath, "utf8");
    config = config.replace(/baseUrl:\s*"[^"]*"/, `baseUrl: "${MI_BASE_URL}"`);
    fs.writeFileSync(configPath, config, "utf8");
  }

  // --- SECCIÓN 1: KANJIS ---
  console.log("Descargando BaseKanji TEST desde Sheets...");
  const kanjiRecords = await descargarCsv(URL_KANJI);

  const componentesGlobales = new Set();
  const listaKanjis = [];

  kanjiRecords.forEach((row) => {
    // Tomamos solo el kanji limpio
    const kanjiRaw = limpiarTexto(row["Kanji"]);
    const kanjiMatches = extraerKanjis(kanjiRaw);
    if (kanjiMatches.length === 0) return;
    const kanji = kanjiMatches[0]; // Asegura exactamente 1 carácter kanji limpio

    listaKanjis.push(kanji);

    const onyomi = limpiarTexto(row["Onyomi"]);
    const kunyomi = limpiarTexto(row["Kunyomi"]);
    const significado = limpiarTexto(row["Significado"]);
    const componentesRaw = limpiarTexto(row["Componentes Reales (Completos)"]);
    const kyujitaiRaw = limpiarTexto(row["Kyujitai (Kanji Antiguo)"]);
    const etimologia = limpiarTexto(row["Etimología"]);

    const comps = filtrarComponentesValidos(componentesRaw);
    comps.forEach((c) => componentesGlobales.add(c));

    const compsLinks = comps.length > 0 
      ? comps.map((c) => `[[componentes/${c}|${c}]]`).join(", ") 
      : "Ninguno";
      
    const kyujitaiLink = kyujitaiRaw 
      ? `[[kanji/${kyujitaiRaw}|${kyujitaiRaw}]]` 
      : "Ninguno";

    const md = `---
title: "${escaparYaml(kanji)}"
tags:
  - kanji
---

# ${kanji}

> **${significado || "Sin significado registrado"}**

**On:** ${onyomi || "—"}

**Kun:** ${kunyomi || "—"}

**Kyūjitai:** ${kyujitaiLink}

**Componentes:** ${compsLinks}

---

## Etimología
${etimologia || "Sin datos registrados."}
`;
    escribirSiCambio(path.join(CONTENT_DIR, "kanji", `${kanji}.md`), md);
  });

  // Notas de Componentes individuales
  const listaComponentes = Array.from(componentesGlobales);
  listaComponentes.forEach((comp) => {
    const md = `---
title: "${escaparYaml(comp)}"
tags:
  - componente
---

# Componente: ${comp}

Revisa los enlaces de retroceso (backlinks) o el grafo para ver los kanjis que comparten este componente.
`;
    escribirSiCambio(path.join(CONTENT_DIR, "componentes", `${comp}.md`), md);
  });

  // --- SECCIÓN 2: VOCABULARIO ---
  console.log("Descargando Vocab TEST desde Sheets...");
  const vocabRecords = await descargarCsv(URL_VOCAB);

  const listaVocab = [];

  vocabRecords.forEach((row) => {
    const palabra = limpiarTexto(row["日本語"]);
    if (!palabra) return;

    const kana = limpiarTexto(row["かな"]);
    const en = limpiarTexto(row["English"]);
    const es = limpiarTexto(row["Español"]);
    const jlpt = limpiarTexto(row["JLPT"]) || "Sin nivel JLPT";

    const kanjis = extraerKanjis(palabra);
    const kanjiLinks = kanjis.length > 0 
      ? kanjis.map((k) => `[[kanji/${k}|${k}]]`).join(", ") 
      : "Kana puro";

    const safeFile = sanitizarNombre(palabra);
    listaVocab.push({ palabra, safeFile });

    const md = `---
title: "${escaparYaml(palabra)}"
tags:
  - vocabulario
---

# ${palabra} ${kana ? `(${kana})` : ""}

> **ES:** ${es || "—"}  
> **EN:** ${en || "—"}

**Kanjis:** ${kanjiLinks}

**JLPT:** ${jlpt}
`;
    escribirSiCambio(path.join(CONTENT_DIR, "vocab", `${safeFile}.md`), md);
  });

  // --- SECCIÓN 3: ÍNDICES ---
  const indexKanjiMd = `---
title: "Kanjis"
---

# Índice de Kanjis

Total registrados: ${listaKanjis.length}

${listaKanjis.map((k) => `- [[kanji/${k}\vert{}${k}]]`).join("\n")}
`;
  escribirSiCambio(path.join(CONTENT_DIR, "kanji", "index.md"), indexKanjiMd);

  const indexVocabMd = `---
title: "Vocabulario"
---

# Índice de Vocabulario

Total registrados: ${listaVocab.length}

${listaVocab.map((v) => `- [[vocab/${v.safeFile}\vert{}${v.palabra}]]`).join("\n")}
`;
  escribirSiCambio(path.join(CONTENT_DIR, "vocab", "index.md"), indexVocabMd);

  const indexCompMd = `---
title: "Componentes"
---

# Índice de Componentes

Total registrados: ${listaComponentes.length}

${listaComponentes.map((c) => `- [[componentes/${c}\vert{}${c}]]`).join("\n")}
`;
  escribirSiCambio(path.join(CONTENT_DIR, "componentes", "index.md"), indexCompMd);

  // --- SECCIÓN 4: PORTADA ---
  const indexMd = `---
title: "Inicio"
---

# Jardín Digital de Kanji y Vocabulario

Base de datos interconectada desde Google Sheets.

- [[kanji/index|📚 Ver Kanjis]]
- [[vocab/index|📖 Ver Vocabulario]]
- [[componentes/index|🧩 Ver Componentes y Radicales]]
`;
  escribirSiCambio(path.join(CONTENT_DIR, "index.md"), indexMd);

  console.log("¡Archivos generados y sanitizados con éxito!");
}

main();
