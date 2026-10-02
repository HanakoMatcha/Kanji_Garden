// 3. Crear índices para cada carpeta
  const indexKanjiMd = `---
title: "Kanjis"
enableToc: false
---
# Índice de Kanjis

Total registrados: ${listaKanjis.length}

${listaKanjis.map((k) => `- [${k}](./${encodeURIComponent(k)})`).join("\n")}
`;
  escribirSiCambio(path.join(CONTENT_DIR, "kanji", "index.md"), indexKanjiMd);

  const indexVocabMd = `---
title: "Vocabulario"
enableToc: false
---
# Índice de Vocabulario

Total registrados: ${listaVocab.length}

${listaVocab.map((v) => {
  const safe = v.replace(/[/\\?%*:|"<>]/g, "_");
  return `- [${v}](./${encodeURIComponent(safe)})`;
}).join("\n")}
`;
  escribirSiCambio(path.join(CONTENT_DIR, "vocab", "index.md"), indexVocabMd);

  const indexCompMd = `---
title: "Componentes"
enableToc: false
---
# Índice de Componentes

Total registrados: ${listaComponentes.length}

${listaComponentes.map((c) => `- [${c}](./${encodeURIComponent(c)})`).join("\n")}
`;
  escribirSiCambio(path.join(CONTENT_DIR, "componentes", "index.md"), indexCompMd);
