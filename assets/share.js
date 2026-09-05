// 店ページの「共有」ボタン（2026-09-05）。共有シートがあれば出し、無ければリンクをコピーする。
(function () {
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-share]'); if (!b) return;
    var url = b.getAttribute('data-share'), title = b.getAttribute('data-title') || document.title;
    var done = function (t) { var o = b.textContent; b.textContent = t; setTimeout(function () { b.textContent = o; }, 1800); };
    if (navigator.share) { navigator.share({ title: title, text: title + ' — 席で飲みながら吸える店（その店、吸える？）', url: url }).catch(function () {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { done('リンクをコピーしました'); }, function () { done(url); });
    else done(url);
  });
})();
