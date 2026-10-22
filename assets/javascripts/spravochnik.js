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

/* Выгрузка: «Скачать файл» — самостоятельная HTML-страница, «PDF» — печать.
   Кнопки появляются после расшифровки страницы, поэтому обработчики делегированные. */
function spArticle() { return document.querySelector(".md-content__inner"); }

function spPrint() {
  document.querySelectorAll(".md-content img").forEach(function (i) { i.loading = "eager"; });
  window.print();
}

function spSave() {
  var art = spArticle();
  if (!art) return;
  var clone = art.cloneNode(true);
  clone.querySelectorAll(".sp-actions, .sp-filter, .sp-off, .sp-dark, .sp-note-print, .sp-tmark, .md-source-file, .headerlink, script")
    .forEach(function (n) { n.remove(); });
  clone.querySelectorAll("a[href]").forEach(function (a) {
    if (!/^(https?:|#)/.test(a.getAttribute("href"))) a.removeAttribute("href");
  });
  clone.querySelectorAll("img").forEach(function (i) { i.removeAttribute("loading"); });
  var h1 = clone.querySelector("h1");
  var title = (h1 ? h1.textContent : document.title).trim();
  var sheets = Array.prototype.filter.call(document.styleSheets, function (s) { return s.href && s.href.indexOf(location.origin) === 0; });
  Promise.all(sheets.map(function (s) { return fetch(s.href).then(function (r) { return r.text(); }); })).then(function (css) {
    var html = '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + "<title>" + title.replace(/</g, "&lt;") + "</title>"
      + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Cormorant+Garamond:wght@600;700&display=swap">'
      + "<style>" + css.join("\n").replace(/@import[^;]+;/g, "")
      + ':root{--md-text-font:"Montserrat";--md-code-font:monospace}html{font-size:125%}'
      + "body{margin:0;background:var(--md-default-bg-color);color:var(--md-typeset-color);font-family:var(--md-text-font),sans-serif}"
      + ".sp-wrap{max-width:52rem;margin:0 auto;padding:1.5rem 1rem 3rem}</style></head>"
      + '<body data-md-color-scheme="default" data-md-color-primary="custom" data-md-color-accent="custom"><div class="sp-wrap">'
      + '<article class="md-content__inner md-typeset">' + clone.innerHTML + "</article></div></body></html>";
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    a.download = title.replace(/[\\/:*?"<>|]+/g, "").slice(0, 90) + ".html";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });
}

document.addEventListener("click", function (e) {
  var t = e.target.closest && e.target.closest(".sp-print, .sp-save");
  if (!t) return;
  if (t.classList.contains("sp-print")) spPrint(); else spSave();
});

/* Страница «раздел целиком»: адрес ?t=<тема> оставляет на странице только эту тему. */
(function () {
  if (!/\/razdel\/?$/.test(location.pathname)) return;
  var tries = 0;
  var timer = setInterval(function () {
    var art = spArticle();
    var marks = art && art.querySelectorAll(".sp-tmark");
    if (++tries > 80) clearInterval(timer);
    if (!marks || !marks.length || art.getAttribute("data-sp-done")) return;
    clearInterval(timer);
    art.setAttribute("data-sp-done", "1");
    var want = new URLSearchParams(location.search).get("t");
    if (!want) return;
    var cur = null, name = "";
    var root = marks[0].parentElement;     // после расшифровки содержимое лежит во вложенном контейнере
    Array.prototype.forEach.call(root.children, function (el) {
      if (el.classList.contains("sp-tmark")) { cur = el.getAttribute("data-t"); if (cur === want) name = el.getAttribute("data-name"); }
      if (cur !== null && cur !== want) el.classList.add("sp-off");
    });
    var h1 = root.querySelector("h1");
    if (h1 && name) h1.firstChild.textContent = h1.firstChild.textContent.split(":")[0] + ": " + name;
    var note = art.querySelector(".sp-note-print");
    if (note) note.innerHTML = 'Показана одна тема. <a href="' + location.pathname + '">Показать весь раздел</a>';
  }, 250);
})();

/* Левая панель раздела: топики «по темам» (аккордеон) или «по алфавиту», с быстрым поиском.
   Данные — window.SP_NAV из nav-data.js (названия, как и в обычном меню). */
(function () {
  var data = window.SP_NAV;
  if (!data) return;
  var path = location.pathname, key = null, at = -1;
  Object.keys(data).forEach(function (k) {
    var i = path.indexOf("/" + k + "/");
    if (i !== -1) { key = k; at = i; }
  });
  if (!key) return;
  var sec = data[key];
  var base = path.slice(0, at + key.length + 2);
  var rest = path.slice(base.length).split("/")[0];       // id топика или slug темы
  var mode = "themes";
  try { mode = localStorage.getItem("sp-nav-mode") || "themes"; } catch (e) {}

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  function link(href, text, id) {
    var a = el("a", "sp-nav__a", text);
    a.href = href;
    if (id && id === rest) a.className += " sp-nav__a--active";
    return a;
  }

  function init() {
    var wrap = document.querySelector(".md-sidebar--primary .md-sidebar__scrollwrap");
    if (!wrap || wrap.querySelector(".sp-nav")) return;
    document.documentElement.classList.add("sp-nav-on");

    var box = el("div", "sp-nav");
    var title = el("a", "sp-nav__title", sec.n);
    title.href = base;
    var seg = el("div", "sp-nav__seg");
    var bThemes = el("button", "", "По темам"), bAlpha = el("button", "", "По алфавиту");
    bThemes.type = bAlpha.type = "button";
    seg.appendChild(bThemes); seg.appendChild(bAlpha);
    var q = el("input", "sp-nav__q");
    q.type = "search"; q.placeholder = "Найти топик…"; q.setAttribute("aria-label", "Найти топик в разделе");
    var tools = el("div", "sp-nav__tools");
    tools.appendChild(title); tools.appendChild(seg); tools.appendChild(q);
    var list = el("div", "sp-nav__list");
    box.appendChild(tools); box.appendChild(list);
    wrap.insertBefore(box, wrap.firstChild);

    var all = [];
    sec.t.forEach(function (t) { t.c.forEach(function (c) { all.push({ id: c[0], title: c[1], theme: t.n }); }); });
    all.sort(function (a, b) { return a.title.localeCompare(b.title, "ru"); });

    function renderThemes() {
      sec.t.forEach(function (t) {
        var d = el("details", "sp-nav__theme");
        var cur = t.s === rest || t.c.some(function (c) { return c[0] === rest; });
        if (cur) d.open = true;
        var sm = el("summary", "", t.n);
        sm.appendChild(el("span", "sp-nav__n", String(t.c.length)));
        d.appendChild(sm);
        d.appendChild(link(base + t.s + "/", "Все топики темы", t.s));
        t.c.forEach(function (c) { d.appendChild(link(base + c[0] + "/", c[1], c[0])); });
        d.addEventListener("toggle", function () {
          if (!d.open) return;
          list.querySelectorAll("details[open]").forEach(function (o) { if (o !== d) o.open = false; });
        });
        list.appendChild(d);
      });
    }
    function renderAlpha(items, withTheme) {
      var letter = "";
      items.forEach(function (c) {
        var l = c.title.charAt(0).toUpperCase();
        if (l !== letter && !withTheme) { letter = l; list.appendChild(el("div", "sp-nav__letter", l)); }
        var a = link(base + c.id + "/", c.title, c.id);
        if (withTheme) a.appendChild(el("small", "", c.theme));
        list.appendChild(a);
      });
      if (!items.length) list.appendChild(el("p", "sp-nav__empty", "Ничего не найдено"));
    }
    function render() {
      list.innerHTML = "";
      var words = q.value.toLowerCase().replace(/ё/g, "е").split(/\s+/).filter(Boolean);
      bThemes.className = mode === "themes" ? "is-on" : "";
      bAlpha.className = mode === "alpha" ? "is-on" : "";
      if (words.length) {
        renderAlpha(all.filter(function (c) {
          var s = (c.title + " " + c.theme).toLowerCase().replace(/ё/g, "е");
          return words.every(function (w) { return s.indexOf(w) !== -1; });
        }), true);
      } else if (mode === "alpha") renderAlpha(all, false);
      else renderThemes();
      var a = list.querySelector(".sp-nav__a--active");
      if (a && a.scrollIntoView) a.scrollIntoView({ block: "nearest" });
    }
    function setMode(m) {
      mode = m;
      try { localStorage.setItem("sp-nav-mode", m); } catch (e) {}
      render();
    }
    bThemes.addEventListener("click", function () { setMode("themes"); });
    bAlpha.addEventListener("click", function () { setMode("alpha"); });
    q.addEventListener("input", render);
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
