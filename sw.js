/* ==========================================================
   次元簿 · Service Worker
   策略：Cache First —— 应用外壳预缓存，命中即返回，
   断网时依然能打开并读取 localStorage 里的数据。

   升级原则（v12 起）：
   1. 核心文件「全部成功」才算安装成功，任一失败则安装失败，
      旧版本与旧缓存原样保留，绝不让用户停在半成品状态。
   2. 只有确认新缓存完整，才删除旧缓存；否则旧缓存留作兜底。
   3. 每个文件下载后先完整读入内存再写入缓存，
      避免把「下载到一半」的残缺文件存进去。
   ========================================================== */

const VERSION = 'v23';
const CACHE = 'shilu-shell-' + VERSION;

/* 核心文件：缺一个就用不了，必须全部成功 */
const CORE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

/* 附属文件：图标，失败也不影响使用 */
const EXTRA = [
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

/* ---------- 带重试的下载 ---------- */
function fetchOnce(url) {
  return fetch(new Request(url, { cache: 'reload' })).then(function (res) {
    if (!res || res.status !== 200) throw new Error('bad status ' + (res && res.status));
    return res;
  });
}

function fetchRetry(url, tries) {
  return fetchOnce(url).catch(function (err) {
    if (tries <= 1) throw err;
    return new Promise(function (r) { setTimeout(r, 700); })
      .then(function () { return fetchRetry(url, tries - 1); });
  });
}

/* 下载 → 完整读入内存 → 再写入缓存（半截文件进不了缓存） */
function cacheOne(cache, url) {
  return fetchRetry(url, 3).then(function (res) {
    var type = res.headers.get('Content-Type') || 'application/octet-stream';
    return res.arrayBuffer().then(function (buf) {
      if (!buf || buf.byteLength === 0) throw new Error('empty body: ' + url);
      return cache.put(url, new Response(buf, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': type }
      }));
    });
  });
}

/* ---------- 兜底页：缓存和网络都拿不到时显示，保证永远有内容 ---------- */
function offlinePage() {
  var html = [
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>次元簿 · 暂时打不开</title></head>',
    '<body style="margin:0;padding:60px 26px;background:#FAF7FF;color:#2B2440;text-align:center;',
    'font:15px/1.75 -apple-system,BlinkMacSystemFont,\'PingFang SC\',\'Microsoft YaHei\',sans-serif">',
    '<div style="font-size:19px;font-weight:600;margin-bottom:12px">暂时打不开</div>',
    '<div style="font-size:14px;color:#6B6280;margin-bottom:28px">',
    '网络没连上，本地缓存也还没准备好。<br>',
    '检查网络后点「重试」；还不行点「清除缓存重试」。<br>',
    '你的记录存在本机，清缓存不会删除数据。</div>',
    '<button id="r" style="display:block;width:100%;max-width:320px;margin:0 auto 12px;padding:13px 0;',
    'border:0;border-radius:14px;background:#7C5CFA;color:#fff;font-size:16px;font-weight:600">重试</button>',
    '<button id="c" style="display:block;width:100%;max-width:320px;margin:0 auto;padding:13px 0;',
    'border:1px solid #D9D2EE;border-radius:14px;background:#fff;color:#5B5372;font-size:16px">清除缓存重试</button>',
    '<scr' + 'ipt>',
    'document.getElementById("r").onclick=function(){location.reload()};',
    'document.getElementById("c").onclick=function(){var b=this;b.textContent="正在清理…";',
    'var j=[];',
    'if(window.caches){j.push(caches.keys().then(function(k){return Promise.all(k.map(function(n){return caches.delete(n)}))}))}',
    'if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations){',
    'j.push(navigator.serviceWorker.getRegistrations().then(function(r){return Promise.all(r.map(function(x){return x.unregister()}))}))}',
    'Promise.all(j).catch(function(){}).then(function(){location.reload()})};',
    '</scr' + 'ipt></body></html>'
  ].join('');
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

/* ---------- 安装：核心全部成功才算成功 ---------- */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        /* 核心：串行下载，失败即整体失败（旧版本继续服役） */
        return CORE.reduce(function (chain, url) {
          return chain.then(function () { return cacheOne(cache, url); });
        }, Promise.resolve());
      })
      .then(function () {
        /* 图标：尽力而为 */
        return caches.open(CACHE).then(function (cache) {
          return Promise.all(EXTRA.map(function (url) {
            return cacheOne(cache, url).catch(function () { /* 忽略 */ });
          }));
        });
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

/* ---------- 激活：确认新缓存完整后才清旧缓存 ---------- */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        return Promise.all(CORE.map(function (url) { return cache.match(url); }));
      })
      .then(function (hits) {
        var complete = hits.every(function (h) { return !!h; });
        if (!complete) return null; /* 不完整：旧缓存留着兜底 */
        return caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) {
            if (k !== CACHE && k.indexOf('shilu-shell-') === 0) return caches.delete(k);
            return null;
          }));
        });
      })
      .then(function () { return self.clients.claim(); })
  );
});

/* ---------- 请求：Cache First ---------- */
self.addEventListener('fetch', function (e) {
  const req = e.request;

  /* 只处理 GET；POST 等交给网络 */
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* 跨域资源不拦截 */
  if (url.origin !== location.origin) return;

  /* 页面导航：缓存优先 → 缓存的 index.html → 网络 → 兜底页
     注意：respondWith 必须拿到一个真实的 Response，拿到 null 时
     Safari 会直接报「returned response is null」并拒绝显示页面。 */
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match(req)
        .catch(function () { return null; })
        .then(function (hit) {
          if (hit) return hit;
          return caches.match('./index.html').catch(function () { return null; });
        })
        .then(function (hit) {
          if (hit) return hit;
          return fetch(req);
        })
        .catch(function () { return null; })
        .then(function (res) {
          return res || offlinePage();
        })
    );
    return;
  }

  /* 静态资源：缓存优先；未命中则请求网络（失败重试一次）并写入缓存 */
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetchRetry(req.url, 2).then(function (res) {
        /* 带查询串的请求（版本探测等）只透传，不占缓存 */
        if (!url.search) {
          const copy = res.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(req, copy).catch(function () { /* 忽略配额错误 */ });
          });
        }
        return res;
      }).catch(function () {
        /* 离线且未缓存：图片等返回占位，其余抛错由浏览器处理 */
        if (req.destination === 'image') {
          return new Response('', { status: 204, statusText: 'offline' });
        }
        return new Response('离线状态，资源未缓存', { status: 503, statusText: 'offline' });
      });
    })
  );
});

/* ---------- 支持页面主动要求更新 ---------- */
self.addEventListener('message', function (e) {
  var d = e.data;
  if (d === 'SKIP_WAITING' || (d && d.type === 'SKIP_WAITING')) self.skipWaiting();
});
