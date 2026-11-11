// Filtros de los catálogos paginados (kanji, vocabulario, gramática y colecciones).
// El workflow lo inyecta en el <head> de todas las páginas con data-persist, igual que
// el practicador, así sobrevive a la navegación SPA de Quartz y se reactiva con "nav".
// Editar aquí, no en build_test.js.
//
// Sin filtros, cada página muestra sus 50 tarjetas estáticas. Con algún chip activo,
// se descarga static/catalogos/<id>.json (todas las entradas del catálogo), se filtra
// el universo completo y se pagina de nuevo de 50 en 50: la página 1 de "N1" es la
// primera página de resultados N1, no la página 1 del catálogo completo.
// Chips del mismo grupo se combinan con "o" y grupos distintos con "y".
// El estado vive en la URL (?f=jlpt-n1,gtipo-particle&p=2) para poder compartirlo y
// volver atrás desde una ficha.
(function () {
  if (window.__kanjiCatalogo) { window.__kanjiCatalogo(); return; }

  var cache = {};

  function base() {
    return window.location.pathname.indexOf('/Kanji_Garden') === 0 ? '/Kanji_Garden' : '';
  }

  function cargar(id) {
    if (!cache[id]) {
      cache[id] = fetch(base() + '/static/catalogos/' + encodeURIComponent(id) + '.json')
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (datos) {
          // Los enlaces de las tarjetas se generan como "/kanji/..." y Quartz solo
          // los reescribe en el HTML estático: aquí se les añade la base del sitio.
          var b = base();
          return datos.items.map(function (it) {
            return { tags: ' ' + String(it[0]).toLowerCase() + ' ', html: String(it[1]).replace(/href="\//g, 'href="' + b + '/') };
          });
        })
        .catch(function (err) { delete cache[id]; throw err; });
    }
    return cache[id];
  }

  function leerEstado() {
    var q = new URLSearchParams(window.location.search);
    var f = (q.get('f') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var p = parseInt(q.get('p') || '1', 10);
    return { filtros: f, pagina: isNaN(p) || p < 1 ? 1 : p };
  }

  function escribirEstado(filtros, pagina) {
    var q = new URLSearchParams(window.location.search);
    q.delete('f'); q.delete('p');
    var s = q.toString();
    if (filtros.length) s += (s ? '&' : '') + 'f=' + filtros.map(encodeURIComponent).join(',');
    if (filtros.length && pagina > 1) s += '&p=' + pagina;
    var url = window.location.pathname + (s ? '?' + s : '') + window.location.hash;
    try { history.replaceState(history.state, '', url); } catch (e) {}
  }

  function barra(pagina, total) {
    var div = document.createElement('div');
    div.className = 'barra-paginacion-catalogo barra-paginacion-filtrada';
    var izq = pagina > 1
      ? '<a href="#" class="btn-nav-catalogo" data-ir="' + (pagina - 1) + '">← Anterior</a>'
      : '<span class="btn-nav-desactivado">← Anterior</span>';
    var der = pagina < total
      ? '<a href="#" class="btn-nav-catalogo" data-ir="' + (pagina + 1) + '">Siguiente →</a>'
      : '<span class="btn-nav-desactivado">Siguiente →</span>';
    var opciones = '';
    for (var i = 1; i <= total; i++) {
      opciones += '<option value="' + i + '"' + (i === pagina ? ' selected' : '') + '>Página ' + i + ' de ' + total + '</option>';
    }
    div.innerHTML =
      '<div style="min-width: 100px; text-align: left;">' + izq + '</div>' +
      '<div class="selector-pagina-wrapper"><select class="selector-pagina-dropdown">' + opciones + '</select></div>' +
      '<div style="min-width: 100px; text-align: right;">' + der + '</div>';
    return div;
  }

  function iniciar() {
    var panel = document.querySelector('.contenedor-filtros-catalogo[data-catalogo]');
    if (!panel || panel.dataset.bound) return;
    panel.dataset.bound = 'true';

    var id = panel.dataset.catalogo;
    var porPagina = parseInt(panel.dataset.porPagina || '50', 10) || 50;
    var article = panel.closest('article') || document.body;
    var grid = article.querySelector('.grid-catalogo-general, .grid-catalogo-kanjis, .grid-catalogo-vocab');
    var resumen = article.querySelector('.resumen-catalogo');
    var barrasEstaticas = Array.prototype.slice.call(article.querySelectorAll('.barra-paginacion-catalogo'));
    if (!grid) return;

    var original = { grid: grid.innerHTML, resumen: resumen ? resumen.innerHTML : '' };
    var botones = Array.prototype.slice.call(panel.querySelectorAll('.btn-chip-filtro'));
    var validos = botones.map(function (b) { return b.dataset.filtro; });
    var btnReset = panel.querySelector('.btn-chip-reset');
    var estado = leerEstado();
    var activos = estado.filtros.filter(function (f) { return validos.indexOf(f) !== -1; });
    var pagina = estado.pagina;
    var peticion = 0;

    // Chips del mismo grupo (N4 y N5) se suman con "o"; grupos distintos (N1 y Partícula) con "y".
    var grupoDe = {};
    botones.forEach(function (b) {
      var g = b.closest('.grupo-filtro-chips');
      grupoDe[b.dataset.filtro] = Array.prototype.indexOf.call(panel.querySelectorAll('.grupo-filtro-chips'), g);
    });
    function cumple(tags) {
      var grupos = {};
      activos.forEach(function (f) { (grupos[grupoDe[f]] = grupos[grupoDe[f]] || []).push(' ' + f.toLowerCase() + ' '); });
      return Object.keys(grupos).every(function (g) {
        return grupos[g].some(function (f) { return tags.indexOf(f) !== -1; });
      });
    }

    function quitarBarrasFiltradas() {
      Array.prototype.forEach.call(article.querySelectorAll('.barra-paginacion-filtrada'), function (n) { n.remove(); });
    }

    function restaurar() {
      quitarBarrasFiltradas();
      grid.innerHTML = original.grid;
      if (resumen) resumen.innerHTML = original.resumen;
      barrasEstaticas.forEach(function (b) { b.style.display = ''; });
    }

    function irA(p, desplazar) {
      pagina = p;
      escribirEstado(activos, pagina);
      pintar();
      if (desplazar) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function pintar() {
      botones.forEach(function (b) { b.classList.toggle('activo', activos.indexOf(b.dataset.filtro) !== -1); });
      if (activos.length === 0) { restaurar(); return; }

      var mia = ++peticion;
      if (resumen) resumen.innerHTML = 'Filtrando…';
      cargar(id).then(function (items) {
        if (mia !== peticion) return;
        var lista = items.filter(function (it) { return cumple(it.tags); });
        var total = Math.max(1, Math.ceil(lista.length / porPagina));
        if (pagina > total) { pagina = total; escribirEstado(activos, pagina); }
        var lote = lista.slice((pagina - 1) * porPagina, pagina * porPagina);

        barrasEstaticas.forEach(function (b) { b.style.display = 'none'; });
        quitarBarrasFiltradas();
        grid.innerHTML = lote.length
          ? lote.map(function (it) { return it.html; }).join('')
          : '<p style="grid-column: 1 / -1; color: var(--gray);">No hay entradas que cumplan todos los filtros.</p>';
        if (resumen) {
          resumen.innerHTML = 'Mostrando <strong>' + lote.length + '</strong> de <strong>' + lista.length +
            '</strong> entradas filtradas (de ' + items.length + ' en total).';
        }
        if (lista.length > porPagina) {
          grid.parentNode.insertBefore(barra(pagina, total), grid);
          grid.parentNode.insertBefore(barra(pagina, total), grid.nextSibling);
          Array.prototype.forEach.call(article.querySelectorAll('.barra-paginacion-filtrada'), function (bar) {
            bar.addEventListener('click', function (e) {
              var a = e.target.closest('[data-ir]');
              if (!a) return;
              e.preventDefault();
              irA(parseInt(a.dataset.ir, 10), true);
            });
            var sel = bar.querySelector('select');
            sel.addEventListener('change', function () { irA(parseInt(sel.value, 10), true); });
          });
        }
      }).catch(function (err) {
        if (mia !== peticion) return;
        console.warn('No se pudo cargar el catálogo completo:', err);
        // Respaldo: filtrar solo las tarjetas de esta página.
        restaurar();
        var visibles = 0;
        Array.prototype.forEach.call(grid.children, function (t) {
          var ok = cumple(' ' + (t.dataset.tags || '').toLowerCase() + ' ');
          t.style.display = ok ? '' : 'none';
          if (ok) visibles++;
        });
        if (resumen) resumen.innerHTML = 'Mostrando <strong>' + visibles + '</strong> entradas de esta página (no se pudo cargar el catálogo completo).';
      });
    }

    botones.forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.dataset.filtro;
        var i = activos.indexOf(f);
        if (i === -1) activos.push(f); else activos.splice(i, 1);
        irA(1, false);
      });
    });
    if (btnReset) {
      btnReset.addEventListener('click', function () {
        activos = [];
        irA(1, false);
      });
    }

    if (activos.length) pintar();
  }

  window.__kanjiCatalogo = iniciar;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
  document.addEventListener('nav', iniciar);
})();
