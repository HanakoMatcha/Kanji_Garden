import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

// URLs públicas en formato CSV de Google Sheets (Versión TEST)
const URL_VOCAB = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPaoyAEqHNS1o3bsskqc1jwBABpBXGqvxP5c1hA4zBtpgQbWv7dd0pLZqrmo72MtB8H--ppoiYYhDD/pub?gid=654834278&single=true&output=csv";
const URL_KANJI = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRPaoyAEqHNS1o3bsskqc1jwBABpBXGqvxP5c1hA4zBtpgQbWv7dd0pLZqrmo72MtB8H--ppoiYYhDD/pub?gid=1745742637&single=true&output=csv";

// RUTA DE GITHUB (sin https:// ni barra final)
const MI_BASE_URL = "HanakoMatcha.github.io/Kanji_Garden";

const CONTENT_DIR = "./content";

// Crear carpetas de destino
["vocab", "kanji", "componentes"].forEach((dir) => {
  const p = path.join(CONTENT_DIR, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

function escaparYaml(cadena) {
  if (!cadena) return "";
  return cadena.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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

async function main() {
  const configPath = "./quartz.config.ts";
  if (fs.existsSync(configPath)) {
    console.log("Configurando baseUrl en quartz.config.ts...");
    let config = fs.readFileSync(configPath, "utf8");
    config = config.replace(/baseUrl:\s*"[^"]*"/, `baseUrl: "${MI_BASE_URL}"`);
    fs.writeFileSync(configPath, config, "utf8");
  }

  // 1. Descargar y procesar BaseKanji TEST
  console.log("Descargando BaseKanji TEST...");
  const resKanji = await fetch(URL_KANJI);
  const textKanji = await resKanji.text();
  const kanjiRecords = parse(textKanji, { columns: true, skip_empty_lines: true });

  const componentesGlobales = new Set();
  const listaKanjis = [];

  kanjiRecords.forEach((row) => {
    const kanji = row["Kanji"]?.trim();
    if (!kanji) return;

    listaKanjis.push(kanji);

    const onyomi = row["Onyomi"]?.trim() || "";
    const kunyomi = row["Kunyomi"]?.trim() || "";
    const significado = row["Significado"]?.trim() || "";
    const componentesRaw = row["Componentes Reales (Completos)"] || "";
    const kyujitai = row["Kyujitai (Kanji Antiguo)"]?.trim() || "";
    const etimologia = row["Etimología"]?.trim() || "";

    const comps = filtrarComponentesValidos(componentesRaw);
    comps.forEach((c) => componentesGlobales.add(c));

    const compsLinks = comps.length > 0 
      ? comps.map((c) => `[[componentes/${c}|${c}]]`).join(", ") 
      : "Ninguno";
    const kyujitaiLink = kyujitai ? `[[kanji/${kyujitai}|${kyujitai}]]` : "None";

    const md = `---
title: "${escaparYaml(kanji)}"
tipo: kanji
onyomi: "${escaparYaml(onyomi)}"
kunyomi: "${escaparYaml(kunyomi)}"
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
`;
    escribirSiCambio(path.join(CONTENT_DIR, "kanji", `${kanji}.md`), md);
  });

  // Notas individuales de componentes válidos
  const listaComponentes = Array.from(componentesGlobales);
  listaComponentes.forEach((comp) => {
    const md = `---
title: "${escaparYaml(comp)}"
tipo: componente
tags:
  - radical
---
# Componente: ${comp}

Revisa los backlinks para ver kanjis con este componente.
`;
    escribirSiCambio(path.join(CONTENT_DIR, "componentes", `${comp}.md`), md);
  });

  // 2. Descargar y procesar Vocab TEST
  console.log("Descargando Vocab TEST...");
  const resVocab = await fetch(URL_VOCAB);
  const textVocab = await resVocab.text();
  const vocabRecords = parse(textVocab, { columns: true, skip_empty_lines: true });

  const listaVocab = [];

  vocabRecords.forEach((row) => {
    const palabra = row["日本語"]?.trim();
    if (!palabra) return;

    const kana = row["かな"]?.trim() || "";
    const en = row["English"]?.trim() || "";
    const es = row["Español"]?.trim() || "";
    const jlpt = row["JLPT"]?.trim() || "Sin nivel JLPT";

    const kanjis = extraerKanjis(palabra);
    const kanjiLinks = kanjis.length > 0 
      ? kanjis.map((k) => `[[kanji/${k}|${k}]]`).join(", ") 
      : "Kana puro";

    const md = `---
title: "${escaparYaml(palabra)}"
kana: "${escaparYaml(kana)}"
tipo: vocabulario
tags:
  - vocabulario
---

# ${palabra} (${kana})

> **ES:** ${es || "—"}  
> **EN:** ${en || "—"}

**Kanjis:** ${kanjiLinks}

**JLPT:** ${jlpt}
`;
    const safeName = palabra.replace(/[/\\?%*:|"<>]/g, "_");
    listaVocab.push({ palabra, safeName });
    escribirSiCambio(path.join(CONTENT_DIR, "vocab", `${safeName}.md`), md);
  });

  // 3. Crear índices con Wikilinks compatibles con Quartz
  const indexKanjiMd = `---
title: "Kanji"
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

${listaVocab.map((v) => `- [[vocab/${v.safeName}\vert{}${v.palabra}]]`).join("\n")}
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

  // 4. Portada principal
  const indexMd = `---
title: "Inicio"
---

# Jardín Digital de Kanji y Vocabulario

Base de datos viva interconectada a partir de Google Sheets.

- [[kanji/index|Explorar Kanjis]]
- [[vocab/index|Explorar Vocabulario]]
- [[componentes/index|Explorar Componentes y Radicales]]
`;
  escribirSiCambio(path.join(CONTENT_DIR, "index.md"), indexMd);

  console.log("¡Notas e índices generados con éxito!");
}

main();
