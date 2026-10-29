import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// Componente visual y analítico para GoatCounter
const GoatCounterWidget: Component.QuartzComponent = () => {
  return (
    <div class="goatcounter-widget" style={{ marginTop: "1.5rem", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--lightgray)", background: "rgba(255, 255, 255, 0.02)", textAlign: "center" }}>
      <div style={{ fontSize: "0.75rem", color: "var(--gray)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "1px" }}>Visitas</div>
      <div id="stats-visitas" style={{ fontSize: "1.1rem", fontWeight: "bold", color: "var(--secondary)" }}>
        <span id="gc-counter">...</span>
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
            function actualizarContador() {
              if (window.goatcounter && window.goatcounter.count) {
                window.goatcounter.count({
                  path: location.pathname + location.search + location.hash,
                });
              }
              const elem = document.getElementById('gc-counter');
              if (elem) {
                fetch('https://kanjigarden.goatcounter.com/counter/' + encodeURIComponent(location.pathname) + '.json')
                  .then(r => r.json())
                  .then(d => { elem.innerText = d.count || '1'; })
                  .catch(() => { elem.innerText = '—'; });
              }
            }
            document.addEventListener('nav', actualizarContador);
            document.addEventListener('DOMContentLoaded', actualizarContador);
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
    Component.DesktopOnly(Component.Graph()),
    GoatCounterWidget,
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
    GoatCounterWidget,
  ],
  right: [
    Component.Backlinks(),
  ],
}
