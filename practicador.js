// Practicador de trazo (HanziWriter). El workflow lo inyecta en el <head> de todas
// las páginas con data-persist, así sobrevive a la navegación SPA de Quartz y se
// reactiva con el evento "nav". Editar aquí, no en build_test.js.
(function () {
  if (window.__kanjiPracticador) { window.__kanjiPracticador(false); return; }
  function paleta() {
    var de = document.documentElement;
    var oscuro = de.getAttribute('saved-theme') === 'dark' || de.getAttribute('theme') === 'dark' ||
      de.classList.contains('dark') || (document.body && document.body.classList.contains('dark'));
    return oscuro
      ? { background: '#231634', strokeColor: '#f5f0fb', outlineColor: '#4d3b63', drawingColor: '#ff4fd8', radicalColor: '#5dff9a' }
      : { background: '#ffffff', strokeColor: '#3e2a1e', outlineColor: '#bfae93', drawingColor: '#d64d7c', radicalColor: '#6a8f58' };
  }
  function iniciar(forzar) {
    var cajas = document.querySelectorAll('.kanji-quiz-container');
    if (!cajas.length) return;
    if (typeof HanziWriter === 'undefined') { setTimeout(function () { iniciar(forzar); }, 60); return; }
    cajas.forEach(function (caja) {
      if (caja.dataset.ready && !forzar) return;
      var kanji = caja.getAttribute('data-kanji');
      var destino = caja.querySelector('.kanji-writer-target');
      if (!kanji || !destino) return;
      caja.dataset.ready = 'true';
      destino.innerHTML = '';
      var p = paleta();
      destino.style.backgroundColor = p.background;
      var w = HanziWriter.create(destino, kanji, {
        width: 180, height: 180, padding: 12, showOutline: true, showCharacter: true,
        strokeAnimationSpeed: 1.2, delayBetweenStrokes: 120,
        strokeColor: p.strokeColor, outlineColor: p.outlineColor, drawingColor: p.drawingColor,
        radicalColor: p.radicalColor, highlightColor: p.drawingColor
      });
      var bq = caja.querySelector('.btn-quiz-start');
      var ba = caja.querySelector('.btn-quiz-animate');
      var br = caja.querySelector('.btn-quiz-reset');
      if (bq) bq.onclick = function () { w.quiz({ showOutline: true, showHintAfterMisses: 1 }); };
      if (ba) ba.onclick = function () { w.animateCharacter(); };
      if (br) br.onclick = function () { w.cancelQuiz(); w.showCharacter(); w.showOutline(); };
    });
  }
  window.__kanjiPracticador = iniciar;
  document.addEventListener('nav', function () { iniciar(false); });
  new MutationObserver(function () { iniciar(true); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['saved-theme', 'theme'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { iniciar(false); });
  else iniciar(false);
})();
