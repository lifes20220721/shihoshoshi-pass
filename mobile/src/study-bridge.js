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
  // Installation belongs to the stores in this build.
  document.querySelectorAll('[onclick*="v18Install"],[onclick*="v18OpenInstall"],#installButton').forEach(el => el.remove());
});
