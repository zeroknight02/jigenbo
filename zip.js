/* 极简 ZIP 读写：只用 STORE（不压缩）和 deflate 解压，避免任何外部依赖。
   API：ZipKit.create([{name, data:Uint8Array}]) -> Blob
        ZipKit.read(ArrayBuffer) -> Promise<{name: Uint8Array}> */
(function () {
  'use strict';

  var TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(u8) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8(str) { return new TextEncoder().encode(str); }

  function create(files) {
    var chunks = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = utf8(f.name);
      var data = f.data || new Uint8Array(0);
      var crc = crc32(data);
      var lh = new Uint8Array(30 + name.length);
      var dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0x0800, true);
      dv.setUint16(8, 0, true);
      dv.setUint16(10, 0, true);
      dv.setUint16(12, 0, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true);
      dv.setUint32(22, data.length, true);
      dv.setUint16(26, name.length, true);
      dv.setUint16(28, 0, true);
      lh.set(name, 30);
      chunks.push(lh, data);

      var cd = new Uint8Array(46 + name.length);
      var cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      cd.set(name, 46);
      central.push(cd);
      offset += lh.length + data.length;
    });
    var cdSize = central.reduce(function (n, c) { return n + c.length; }, 0);
    var eocd = new Uint8Array(22);
    var ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);
    return new Blob(chunks.concat(central, [eocd]), { type: 'application/zip' });
  }

  function inflateRaw(u8) {
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('当前浏览器不支持解压这个 ZIP'));
    }
    var ds = new DecompressionStream('deflate-raw');
    return new Response(new Blob([u8]).stream().pipeThrough(ds))
      .arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }

  function read(buffer) {
    var u8 = new Uint8Array(buffer);
    var dv = new DataView(buffer);
    var eocd = -1;
    var min = Math.max(0, u8.length - 65558);
    for (var i = u8.length - 22; i >= min; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return Promise.reject(new Error('不是有效的 ZIP 文件'));
    var count = dv.getUint16(eocd + 10, true);
    var pos = dv.getUint32(eocd + 16, true);
    var entries = [];
    for (var n = 0; n < count; n++) {
      if (dv.getUint32(pos, true) !== 0x02014b50) return Promise.reject(new Error('ZIP 目录损坏'));
      var method = dv.getUint16(pos + 10, true);
      var csize = dv.getUint32(pos + 20, true);
      var nameLen = dv.getUint16(pos + 28, true);
      var extraLen = dv.getUint16(pos + 30, true);
      var commentLen = dv.getUint16(pos + 32, true);
      var lho = dv.getUint32(pos + 42, true);
      var name = new TextDecoder().decode(u8.subarray(pos + 46, pos + 46 + nameLen));
      var lNameLen = dv.getUint16(lho + 26, true);
      var lExtra = dv.getUint16(lho + 28, true);
      var start = lho + 30 + lNameLen + lExtra;
      entries.push({ name: name, method: method, data: u8.slice(start, start + csize) });
      pos += 46 + nameLen + extraLen + commentLen;
    }
    return Promise.all(entries.map(function (e) {
      if (e.method === 0) return Promise.resolve(e);
      if (e.method === 8) return inflateRaw(e.data).then(function (d) { return { name: e.name, data: d }; });
      return Promise.reject(new Error('不支持的 ZIP 压缩方式'));
    })).then(function (list) {
      var out = {};
      list.forEach(function (x) { out[x.name] = x.data; });
      return out;
    });
  }

  window.ZipKit = { create: create, read: read };
})();
