'use strict';
// Generated service-worker.js is committed for direct GitHub Pages hosting.
const CACHE_PREFIX = 'shihoshoshi-pass-';
const CACHE_NAME = 'shihoshoshi-pass-v2-3420df318baf9e0d';
const CORE_FILES = [
  "./",
  "./index.html",
  "./styles.css?v=b42214165584cbc5",
  "./data/init.js?v=2bdf270fb90267a1",
  "./data/base.js?v=6932faa0f00981d6",
  "./data/subjects.js?v=a92f522df13f9e19",
  "./data/lesson-notes.js?v=5ed47b8271d4457f",
  "./data/past-exams.js?v=454fde50c85a6fa8",
  "./data/lessons.js?v=51a07415726719d2",
  "./data/cases.js?v=e8432b003d77769c",
  "./data/reinforcement.js?v=910f6702e44ff46d",
  "./data/questions/civil.js?v=404cf7e69fca125c",
  "./data/questions/realestate.js?v=12dd5e83cf289400",
  "./data/questions/company.js?v=9e1a0ddb24e5d019",
  "./data/questions/commercialreg.js?v=3524a466987f2e91",
  "./data/questions/civilprocedure.js?v=8960f2a74a2b3009",
  "./data/questions/execution.js?v=c06008d991c7f739",
  "./data/questions/preservation.js?v=7db7fcffabfea309",
  "./data/questions/constitution.js?v=93694e0df1cb4a4d",
  "./data/questions/criminal.js?v=9feff57e15dc266a",
  "./data/questions/deposit.js?v=5ee07b013b64d990",
  "./data/questions/scrivener.js?v=f3a5f6b3099b6503",
  "./data.js?v=5364d589c43f89ee",
  "./js/storage.js?v=38b9675ce6e2365b",
  "./app.js?v=7aeba84b282a5c87",
  "./js/subjects.js?v=c315d1c132843bfa",
  "./js/study-tools.js?v=2618bfa8393697e9",
  "./js/library.js?v=b53749b208135a2b",
  "./js/amendments.js?v=fb694bd8d655c24e",
  "./js/past-exams.js?v=a387a95875835165",
  "./js/learning.js?v=08a37dde37610115",
  "./js/casebook.js?v=230593e23fbad097",
  "./js/pwa.js?v=466a11565627b7f9",
  "./js/article-links.js?v=27ea3d27008bcc69",
  "./js/question-quality.js?v=1b3901c38562941d",
  "./js/resume.js?v=fcff8a8c68bb47a2",
  "./privacy.html",
  "./contact.html",
  "./sources.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener('install', event => {
  // Activate only after every HTML/CSS/data/program asset has been saved.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  if (new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
      }
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
    }
    return response;
  })));
});
