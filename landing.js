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
      g.textContent = "";
      var w = 100, x = cx - w / 2, n = Math.floor(v), i;
      for (i = 0; i < n; i++) rect(g, x, BASE - (i + 1) * u + 1.5, w, u - 3, cls);
      var fr = v - n;
      if (fr > 0.04) rect(g, x, BASE - n * u - fr * u + 1.5, w, Math.max(fr * u - 3, 2), cls + " parcial");
      return BASE - v * u;
    }

    var atajos = document.querySelectorAll(".atajos button");
    function marcarAtajos(t) {
      atajos.forEach(function (b) {
        var on = +b.getAttribute("data-val") === t;
        b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
    /* Con enCurso, solo se redibuja el gráfico: la lectura y los atajos esperan al valor final */
    function pintar(t, enCurso) {
      var vA = Math.pow(1 + GA, t), vB = Math.pow(1 + GB, t);
      var u = Math.min(UMAX, 285 / Math.max(vB, 3));
      var yA = torre(ta, 150, vA, "b-a", u), yB = torre(tb, 360, vB, "b-b", u);
      var yDup = BASE - 2 * u, gd = $("duplicar");
      gd.setAttribute("y1", yDup); gd.setAttribute("y2", yDup);
      $("duplicar-t").setAttribute("y", yDup - 6);
      var nA = $("n-a"), nB = $("n-b");
      nA.textContent = "×" + coma(vA, 1); nA.setAttribute("y", yA - 10);
      nB.textContent = "×" + coma(vB, 1); nB.setAttribute("y", yB - 10);
      $("anios-v").textContent = t + (t === 1 ? " año" : " años");
      rango.setAttribute("aria-valuetext", t + " años");
      if (enCurso) return;
      var ratio = vB / vA;
      var txt = t === 0
        ? "Ambos países parten con el mismo ingreso."
        : "En " + t + (t === 1 ? " año" : " años") + ", el ingreso del país A se multiplica por " + coma(vA, 1) +
          " y el del país B por " + coma(vB, 1) + ". Solo dos puntos más de crecimiento dejan a B con " +
          coma(ratio, 1) + (ratio < 1.05 ? " vez" : " veces") + " el ingreso de A.";
      var lec = $("lectura"), enl = document.createElement("a");
      enl.href = "macro3.html#m2"; enl.textContent = "módulos 2 y 4";
      lec.textContent = txt + " Así se ve el crecimiento en los ";
      lec.appendChild(enl);
      lec.appendChild(document.createTextNode(". Simplificación: ritmo constante, sin altibajos."));
      $("torres-d").textContent = "A los " + t + " años, el país A multiplicó su ingreso por " + coma(vA, 1) +
        " y el país B por " + coma(vB, 1) + ".";
      marcarAtajos(t);
    }

    var quiere = !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    var animando = null, pendiente = null, tocado = false;
    function parar() {
      if (animando) { cancelAnimationFrame(animando); animando = null; }
    }
    /* Lleva el control de un valor a otro con una curva suave */
    function animar(desde, hasta, dur) {
      parar();
      if (!quiere || desde === hasta) { rango.value = hasta; pintar(hasta); return; }
      var t0 = null, ultimo = null;
      marcarAtajos(hasta);
      var paso = function (ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min((ts - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
        var t = Math.round(desde + (hasta - desde) * e);
        if (p < 1) {
          if (t !== ultimo) { rango.value = t; pintar(t, true); ultimo = t; }
          animando = requestAnimationFrame(paso);
        } else {
          animando = null; rango.value = hasta; pintar(hasta);
        }
      };
      animando = requestAnimationFrame(paso);
    }
    /* Al arrastrar, se dibuja como máximo una vez por cuadro */
    rango.addEventListener("input", function () {
      tocado = true; parar();
      if (pendiente) return;
      pendiente = requestAnimationFrame(function () { pendiente = null; pintar(+rango.value); });
    });
    atajos.forEach(function (b) {
      b.addEventListener("click", function () {
        tocado = true;
        var hasta = +b.getAttribute("data-val"), desde = +rango.value;
        animar(desde, hasta, Math.min(650, 250 + Math.abs(hasta - desde) * 10));
      });
    });

    /* Las torres crecen cuando el gráfico entra en pantalla, salvo que la persona ya lo haya movido */
    var meta = +rango.value;
    pintar(meta);
    if (quiere && "IntersectionObserver" in window) {
      var visto = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        visto.disconnect();
        if (tocado) return;
        rango.value = 0; pintar(0, true);
        animar(0, meta, 2200);
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
      a.className = "t"; a.href = r.x.archivo; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = r.x.titulo;
      var m = document.createElement("span"); m.className = "meta";
      m.textContent = r.de + ", " + fmt(r.x.fecha);
      li.appendChild(a); li.appendChild(m);
      if (r.x.solucionario) {
        var s = document.createElement("a"); s.className = "sol"; s.textContent = "Solucionario";
        s.href = r.x.solucionario; s.target = "_blank"; s.rel = "noopener noreferrer"; li.appendChild(s);
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

  /* ---------- Copiar correo al portapapeles ---------- */
  var cp = $("copiar-correo");
  if (cp) {
    var etiqueta = cp.querySelector(".copiar-t"), aviso = $("copiar-aviso"), reloj = null;
    var correo = cp.getAttribute("data-correo") || "";
    function listo(ok) {
      etiqueta.textContent = ok ? "¡Copiado!" : "Cópialo a mano";
      cp.classList.toggle("hecho", ok);
      if (aviso) aviso.textContent = ok ? "Correo copiado al portapapeles." : "No se pudo copiar; selecciona el correo a mano.";
      clearTimeout(reloj);
      reloj = setTimeout(function () {
        etiqueta.textContent = "Copiar"; cp.classList.remove("hecho");
        if (aviso) aviso.textContent = "";
      }, 2000);
    }
    function aMano() {
      var ta = document.createElement("textarea");
      ta.value = correo; ta.setAttribute("readonly", ""); ta.className = "solo-lector";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      ta.remove(); listo(ok);
    }
    cp.addEventListener("click", function () {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(correo).then(function () { listo(true); }, aMano);
      } else {
        aMano();
      }
    });
  }
})();
