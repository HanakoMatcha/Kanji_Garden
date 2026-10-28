import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

const config: QuartzConfig = {
  configuration: {
    pageTitle: "Jardín de Kanji y Léxico",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: false, // Desactivado para evitar memory leaks por miles de pre-fetches
    analytics: null,
    locale: "es-ES",
    baseUrl: "HanakoMatcha.github.io/Kanji_Garden",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "created",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Schibsted Grotesk",
        body: "Source Sans Pro",
        code: "IBM Plex Mono",
      },
      colors: {
        lightMode: {
          light: "#f7f5ee",       // fondo
          lightgray: "#e3e6d8",   // bordes
          gray: "#a9b39b",        // texto atenuado
          darkgray: "#4a5a45",    // texto del cuerpo
          dark: "#2a3328",        // títulos
          secondary: "#5b7f4f",   // enlaces
          tertiary: "#9bb585",    // enlaces al pasar el cursor
          highlight: "rgba(91, 127, 79, 0.15)",
          textHighlight: "#e8e06088",
        },
        darkMode: {
          light: "#1a1f18",
          lightgray: "#2e3629",
          gray: "#5c6b55",
          darkgray: "#cdd6c4",
          dark: "#eef2e8",
          secondary: "#9bbf8a",
          tertiary: "#c4d6a8",
          highlight: "rgba(155, 191, 138, 0.15)",
          textHighlight: "#b3aa0288",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: false,          // Desactivado para no generar XMLs gigantescos
        includeEmptyFiles: false,
        rssFullHtml: false,
        rssLimit: 50,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.NotFoundPage(),
    ],
  },
}

export default config
