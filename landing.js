(function () {
  var ALFA = 0.33, ND = 0.08, KMAX = 20, YMAX = 1.7;
  var X0 = 52, X1 = 500, Y0 = 330, Y1 = 20;
  function X(k) { return X0 + (k / KMAX) * (X1 - X0); }
  function Y(v) { return Y0 - (v / YMAX) * (Y0 - Y1); }
  function $(id) { return document.getElementById(id); }
  function coma(n, d) { return n.toFixed(d).replace(".", ","); }

  /* ---------- Dos economías, dos ritmos de crecimiento ---------- */
  var GA = 0.02, GB = 0.04, UMAX = 44, BASE = 330;
  var svg = $("torres"), rango = $("anios");
  if (svg && rango) {
    var NS = "http://www.w3.org/2000/svg", ta = $("torre-a"), tb = $("torre-b");
    function rect(g, x, y, w, h, cls) {
      var r = document.createElementNS(NS, "rect");
      r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", w); r.setAttribute("height", h);
      r.setAttribute("rx", 3); r.setAttribute("class", cls); g.appendChild(r);
    }
    function torre(g, cx, v, cls, u) {
      g.innerHTML = "";
      var w = 100, x = cx - w / 2, n = Math.floor(v), i;
      for (i = 0; i < n; i++) rect(g, x, BASE - (i + 1) * u + 1.5, w, u - 3, cls);
      var fr = v - n;
      if (fr > 0.04) rect(g, x, BASE - n * u - fr * u + 1.5, w, Math.max(fr * u - 3, 2), cls + " parcial");
      return BASE - v * u;
    }

    function pintar(t) {
      var vA = Math.pow(1 + GA, t), vB = Math.pow(1 + GB, t);
      var u = Math.min(UMAX, 285 / Math.max(vB, 3));
      var yA = torre(ta, 150, vA, "b-a", u), yB = torre(tb, 360, vB, "b-b", u);
      var yDup = BASE - 2 * u, gd = $("duplicar");
      gd.setAttribute("y1", yDup); gd.setAttribute("y2", yDup);
      $("duplicar-t").setAttribute("y", yDup - 6);
      var nA = $("n-a"), nB = $("n-b");
      nA.textContent = "×" + coma(vA, 1); nA.setAttribute("y", yA - 10);
      nB.textContent = "×" + coma(vB, 1); nB.setAttribute("y", yB - 10);
      var ratio = vB / vA;
      $("anios-v").textContent = t + (t === 1 ? " año" : " años");
      rango.setAttribute("aria-valuetext", t + " años");
      var txt = t === 0
        ? "Ambos países parten con el mismo ingreso."
        : "En " + t + (t === 1 ? " año" : " años") + ", el ingreso del país A se multiplica por " + coma(vA, 1) +
          " y el del país B por " + coma(vB, 1) + ". Solo dos puntos más de crecimiento dejan a B con " +
          coma(ratio, 1) + (ratio < 1.05 ? " vez" : " veces") + " el ingreso de A.";
      $("lectura").innerHTML = txt + ' Así se ve el crecimiento en los <a href="macro3.html#m2">módulos 2 y 4</a>. ' +
        "Simplificación: ritmo constante, sin altibajos.";
      $("torres-d").textContent = "A los " + t + " años, el país A multiplicó su ingreso por " + coma(vA, 1) +
        " y el país B por " + coma(vB, 1) + ".";
    }
    var animando = null;
    rango.addEventListener("input", function () {
      if (animando) { cancelAnimationFrame(animando); animando = null; }
      pintar(+rango.value);
    });

    /* Único movimiento de la página: las torres crecen cuando el gráfico entra en pantalla */
    var meta = +rango.value;
    pintar(meta);
    var quiere = !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (quiere && "IntersectionObserver" in window) {
      var visto = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        visto.disconnect();
        var t0 = null, dur = 2200;
        var paso = function (ts) {
          if (t0 === null) t0 = ts;
          var p = Math.min((ts - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
          var t = Math.round(meta * e);
          rango.value = t; pintar(t);
          animando = p < 1 ? requestAnimationFrame(paso) : null;
        };
        rango.value = 0; pintar(0);
        animando = requestAnimationFrame(paso);
      }, { threshold: 0.45 });
      visto.observe(svg);
    }
  }

  /* ---------- Lo último del curso, leído de datos.js ---------- */
  var D = window.MATERIALES || { ciclos: [] };
  function fmt(iso) { var p = (iso || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : ""; }
  function juntar(c) {
    var t = [];
    c.sillabo.forEach(function (x) { t.push({ x: x, de: "Sílabo" }); });
    c.modulos.forEach(function (m) {
      m.clases.concat(m.ejercicios).forEach(function (x) { t.push({ x: x, de: m.titulo }); });
    });
    c.evaluaciones.forEach(function (e) { e.items.forEach(function (x) { t.push({ x: x, de: e.titulo }); }); });
    var visto = {};
    return t.filter(function (r) {
      var k = r.x.titulo + "|" + r.x.detalle; if (visto[k]) return false; visto[k] = 1; return true;
    });
  }
  var ciclo = D.ciclos.filter(function (c) { return juntar(c).length; })[0] || D.ciclos[0];
  var lista = $("ultimo");
  if (lista) {
    var items = ciclo ? juntar(ciclo) : [];
    items.sort(function (a, b) { return (b.x.fecha || "").localeCompare(a.x.fecha || ""); });
    items.slice(0, 5).forEach(function (r) {
      var li = document.createElement("li"), a = document.createElement("a");
      a.className = "t"; a.href = r.x.archivo; a.target = "_blank"; a.rel = "noopener"; a.textContent = r.x.titulo;
      var m = document.createElement("span"); m.className = "meta";
      m.textContent = r.de + ", " + fmt(r.x.fecha);
      li.appendChild(a); li.appendChild(m);
      if (r.x.solucionario) {
        var s = document.createElement("a"); s.className = "sol"; s.textContent = "Solucionario";
        s.href = r.x.solucionario; s.target = "_blank"; s.rel = "noopener"; li.appendChild(s);
      }
      lista.appendChild(li);
    });
    if (!items.length) {
      var v = document.createElement("li"); v.textContent = "Aún no hay material publicado en este ciclo."; lista.appendChild(v);
    }
  }
  if (ciclo && (ciclo.profesor || ciclo.horario)) {
    $("clase").hidden = false;
    $("clase-titulo").textContent = "Clases del ciclo " + ciclo.id;
    if (ciclo.profesor) $("clase-prof").textContent = "Con " + ciclo.profesor + ".";
    if (ciclo.horario && ciclo.horario.length) $("clase-hor").textContent = ciclo.horario.join(String.fromCharCode(10));
  }

  /* ---------- CV, si existe ---------- */
  var cvUrl = window.PERFIL && window.PERFIL.cv;
  if (cvUrl) {
    ["cv-btn", "cv-pie"].forEach(function (id) {
      var a = $(id); if (a) { a.href = cvUrl; a.hidden = false; }
    });
  }

  /* ---------- Foto de perfil, si existe ---------- */
  var f = window.PERFIL && window.PERFIL.foto, r = $("rostro");
  if (f && r) {
    var img = new Image();
    img.onload = function () { r.textContent = ""; img.alt = "Foto de Derek Martell"; r.appendChild(img); };
    img.src = f;
  }
})();
