import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// Componente visual de GoatCounter para la barra lateral izquierda
const GoatCounterWidget: Component.QuartzComponent = () => {
  return (
    <div
      class="goatcounter-box"
      style={{
        marginTop: "1.5rem",
        padding: "12px 14px",
        borderRadius: "10px",
        border: "1px solid var(--lightgray)",
        background: "rgba(255, 255, 255, 0.02)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "0.72rem",
          letterSpacing: "1px",
          color: "var(--gray)",
          textTransform: "uppercase",
          fontWeight: "600",
          marginBottom: "6px",
        }}
      >
        Visitas del sitio
      </div>
      <div
        id="gc-stats-count"
        style={{
          fontSize: "1.3rem",
          fontWeight: "bold",
          color: "var(--secondary)",
          minHeight: "1.5rem",
        }}
      >
        ...
      </div>
      <script
        data-goatcounter="https://kanjigarden.goatcounter.com/count"
        data-goatcounter-settings='{"allow_local": false}'
        async
        src="//gc.zgo.at/count.js"
      ></script>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            function actualizarGoatCounter() {
              if (window.goatcounter && window.goatcounter.count) {
                window.goatcounter.count({
                  path: location.pathname + location.search + location.hash,
                });
              }
              const display = document.getElementById('gc-stats-count');
              if (display) {
                fetch('https://kanjigarden.goatcounter.com/counter/' + encodeURIComponent(location.pathname) + '.json')
                  .then(res => res.json())
                  .then(data => {
                    display.innerText = data.count || '1';
                  })
                  .catch(() => {
                    display.innerText = '—';
                  });
              }
            }
            document.addEventListener('nav', actualizarGoatCounter);
            document.addEventListener('DOMContentLoaded', actualizarGoatCounter);
          `,
        }}
      ></script>
    </div>
  )
}

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

// Páginas de contenido e índices de carpetas (index.md)
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
    GoatCounterWidget,
  ],
  right: [
    Component.DesktopOnly(Component.Graph()),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// Carpetas automáticas sin index.md y páginas de tags
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
    GoatCounterWidget,
  ],
  right: [
    Component.DesktopOnly(Component.Graph()),
    Component.Backlinks(),
  ],
}
