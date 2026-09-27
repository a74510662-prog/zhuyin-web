// 每次上傳新版要把版本號 +1，網頁的「🔄 更新」才抓得到新版
const CACHE = "zhuyin-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./rpg.css",
  "./app.js",
  "./quiz.js",
  "./rpg.js",
  "./task.js",
  "./weak.js",
  "./mystery.js",
  "./music.js",
  "./manifest.json",
  "./icon.svg",
  "./voice/index.json",
  "./sounds/great.mp3",
  "./sounds/perfect.mp3"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// 先用快取秒開，同時在背景抓新版存起來（語音、圖片用過一次就能離線播）
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== location.origin) return; // API、字型交給瀏覽器
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
