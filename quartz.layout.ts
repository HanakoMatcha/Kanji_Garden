import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

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
        Visitas
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

// Practicador de trazo: inicializa HanziWriter en cada .kanji-quiz-container.
// Va como afterDOMLoaded para que Quartz lo incluya en todas las páginas y
// se vuelva a ejecutar en cada navegación SPA (evento "nav").
const KanjiWriterInit: Component.QuartzComponent = () => null
KanjiWriterInit.afterDOMLoaded = `
(function () {
  function loadHanziWriter(cb) {
    if (window.HanziWriter) return cb();
    var existing = document.getElementById('hanzi-writer-cdn');
    if (existing) { existing.addEventListener('load', cb); return; }
    var s = document.createElement('script');
    s.id = 'hanzi-writer-cdn';
    s.src = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.7/dist/hanzi-writer.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  function getThemePalette() {
    var de = document.documentElement;
    var isDark = de.getAttribute('saved-theme') === 'dark' ||
                 de.getAttribute('theme') === 'dark' ||
                 de.classList.contains('dark') ||
                 (document.body && document.body.classList.contains('dark'));
    return isDark ? {
      background: '#231634', strokeColor: '#f5f0fb', outlineColor: '#4d3b63',
      drawingColor: '#ff4fd8', radicalColor: '#5dff9a'
    } : {
      background: '#ffffff', strokeColor: '#3e2a1e', outlineColor: '#bfae93',
      drawingColor: '#d64d7c', radicalColor: '#6a8f58'
    };
  }

  function initAllKanjiWriters(force) {
    var containers = document.querySelectorAll('.kanji-quiz-container');
    if (!containers.length) return;
    loadHanziWriter(function () {
      containers.forEach(function (container) {
        if (container.dataset.ready && !force) return;
        var kanji = container.getAttribute('data-kanji');
        var target = container.querySelector('.kanji-writer-target');
        if (!kanji || !target) return;
        container.dataset.ready = 'true';

        target.innerHTML = '';
        var p = getThemePalette();
        target.style.backgroundColor = p.background;

        var writer = HanziWriter.create(target, kanji, {
          width: 180, height: 180, padding: 12,
          showOutline: true, showCharacter: true,
          strokeAnimationSpeed: 1.2, delayBetweenStrokes: 120,
          strokeColor: p.strokeColor, outlineColor: p.outlineColor,
          drawingColor: p.drawingColor, radicalColor: p.radicalColor,
          highlightColor: p.drawingColor
        });

        var btnQuiz = container.querySelector('.btn-quiz-start');
        var btnAnim = container.querySelector('.btn-quiz-animate');
        var btnReset = container.querySelector('.btn-quiz-reset');
        if (btnQuiz) btnQuiz.onclick = function () { writer.quiz({ showOutline: true, showHintAfterMisses: 1 }); };
        if (btnAnim) btnAnim.onclick = function () { writer.animateCharacter(); };
        if (btnReset) btnReset.onclick = function () {
          writer.cancelQuiz(); writer.showCharacter(); writer.showOutline();
        };
      });
    });
  }

  // Quartz dispara "nav" en la carga inicial y en cada navegación SPA
  document.addEventListener('nav', function () { initAllKanjiWriters(false); });

  // Repintar con la paleta correcta al cambiar de tema
  if (!window.__kanjiThemeObserver) {
    window.__kanjiThemeObserver = new MutationObserver(function () { initAllKanjiWriters(true); });
    window.__kanjiThemeObserver.observe(document.documentElement, {
      attributes: true, attributeFilter: ['saved-theme', 'theme']
    });
  }
})();
`

export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [KanjiWriterInit],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/HanakoMatcha/Kanji_Garden",
    },
  }),
}

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
