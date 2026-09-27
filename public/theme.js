// Set theme before paint to avoid flash. Loaded as a classic, parser-blocking
// <script src> in <head> (not inline) so the CSP needs no hash for it.
(function () {
  var t = null;
  try {
    t = localStorage.getItem("footiq-theme");
  } catch (e) {
    /* storage blocked — fall back to dark */
  }
  if (t === "light") document.documentElement.classList.add("light");
  else document.documentElement.classList.add("dark");
})();
