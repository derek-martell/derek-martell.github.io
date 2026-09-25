/* Dibuja la página del curso a partir de datos.js (generado por publicar.py). */
(function () {
  var D = window.MATERIALES || { ciclos: [] };
  var cont = document.getElementById("contenido"), indice = document.getElementById("indice-lista"),
      barra = document.getElementById("ciclos");
  if (!cont) return;

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  /* Quita tildes y pasa a minúsculas: «optimizacion» encuentra «Optimización» */
  function limpiar(s) {
    return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function ext(url) {
    var m = /\.([a-z0-9]+)$/i.exec(url || "");
    return m ? m[1].toUpperCase() : "ARCH";
  }
  function total(c) {
    var n = c.sillabo.length;
    c.modulos.forEach(function (m) { n += m.clases.length + m.ejercicios.length; });
    c.evaluaciones.forEach(function (e) { n += e.items.length; });
    return n;
  }
  function fila(m) {
    var li = el("li");
    li.setAttribute("data-texto", limpiar(m.titulo + " " + (m.detalle || "")));
    li.appendChild(el("div", "tipo", ext(m.archivo)));
    var c = el("div", "tit");
    var a = el("a", null, m.titulo);
    a.href = m.archivo; a.target = "_blank"; a.rel = "noopener";
    c.appendChild(a);
    if (m.detalle) c.appendChild(el("small", null, m.detalle));
    li.appendChild(c);
    var acc = el("div", "mat-acciones");
    var d = el("a", "desc", "Descargar");
    d.href = m.archivo; d.setAttribute("download", ""); d.setAttribute("aria-label", "Descargar " + m.titulo);
    acc.appendChild(d);
    if (m.solucionario) {
      var s = el("a", "sol", "Solucionario");
      s.href = m.solucionario; s.target = "_blank"; s.rel = "noopener";
      acc.appendChild(s);
    }
    li.appendChild(acc);
    return li;
  }
  function lista(items) {
    var ul = el("ul", "mat");
    items.forEach(function (m) { ul.appendChild(fila(m)); });
    return ul;
  }
  function proximamente() {
    var ul = el("ul", "mat"); ul.appendChild(el("li", "vacio", "Próximamente")); return ul;
  }
  function grupo(id, titulo, n, cuerpo) {
    var s = el("section", "grupo"); s.id = id;
    var h = el("h2", null, titulo + " "); h.appendChild(el("span", "n", n));
    var cp = el("button", "copiar", "Copiar enlace"); cp.type = "button";
    cp.setAttribute("aria-label", "Copiar enlace a " + titulo);
    cp.addEventListener("click", function () {
      var url = location.origin + location.pathname + "?ciclo=" + encodeURIComponent(actual ? actual.id : "") + "#" + id;
      var ok = function () { cp.textContent = "Enlace copiado"; setTimeout(function () { cp.textContent = "Copiar enlace"; }, 1800); };
      try { navigator.clipboard.writeText(url).then(ok); } catch (e) { window.prompt("Copia este enlace", url); }
    });
    h.appendChild(cp);
    s.appendChild(h);
    cuerpo.forEach(function (x) { s.appendChild(x); });
    cont.appendChild(s);
    enlaceIndice(id, titulo, n);
  }
  function enlaceIndice(id, titulo, n) {
    var a = el("a", null, titulo + " "); a.href = "#" + id; a.appendChild(el("span", null, n));
    indice.appendChild(a);
  }

  var obs = null;
  function pintar(c) {
    cont.innerHTML = ""; indice.innerHTML = "";
    if (obs) obs.disconnect();
    var q = document.getElementById("buscar"); if (q) q.value = "";
    var vacio = document.getElementById("sin-resultados"); if (vacio) vacio.style.display = "none";

    grupo("sillabo", "Sílabo", c.sillabo.length, [c.sillabo.length ? lista(c.sillabo) : proximamente()]);
    var pendientes = [];
    c.modulos.forEach(function (mod) {
      var n = mod.clases.length + mod.ejercicios.length, cuerpo = [];
      if (!n) { pendientes.push(mod.titulo); return; }
      if (mod.clases.length) { cuerpo.push(el("h3", null, "Clases")); cuerpo.push(lista(mod.clases)); }
      if (mod.ejercicios.length) { cuerpo.push(el("h3", null, "Ejercicios y solucionarios")); cuerpo.push(lista(mod.ejercicios)); }
      grupo(mod.id, mod.titulo, n, cuerpo);
    });
    var nEval = 0, cuerpoEval = [];
    c.evaluaciones.forEach(function (e) {
      if (!e.items.length) { pendientes.push(e.titulo + " (prueba)"); return; }
      nEval += e.items.length;
      cuerpoEval.push(el("h3", null, e.titulo));
      cuerpoEval.push(lista(e.items));
    });
    if (nEval) grupo("pruebas", "Pruebas dadas", nEval, cuerpoEval);
    if (pendientes.length) {
      var s = el("section", "grupo"); s.id = "proximos";
      var h = el("h2", null, "Próximamente "); h.appendChild(el("span", "n", pendientes.length));
      s.appendChild(h);
      s.appendChild(el("p", "nota", "Todavía no tienen material publicado."));
      var ul = el("ul", "pronto");
      pendientes.forEach(function (t) { ul.appendChild(el("li", null, t)); });
      s.appendChild(ul); cont.appendChild(s);
      enlaceIndice("proximos", "Próximamente", pendientes.length);
    }

    var enlaces = indice.querySelectorAll("a");
    if ("IntersectionObserver" in window) {
      obs = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) enlaces.forEach(function (a) {
            a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id);
          });
        });
      }, { rootMargin: "-25% 0px -65% 0px" });
      document.querySelectorAll("section.grupo").forEach(function (g) { obs.observe(g); });
    }
  }

  /* Selector de ciclo: el más reciente con material (o el pedido por ?ciclo=) */
  var ciclos = D.ciclos || [];
  if (!ciclos.length) { cont.appendChild(proximamente()); return; }
  var pedido = null;
  try { pedido = new URLSearchParams(location.search).get("ciclo"); } catch (e) {}
  var actual = ciclos.filter(function (c) { return c.id === pedido; })[0] ||
               ciclos.filter(function (c) { return total(c) > 0; })[0] || ciclos[0];

  function elegir(c) {
    actual = c;
    barra.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-id") === c.id); });
    var t = document.getElementById("ciclo-titulo"); if (t) t.textContent = "Ciclo " + c.id;
    var chips = document.getElementById("chips");
    if (chips) {
      chips.querySelectorAll(".dinamico").forEach(function (x) { x.remove(); });
      if (c.profesor) { var p = el("span", "chip dinamico", "Profesor: " + c.profesor); chips.appendChild(p); }
      if (c.horario && c.horario.length) { var h = el("span", "chip dinamico", "Horario: " + c.horario.join(" · ")); chips.appendChild(h); }
    }
    try { history.replaceState(null, "", "?ciclo=" + encodeURIComponent(c.id) + location.hash); } catch (e) {}
    pintar(c);
  }
  ciclos.forEach(function (c) {
    var b = el("button", "ciclo", c.id); b.type = "button"; b.setAttribute("data-id", c.id);
    if (!total(c)) b.title = "Sin material publicado aún";
    b.addEventListener("click", function () { elegir(c); });
    barra.appendChild(b);
  });
  elegir(actual);
  if (location.hash.length > 1) {
    var meta = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (meta) meta.scrollIntoView();
  }

  var act = document.getElementById("actualizado");
  if (act && D.actualizado) act.textContent = "Última actualización: " + D.actualizado;

  /* Buscador */
  var q = document.getElementById("buscar"), vacio = document.getElementById("sin-resultados");
  if (q) q.addEventListener("input", function () {
    var t = limpiar(q.value.trim()), visibles = 0;
    document.querySelectorAll("section.grupo").forEach(function (g) {
      var hay = 0;
      g.querySelectorAll("li[data-texto]").forEach(function (li) {
        var ok = !t || li.getAttribute("data-texto").indexOf(t) !== -1;
        li.style.display = ok ? "" : "none"; if (ok) hay++;
      });
      g.querySelectorAll("li.vacio").forEach(function (v) { v.style.display = t ? "none" : ""; });
      g.style.display = (t && !hay) ? "none" : "";
      visibles += hay;
    });
    if (vacio) vacio.style.display = (t && !visibles) ? "block" : "none";
  });
})();
