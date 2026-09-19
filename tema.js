/* Botón claro/oscuro. Claro por defecto; recuerda la elección de la persona. */
(function () {
  var r = document.documentElement, k = "tema-derek";
  function guardar(v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function leer() { try { return localStorage.getItem(k); } catch (e) { return null; } }
  r.setAttribute("data-theme", leer() === "dark" ? "dark" : "light");
  document.addEventListener("DOMContentLoaded", function () {
    var b = document.getElementById("tema");
    if (!b) return;
    b.addEventListener("click", function () {
      var nuevo = r.getAttribute("data-theme") === "dark" ? "light" : "dark";
      r.setAttribute("data-theme", nuevo); guardar(nuevo);
    });
  });
})();
