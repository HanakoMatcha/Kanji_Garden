// Contador de visitas (GoatCounter) bajo la barra de búsqueda.
// Se inyecta en el <head> de todas las páginas desde deploy.yml.
(function () {
  if (window.__kanjiVisitas) return;
  window.__kanjiVisitas = true;

  var GC = "https://kanjigarden.goatcounter.com";
  var ultimaRuta = null;

  function contar() {
    var ruta = location.pathname;
    if (ruta === ultimaRuta) return;
    if (!(window.goatcounter && window.goatcounter.count)) return;
    ultimaRuta = ruta;
    window.goatcounter.count({ path: ruta });
  }

  function crearCaja() {
    var caja = document.createElement("a");
    caja.id = "kg-visitas";
    caja.href = GC + "/";
    caja.target = "_blank";
    caja.rel = "noopener";
    caja.title = "Ver estadísticas (países, páginas, navegadores…)";
    caja.innerHTML =
      '<span class="kg-visitas-etiqueta">Visitas</span>' +
      '<span class="kg-visitas-num">…</span>';
    return caja;
  }

  function colocar() {
    var lateral = document.querySelector(".left.sidebar") || document.querySelector(".sidebar.left");
    if (!lateral) return null;
    var caja = document.getElementById("kg-visitas");
    if (!caja || !lateral.contains(caja)) {
      if (caja) caja.remove();
      caja = crearCaja();
      var busqueda = lateral.querySelector(".search");
      // Hijo directo del lateral que contiene la búsqueda (fila búsqueda + modo oscuro).
      var fila = busqueda;
      while (fila && fila.parentElement !== lateral) fila = fila.parentElement;
      if (fila && fila.nextSibling) lateral.insertBefore(caja, fila.nextSibling);
      else lateral.appendChild(caja);
    }
    return caja;
  }

  function actualizar() {
    var caja = colocar();
    contar();
    if (!caja) return;
    var num = caja.querySelector(".kg-visitas-num");
    fetch(GC + "/counter/TOTAL.json")
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) { num.textContent = d.count || "0"; })
      .catch(function () { num.textContent = "—"; });
  }

  // Estilos
  var css = document.createElement("style");
  css.textContent =
    "#kg-visitas{display:flex;align-items:center;justify-content:space-between;gap:8px;" +
    "margin-top:.6rem;padding:6px 12px;border:1px solid var(--lightgray);border-radius:8px;" +
    "background:rgba(255,255,255,.02);font-size:.8rem;max-width:186px;box-sizing:border-box;" +
    "text-decoration:none!important;transition:border-color .2s,box-shadow .2s}" +
    "#kg-visitas:hover{border-color:var(--secondary);box-shadow:0 0 8px rgba(93,255,154,.3)}" +
    "#kg-visitas .kg-visitas-etiqueta{color:var(--gray);text-transform:uppercase;letter-spacing:1px;font-weight:600;font-size:.7rem}" +
    "#kg-visitas .kg-visitas-num{color:var(--secondary);font-weight:700;font-variant-numeric:tabular-nums}" +
    "@media (max-width:800px){#kg-visitas{display:none}}";
  document.head.appendChild(css);

  // Script de GoatCounter: sin conteo automático, contamos nosotros en cada navegación (SPA).
  var gc = document.createElement("script");
  gc.async = true;
  gc.src = "https://gc.zgo.at/count.js";
  gc.setAttribute("data-goatcounter", GC + "/count");
  gc.setAttribute("data-goatcounter-settings", '{"no_onload": true}');
  gc.onload = contar;
  document.head.appendChild(gc);

  document.addEventListener("nav", actualizar);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", actualizar);
  else actualizar();
})();
