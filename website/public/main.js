(function () {
  var root = document.documentElement;
  var media = window.matchMedia('(prefers-color-scheme: dark)');

  function isDark() {
    var t = root.dataset.theme;
    return t ? t === 'dark' : media.matches;
  }

  // Screenshots come in light and dark; show the one that matches the page.
  function syncShots() {
    var suffix = isDark() ? '-dark' : '';
    document.querySelectorAll('img[data-shot]').forEach(function (img) {
      var want = '/shots/' + img.dataset.shot + suffix + '.png';
      if (img.getAttribute('src') !== want) img.setAttribute('src', want);
    });
    var meta = document.querySelectorAll('meta[name="theme-color"]');
    meta.forEach(function (m) { m.setAttribute('content', isDark() ? '#0C0C10' : '#F3F2FA'); m.removeAttribute('media'); });
  }

  document.querySelector('.theme').addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    // Picking the theme the system already uses means "follow the system" again.
    if ((next === 'dark') === media.matches) delete root.dataset.theme;
    else root.dataset.theme = next;
    try {
      if (root.dataset.theme) localStorage.setItem('theme', root.dataset.theme);
      else localStorage.removeItem('theme');
    } catch (e) {}
    syncShots();
  });
  media.addEventListener('change', syncShots);
  syncShots();

  // Version and size of the latest release, from this site's own API (cached on the server),
  // so the visitor's browser never talks to GitHub until they choose to download.
  fetch('/api/latest').then(function (r) { return r.ok ? r.json() : null; }).then(function (rel) {
    if (!rel || !rel.version) return;
    var mb = rel.size ? ', ' + Math.round(rel.size / 1048576) + ' MB' : '';
    var date = rel.published ? ', released ' + new Date(rel.published).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    document.querySelectorAll('[data-release]').forEach(function (el) {
      el.textContent = 'Version ' + rel.version + mb + date + '. Free, no account needed.';
    });
  }).catch(function () {});
  // danishali.dev shows this page in a window. GitHub and other sites refuse to load
  // inside it, so outside links open in a new tab there.
  if (window.top !== window.self) {
    document.querySelectorAll('a[href^="http"]').forEach(function (a) {
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }
})();
