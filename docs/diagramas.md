# Kanji Garden: diagramas del proyecto

Seis diagramas, de lo general a lo concreto:

1. [Arquitectura general](#1-arquitectura-general): de dónde salen los datos y adónde llegan
2. [Despliegue (GitHub Actions)](#2-despliegue-github-actions-deployyml): `deploy.yml`, paso a paso
3. [Pipeline de generación](#3-pipeline-de-generación-build_testjs): qué hace `build_test.js`
4. [Modelo de contenido](#4-modelo-de-contenido-y-enlaces-del-grafo): tipos de página y cómo se enlazan
5. [Comportamiento en el navegador](#5-comportamiento-en-el-navegador-scripts-inyectados): los tres scripts inyectados
6. [Mapa del repositorio](#6-mapa-del-repositorio): qué archivo se usa y cuál es legado

---

## 1. Arquitectura general

```mermaid
flowchart LR
    subgraph Fuentes["Fuentes de datos"]
        GS_K[("Google Sheets<br/>Kanji")]
        GS_V[("Google Sheets<br/>Vocabulario")]
        GS_G[("Google Sheets<br/>Gramática")]
        ASSETS[("Repo kanjium-assets<br/>imágenes de caligrafía")]
    end

    subgraph CI["GitHub Actions: deploy.yml<br/>(diario 04:00 UTC o manual)"]
        BUILD["build_test.js<br/>CSV → Markdown"]
        QUARTZ["Quartz (commit fijado)<br/>Markdown → HTML"]
        POST["Post-proceso<br/>inyección de scripts<br/>+ contentIndex.json"]
        BUILD --> QUARTZ --> POST
    end

    subgraph Web["GitHub Pages<br/>hanakomatcha.github.io/Kanji_Garden"]
        SITE["Sitio estático<br/>kanji · vocab · componentes<br/>gramática · colecciones"]
    end

    subgraph Navegador["Navegador del visitante"]
        PRAC["practicador.js"]
        CAT["catalogo.js"]
        VIS["visitas.js"]
    end

    GS_K & GS_V & GS_G -->|CSV público| BUILD
    ASSETS -->|"GitHub Trees API<br/>(índice de imágenes)"| BUILD
    POST --> SITE
    SITE --> Navegador

    JSD["jsDelivr CDN"] -.->|imágenes kanjium| SITE
    JSD -.->|hanzi-writer| PRAC
    GC["GoatCounter"] <-.->|conteo de visitas| VIS
    CAT -.->|"static/catalogos/*.json"| SITE
```

---

## 2. Despliegue (GitHub Actions: `deploy.yml`)

Tres jobs. El primero calcula una huella (hojas + código) y evita reconstruir si nada ha cambiado.

```mermaid
flowchart TD
    T1(["cron diario 04:00 UTC"]) --> R
    T2(["workflow_dispatch<br/>(opción forzar)"]) --> R

    subgraph R["Job 1: revisar"]
        R1["Descargar las 3 hojas CSV<br/>→ sha256"] --> R3
        R2["hashFiles: build_test.js, practicador.js,<br/>catalogo.js, visitas.js, deploy.yml,<br/>quartz.layout.ts, quartz.config.ts"] --> R3
        R3["huella = datos + código"] --> R4{"¿Existe marca en caché<br/>con esa huella?<br/>(o forzar = true)"}
    end

    R4 -->|"sí, sin forzar"| SKIP(["Fin: nada que publicar"])
    R4 -->|"no / forzar"| B1

    subgraph B["Job 2: construir"]
        B1["Clonar Quartz (QUARTZ_REF)<br/>conservando archivos propios"] --> B2["npm ci (con caché)"]
        B2 --> B3["Limpiar content/, catalogos/, .quartz-cache"]
        B3 --> B4["node build_test.js<br/>→ content/*.md + catalogos/*.json"]
        B4 --> B5["Ajustar config YAML con sed:<br/>baseUrl, título, paleta, graph,<br/>og-image off, favicon, Explorer off"]
        B5 --> B6["Inyectar estilos en custom.scss"]
        B6 --> B7["npx quartz build → public/"]
        B7 --> B8["Copiar catalogos/*.json<br/>→ public/static/catalogos/"]
        B8 --> B9["Inyectar en el head de cada HTML:<br/>hanzi-writer + practicador.js<br/>+ catalogo.js + visitas.js<br/>y firma en el footer"]
        B9 --> B10["Optimizar contentIndex.json<br/>(quitar content, añadir<br/>entradas gemelas de carpeta)"]
        B10 --> B11["upload-pages-artifact"]
    end

    B11 --> D1

    subgraph D["Job 3: desplegar"]
        D1["deploy-pages → GitHub Pages"] --> D2["Guardar marca con la huella<br/>en actions/cache"]
    end

    D2 --> FIN(["Sitio publicado"])
```

---

## 3. Pipeline de generación (`build_test.js`)

Refleja el generador actual: incluye gramática, las colecciones Kyūjitai/Hyōgaiji y los JSON de catálogo.

```mermaid
flowchart TD
    START(["main()"]) --> INIT["Crear content/{vocab, kanji,<br/>componentes, colecciones, gramatica}"]
    INIT --> IMG["cargarIndiceImagenes()<br/>GitHub Trees API → Map indiceImagenes"]

    IMG --> K1
    subgraph E1["1 · Kanji"]
        K1["fetch CSV Kanji → parse"] --> K2["Por fila: lecturas on/kun, significado,<br/>componentes, kyūjitai, etimología,<br/>flags Jōyō/Jinmeiyō/Hyōgaiji/Kyūjitai, JLPT"]
        K2 --> K3["tags + colecciones<br/>(joyo, jinmeiyo, kyuujitai,<br/>hyougaiji, jlpt-n1…n5)"]
        K3 --> K4["componentesGlobales.add()"]
        K4 --> K5["seccionPracticadorKanji()<br/>seccionImagenes()<br/>limpiarEtimologiaWiktionary()"]
        K5 --> K6["kanji/&lt;k&gt;.md"]
        K6 --> K7["generarCatalogoPaginado(/kanji)<br/>con filtros"]
    end

    K7 --> C1
    subgraph E2["2 · Componentes"]
        C1["Recorrer componentesGlobales"] --> C2["componentes/&lt;c&gt;.md<br/>+ seccionImagenes()"]
        C2 --> C3["generarCatalogoPaginado(/componentes)"]
    end

    C3 --> V1
    subgraph E3["3 · Vocabulario"]
        V1["fetch CSV Vocab → parse"] --> V2["Glosas ES · EN · FR · DE<br/>· 繁 · 简 · pinyin; JLPT"]
        V2 --> V3["extraerKanjis() → [[kanji/…]]"]
        V3 --> V4["vocab/&lt;palabra&gt;.md"]
        V4 --> V5["generarCatalogoPaginado(/vocab)<br/>con filtros"]
    end

    V5 --> G1
    subgraph E4["4 · Gramática (try/catch: un fallo no tumba el resto)"]
        G1["fetch CSV Gramática → parse"] --> G2["limpiarTextoGramatica()<br/>escaparMd() · tipo → español"]
        G2 --> G3["Enlaces solo a páginas existentes:<br/>[[kanji/…]] y [[vocab/…]]"]
        G3 --> G4["gramatica/&lt;slug&gt;.md"]
        G4 --> G5["Catálogo /gramatica (orden N5→N1)<br/>+ colecciones/gramatica-n1…n5"]
    end

    G5 --> L1
    subgraph E5["5 · Colecciones"]
        L1["Por cada colección de kanji"] --> L2["generarCatalogoPaginado<br/>(/colecciones/&lt;clave&gt;)"]
    end

    L2 --> H1
    subgraph E6["6 · Portada"]
        H1["Dashboard con conteos,<br/>chips JLPT y taxonomías"] --> H2["content/index.md"]
    end

    H2 --> FIN(["Fin"])

    subgraph GEN["generarCatalogoPaginado()"]
        direction LR
        P1["Trocear en páginas de 50"] --> P2["index.md, pagina-2.md…<br/>+ renderBarraPaginacion()"]
        P1 --> P3["Si hay filtros:<br/>catalogos/&lt;id&gt;.json<br/>con todas las entradas"]
    end

    K7 -.-> GEN
    V5 -.-> GEN
    G5 -.-> GEN
    L2 -.-> GEN
```

Todas las escrituras pasan por `escribirSiCambio()`, que solo toca el disco si el contenido ha cambiado.

---

## 4. Modelo de contenido y enlaces del grafo

Tipos de página que genera el build y los wikilinks entre ellas (son los que dibujan el grafo y los backlinks de Quartz).

```mermaid
erDiagram
    KANJI {
        string caracter PK
        string onyomi
        string kunyomi
        string significado
        string etimologia
        string jlpt
        bool joyo
        bool jinmeiyo
        bool hyougaiji
        bool kyuujitai
    }
    COMPONENTE {
        string caracter PK
        string significado
    }
    VOCAB {
        string palabra PK
        string kana
        string es_en_fr_de
        string chino_pinyin
        string jlpt
    }
    GRAMATICA {
        string slug PK
        string punto
        string lectura
        string tipo
        string jlpt
        string explicacion
        string ejemplos
    }
    COLECCION {
        string clave PK "joyo, jinmeiyo, kyuujitai, hyougaiji, jlpt-nX, gramatica-nX"
    }
    IMAGEN {
        string estilo "origin, tensho, gyosho, sousho, kso"
    }

    KANJI }o--o{ COMPONENTE : "se compone de"
    KANJI |o--o| KANJI : "forma kyūjitai"
    VOCAB }o--o{ KANJI : "contiene"
    GRAMATICA }o--o{ KANJI : "contiene"
    GRAMATICA }o--o{ VOCAB : "relacionada con"
    COLECCION }o--o{ KANJI : "agrupa"
    COLECCION }o--o{ GRAMATICA : "agrupa"
    KANJI ||--o{ IMAGEN : "muestra"
    COMPONENTE ||--o{ IMAGEN : "muestra"
```

---

## 5. Comportamiento en el navegador (scripts inyectados)

Los tres scripts se inyectan con `data-persist` para sobrevivir a la navegación SPA de Quartz y se reactivan con el evento `nav`.

```mermaid
sequenceDiagram
    actor U as Visitante
    participant Q as Quartz SPA
    participant P as practicador.js
    participant C as catalogo.js
    participant V as visitas.js
    participant S as GitHub Pages
    participant GC as GoatCounter
    participant CDN as jsDelivr

    U->>Q: abre o navega a una página
    Q-->>P: evento "nav"
    Q-->>C: evento "nav"
    Q-->>V: evento "nav"

    Note over P,CDN: Ficha de kanji
    P->>CDN: hanzi-writer (ya cargado en el head)
    P->>P: HanziWriter.create() en .kanji-quiz-container
    U->>P: Practicar / Animar / Reiniciar
    P-->>U: quiz de trazos (paleta según tema claro/oscuro)

    Note over C,S: Página de catálogo
    U->>C: pulsa chips (p. ej. N1 + Partícula)
    C->>S: GET static/catalogos/<id>.json (una vez, en caché)
    S-->>C: todas las entradas [tags, html]
    C->>C: filtra (OR dentro del grupo, AND entre grupos)<br/>y repagina de 50 en 50
    C->>Q: history.replaceState(?f=…&p=…)
    C-->>U: tarjetas filtradas + barra de paginación
    alt el JSON falla
        C-->>U: filtra solo las tarjetas de la página actual
    end

    Note over V,GC: Todas las páginas
    V->>GC: goatcounter.count(ruta)
    V->>GC: GET /counter/TOTAL.json (y otra vez a los 6 s)
    GC-->>V: total de visitas
    V-->>U: caja "Visitas" en la barra lateral
```

---

## 6. Mapa del repositorio

```mermaid
flowchart LR
    subgraph Activo["En uso por el workflow"]
        WF[".github/workflows/deploy.yml"]
        BT["build_test.js<br/>(generador actual)"]
        PJ["practicador.js"]
        CJ["catalogo.js"]
        VJ["visitas.js"]
        FAV["favicon.png"]
        QC["quartz.config.ts"]
        QL["quartz.layout.ts"]
    end

    subgraph Legado["Legado o sin uso aparente"]
        BG["build-garden.js<br/>(versión anterior, sin gramática)"]
        CF["quartz/components/CategoryFilters.tsx<br/>(filtros antiguos, sustituidos por catalogo.js)"]
        KI["kanji/index.md · vocab/index.md<br/>(se regeneran en content/)"]
        HF["hana_favicon.png"]
    end

    subgraph Docs["Documentación"]
        D4["docs/diagramas.md"]
    end

    WF -->|ejecuta| BT
    WF -->|inyecta en el head| PJ & CJ & VJ
    WF -->|copia como icono| FAV
    WF -->|hash de cambios| QC & QL
    BG -.->|evolucionó a| BT
    CF -.->|sustituido por| CJ
    D4 -.->|describe| BT
```
