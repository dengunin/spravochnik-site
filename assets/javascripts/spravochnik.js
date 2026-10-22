/* Фильтр карточек на странице раздела (работает и после расшифровки страницы). */
document.addEventListener("input", function (e) {
  var input = e.target;
  if (!input.classList || !input.classList.contains("sp-filter")) return;
  var words = input.value.toLowerCase().replace(/ё/g, "е").split(/\s+/).filter(Boolean);
  var root = input.closest(".md-typeset") || document;
  var shown = 0;
  root.querySelectorAll("[data-k]").forEach(function (row) {
    var key = (row.getAttribute("data-k") || "").replace(/ё/g, "е");
    var ok = words.every(function (w) { return key.indexOf(w) !== -1; });
    row.style.display = ok ? "" : "none";
    if (ok) shown++;
  });
  var empty = root.querySelector(".sp-empty");
  if (empty) empty.style.display = shown ? "none" : "block";
});

/* Выгрузка в PDF: печать страницы (кнопки появляются после расшифровки, поэтому делегирование). */
document.addEventListener("click", function (e) {
  if (e.target.closest && e.target.closest(".sp-print")) window.print();
});
