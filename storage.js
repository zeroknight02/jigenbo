/* 存储层：只负责 IndexedDB 的打开、读写、迁移，不碰界面和业务状态。
   业务与 UI 在 app.js，通过 window.AppStorage 调用这里。 */
(function () {
  'use strict';

  var DB_NAME = 'record_app_01_db';
  var DB_VER = 1;
  var S = {
    records: 'records',
    categories: 'categories',
    attachments: 'attachments',
    settings: 'settings',
    metadata: 'metadata'
  };
  var LEGACY_DB = 'shilu-db';

  var dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      if (!window.indexedDB) { resolve(null); return; }
      var req;
      try { req = window.indexedDB.open(DB_NAME, DB_VER); } catch (e) { resolve(null); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(S.records)) {
          var rec = db.createObjectStore(S.records, { keyPath: 'id' });
          rec.createIndex('type', 'type', { unique: false });
          rec.createIndex('updatedAt', 'updatedAt', { unique: false });
          rec.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains(S.categories)) db.createObjectStore(S.categories, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(S.attachments)) db.createObjectStore(S.attachments, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(S.settings)) db.createObjectStore(S.settings, { keyPath: 'k' });
        if (!db.objectStoreNames.contains(S.metadata)) db.createObjectStore(S.metadata, { keyPath: 'k' });
      };
      req.onsuccess = function () {
        var db = req.result;
        /* 另一个标签页要升级数据库时主动关闭，避免互相卡住 */
        db.onversionchange = function () {
          try { db.close(); } catch (e) { /* ignore */ }
          try { window.dispatchEvent(new Event('appdb-versionchange')); } catch (e) { /* ignore */ }
        };
        resolve(db);
      };
      req.onerror = function () { resolve(null); };
      req.onblocked = function () { resolve(null); };
    });
    return dbPromise;
  }

  function getAll(store) {
    return open().then(function (db) {
      if (!db || !db.objectStoreNames.contains(store)) return null;
      return new Promise(function (resolve) {
        try {
          var req = db.transaction(store, 'readonly').objectStore(store).getAll();
          req.onsuccess = function () { resolve(req.result || []); };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    }).catch(function () { return null; });
  }

  function get(store, key) {
    return open().then(function (db) {
      if (!db || !db.objectStoreNames.contains(store)) return null;
      return new Promise(function (resolve) {
        try {
          var req = db.transaction(store, 'readonly').objectStore(store).get(key);
          req.onsuccess = function () { resolve(req.result || null); };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    }).catch(function () { return null; });
  }

  function put(store, row) {
    return open().then(function (db) {
      if (!db || !db.objectStoreNames.contains(store)) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).put(row);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    }).catch(function () { return false; });
  }

  function del(store, key) {
    return open().then(function (db) {
      if (!db || !db.objectStoreNames.contains(store)) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).delete(key);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    }).catch(function () { return false; });
  }

  function clearAll() {
    return open().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var names = [S.records, S.categories, S.attachments, S.settings, S.metadata];
          var tx = db.transaction(names, 'readwrite');
          names.forEach(function (n) { tx.objectStore(n).clear(); });
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    }).catch(function () { return false; });
  }

  function getAllRecords() { return getAll(S.records); }
  function getMeta(k) { return get(S.metadata, k); }
  function getSetting(k) { return get(S.settings, k); }

  function putMeta(k, row) {
    var data = { k: k };
    Object.keys(row || {}).forEach(function (x) { data[x] = row[x]; });
    return put(S.metadata, data);
  }

  function putSetting(k, row) {
    var data = { k: k };
    Object.keys(row || {}).forEach(function (x) { data[x] = row[x]; });
    return put(S.settings, data);
  }

  /* 记录增量写入 + collections 元数据，同一个事务里完成 */
  function putRecords(puts, dels, collections, savedAt) {
    return open().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction([S.records, S.metadata], 'readwrite');
          var store = tx.objectStore(S.records);
          (puts || []).forEach(function (r) { store.put(r); });
          (dels || []).forEach(function (id) { store.delete(id); });
          tx.objectStore(S.metadata).put({
            k: 'collections', savedAt: savedAt, recordCount: collections.recordCount,
            lists: collections.lists, checkins: collections.checkins,
            categories: collections.categories, trash: collections.trash
          });
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    }).catch(function () { return false; });
  }

  function replaceRecords(records, collections, savedAt) {
    return open().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction([S.records, S.metadata], 'readwrite');
          var store = tx.objectStore(S.records);
          store.clear();
          (records || []).forEach(function (r) { store.put(r); });
          tx.objectStore(S.metadata).put({
            k: 'collections', savedAt: savedAt, recordCount: collections.recordCount,
            lists: collections.lists, checkins: collections.checkins,
            categories: collections.categories, trash: collections.trash
          });
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    }).catch(function () { return false; });
  }

  function getAllImages() { return getAll(S.attachments); }
  function putImage(id, data) { return put(S.attachments, { id: id, data: data, at: Date.now() }); }
  function deleteImage(id) { return del(S.attachments, id); }

  /* 旧库：不存在时 onupgradeneeded 会触发，直接中止，不创建空库 */
  function legacyOpen() {
    return new Promise(function (resolve) {
      var req;
      try { req = window.indexedDB.open(LEGACY_DB); } catch (e) { resolve(null); return; }
      var created = false;
      req.onupgradeneeded = function () { created = true; try { req.transaction.abort(); } catch (e) { /* ignore */ } };
      req.onsuccess = function () {
        if (created) { try { req.result.close(); } catch (e) { /* ignore */ } resolve(null); return; }
        resolve(req.result);
      };
      req.onerror = function () { resolve(null); };
      req.onblocked = function () { resolve(null); };
    });
  }

  function readLegacyStore(db, name, key) {
    return new Promise(function (resolve) {
      if (!db || !db.objectStoreNames.contains(name)) { resolve(key ? null : []); return; }
      try {
        var store = db.transaction(name, 'readonly').objectStore(name);
        var req = key ? store.get(key) : store.getAll();
        req.onsuccess = function () { resolve(req.result || (key ? null : [])); };
        req.onerror = function () { resolve(key ? null : []); };
      } catch (e) { resolve(key ? null : []); }
    });
  }

  /* 从旧 shilu-db 迁移；旧库没有数据时由 app.js 再尝试旧 localStorage。
     返回 {records, lists, checkins, categories, trash, prefs, images} 或 null。 */
  function readLegacy() {
    return legacyOpen().then(function (old) {
      return Promise.all([
        readLegacyStore(old, 'records'),
        readLegacyStore(old, 'meta'),
        readLegacyStore(old, 'images'),
        readLegacyStore(old, 'meta', 'prefs')
      ]).then(function (rows) {
        var out = { records: [], lists: [], checkins: [], categories: [], trash: [], prefs: null, images: [] };
        out.records = rows[0] || [];
        (rows[1] || []).forEach(function (row) {
          if (!row) return;
          if (row.k === 'collections') {
            out.lists = row.lists || []; out.checkins = row.checkins || [];
            out.categories = row.categories || []; out.trash = row.trash || [];
          }
        });
        out.images = rows[2] || [];
        out.prefs = rows[3] && rows[3].data ? rows[3].data : null;
        try { if (old) old.close(); } catch (e) { /* ignore */ }
        return out;
      });
    }).catch(function () { return null; });
  }

  /* 一次性写入迁移结果；调用方负责确认新库为空 */
  function writeMigration(src) {
    return open().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction([S.records, S.attachments, S.settings, S.metadata], 'readwrite');
          (src.records || []).forEach(function (r) { if (r && r.id) tx.objectStore(S.records).put(r); });
          (src.images || []).forEach(function (im) {
            if (!im || !im.id) return;
            tx.objectStore(S.attachments).put({ id: im.id, data: im.data, at: im.at || Date.now() });
          });
          tx.objectStore(S.settings).put({ k: 'prefs', data: src.prefs || {}, savedAt: Date.now() });
          tx.objectStore(S.metadata).put({
            k: 'collections', savedAt: new Date().toISOString(),
            lists: src.lists || [], checkins: src.checkins || [],
            categories: src.categories || [], trash: src.trash || []
          });
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    }).catch(function () { return false; });
  }

  window.AppStorage = {
    DB_NAME: DB_NAME, DB_VER: DB_VER, STORES: S,
    open: open, getAll: getAll, get: get, put: put, del: del, clearAll: clearAll,
    getAllRecords: getAllRecords, getMeta: getMeta, getSetting: getSetting,
    putMeta: putMeta, putSetting: putSetting,
    putRecords: putRecords, replaceRecords: replaceRecords,
    getAllImages: getAllImages, putImage: putImage, deleteImage: deleteImage,
    readLegacy: readLegacy, writeMigration: writeMigration
  };
})();
