import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// Componente para inyectar GoatCounter con soporte SPA (Quartz 'nav')
const GoatCounter: Component.QuartzComponent = () => {
  return (
    <>
      <script
        data-goatcounter="https://kanjigarden.goatcounter.com/count"
        data-goatcounter-settings='{"allow_local": false}'
        async
        src="//gc.zgo.at/count.js"
      ></script>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('nav', () => {
              if (window.goatcounter && window.goatcounter.count) {
                window.goatcounter.count({
                  path: location.pathname + location.search + location.hash,
                });
              }
            });
          `,
        }}
      ></script>
    </>
  )
}

export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [GoatCounter],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/HanakoMatcha/Kanji_Garden",
    },
  }),
}

// Para páginas individuales Y para carpetas con index.md
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.CategoryFilters(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search({
      enableHover: false,
      showPreview: false,
    }),
    Component.Darkmode(),
    Component.Explorer({
      title: "Explorador",
      folderDefaultState: "collapsed",
      useSavedFolderState: false,
      filterFn: (node) => {
        // Si no es carpeta y está dentro de vocab, kanji o componentes, no lo metas al árbol
        if (!node.isFolder) {
          return false
        }
        return true
      },
    }),
  ],
  right: [
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// Para carpetas automáticas sin index.md y etiquetas
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.CategoryFilters(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search({
      enableHover: false,
      showPreview: false,
    }),
    Component.Darkmode(),
    Component.Explorer({
      title: "Explorador",
      folderDefaultState: "collapsed",
      useSavedFolderState: false,
      filterFn: (node) => {
        if (!node.isFolder && (node.slug?.startsWith("vocab/") || node.slug?.startsWith("kanji/"))) {
          return false
        }
        return true
      },
    }),
  ],
  right: [],
}
