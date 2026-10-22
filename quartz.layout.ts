import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
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
    Component.CategoryFilters(), // <-- Inyectado aquí también
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
        // Oculta archivos individuales dentro de vocab y kanji en la barra
        if (!node.isFolder && (node.slug?.startsWith("vocab/") || node.slug?.startsWith("kanji/"))) {
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
    Component.CategoryFilters(), // <-- Inyectado aquí
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
