import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// Componentes compartidos en todas las páginas (encabezado y pie de página)
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

// Layout para páginas de contenido individuales (notas de kanji, artículos)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.ContentMeta(),
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
    // Si no es carpeta y está dentro de vocab o kanji, no lo metas al árbol
    if (!node.isFolder && (node.slug?.startsWith("vocab/") || node.slug?.startsWith("kanji/"))) {
      return false
    }
    return true
  },
}),
  ],
  right: [
    // Component.Graph() desactivado: previene el colapso por cálculo de físicas D3
    Component.DesktopOnly(Component.TableOfContents()),
    // Component.Backlinks() desactivado temporalmente para reducir cálculos en cliente
  ],
}

// Layout para páginas de listas, carpetas y etiquetas
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.ContentMeta(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search({
      enableHover: false,
      showPreview: false,
    }),
    Component.Darkmode(),
  ],
  right: [],
}
