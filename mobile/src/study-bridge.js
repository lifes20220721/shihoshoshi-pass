// Bundled pages keep their original learning keys. Links open through the parent app.
document.addEventListener('click', event => {
  const a = event.target.closest('a[href]');
  if (!a) return;
  const raw = a.getAttribute('href');
  if (!raw || raw.startsWith('#') || raw.startsWith('blob:') || a.hasAttribute('download')) return;
  event.preventDefault();
  window.parent.postMessage({type:'pass-external-link', href:raw}, window.location.origin);
});
window.addEventListener('DOMContentLoaded', () => {
  // Only the Android app changes the bundled site links; web and iOS keep their existing links.
  if (/Android/i.test(navigator.userAgent)) {
    const targets = {
      'gyoseishoshipass.com': ['com.gyoseishoshipass.app', '行政書士PASS', 'shihoshoshi_pass'],
      'shihoshoshipass.com': ['com.shihoshoshipass.app', '司法書士PASS', 'gyoseishoshi_pass']
    };
    document.querySelectorAll('.pass-related-nav a[href], .pass-related-footer a[href]').forEach(link => {
      const target = targets[new URL(link.href).hostname];
      if (!target) return;
      const url = new URL('https://play.google.com/store/apps/details');
      url.searchParams.set('id', target[0]);
      url.searchParams.set('referrer', new URLSearchParams({utm_source:target[2],utm_medium:'app'}).toString());
      link.href = url.href;
      link.textContent = target[1] + 'をGoogle Playで見る';
    });
  }
  // Installation belongs to the stores in this build.
  document.querySelectorAll('[onclick*="v18Install"],[onclick*="v18OpenInstall"],#installButton').forEach(el => el.remove());
});
