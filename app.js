/* ==========================================================
   次元簿 · 个人文娱记录
   纯前端 / localStorage / JSON 导入导出
   ========================================================== */
(function () {
  'use strict';

  /* ---------------- 常量 ---------------- */

  var SCHEMA_VERSION = 1;

  /* 每次发布改这里和 sw.js 的 VERSION（两者一起改） */
  var APP_VERSION = '1.17';
  var SW_VERSION = 'v18';
  var DB_KEY = 'shilu.db.v1';
  var PREF_KEY = 'shilu.prefs.v1';
  var DAY = 86400000;

  /* mode: book 按章/话或卷/部；series 按季+集/话/期；percent 按完成度；single 无进度；issue 按刊期 */
  var TYPES = {
    novel: {
      label: '小说', mode: 'book', itemUnit: '章', volumeUnit: '部', segUnit: '部',
      creator: '作者', creatorHint: '作者名', color: '#E8457A'
    },
    comic: {
      label: '漫画', mode: 'book', itemUnit: '话', volumeUnit: '卷', segUnit: '卷',
      creator: '作者 / 绘者', creatorHint: '原作 / 作画', color: '#E8913D'
    },
    anime: {
      label: '动漫', mode: 'series', itemUnit: '话', segUnit: '季',
      creator: '监督 / 制作', creatorHint: '监督或动画公司', color: '#45AFA0'
    },
    tv: {
      label: '电视剧', mode: 'series', itemUnit: '集', segUnit: '季',
      creator: '导演 / 主创', creatorHint: '导演或主创', color: '#7C6BFF'
    },
    movie: {
      label: '电影', mode: 'single',
      creator: '导演 / 主创', creatorHint: '导演或主创', color: '#3FA9E0'
    },
    variety: {
      label: '综艺', mode: 'series', itemUnit: '期', segUnit: '季',
      creator: '主持 / 制作', creatorHint: '主持或制作团队', color: '#E8B33D'
    },
    drama: {
      label: '广播剧', mode: 'series', itemUnit: '集', segUnit: '季',
      creator: '出品 / 制作', creatorHint: '出品方或制作组', color: '#5C8BE8'
    },
    stage: {
      label: '舞台剧', mode: 'single',
      creator: '剧团 / 导演', creatorHint: '剧团或导演', color: '#D96A4A'
    },
    game: {
      label: '游戏', mode: 'percent',
      creator: '开发 / 发行', creatorHint: '开发商或发行商', color: '#5FB86B'
    },
    music: {
      label: '音乐', mode: 'single',
      creator: '艺人 / 歌手', creatorHint: '歌手或乐团', color: '#A96BE0'
    },
    magazine: {
      label: '期刊', mode: 'issue', itemUnit: '期',
      creator: '出版方', creatorHint: '出版社 / 编辑部', color: '#D05FA8'
    }
  };
  var TYPE_KEYS = ['novel', 'comic', 'anime', 'tv', 'movie', 'variety', 'drama', 'stage', 'game', 'music', 'magazine'];

  var MAG_EDITIONS = ['国内版', '港版', '台版', '日版', '韩版', '美版', '欧版', '其他'];
  var MAG_PARTS = ['A', 'B', 'C', '合刊', '增刊', '别册'];
  var MAG_FREQ = ['周刊', '旬刊', '半月刊', '月刊', '双月刊', '季刊', '不定期'];
  var META_KEYS = ['publisher', 'translator', 'platform', 'runtime', 'serialStatus', 'studio', 'country',
    'cv', 'venue', 'albumType', 'gameType', 'source', 'cast'];

  /* 看剧 / 观影笔记分区 */
  var SECTION_KEYS = [
    { key: 'plot', label: '剧情' },
    { key: 'cast', label: '演员' },
    { key: 'prod', label: '制作' },
    { key: 'music', label: '配乐' },
    { key: 'tear', label: '泪点' },
    { key: 'lines', label: '台词' }
  ];

  var RECOMMEND_LEVELS = [
    { key: 'yes', label: '推荐', mark: '♥♥♥' },
    { key: 'meh', label: '一般', mark: '♥♥' },
    { key: 'no', label: '不推荐', mark: '♥' }
  ];

  /* 每种类型额外字段（渲染用） */
  var EXTRA_FIELDS = {
    novel: [
      { key: 'publisher', label: '出版社', placeholder: '选填' },
      { key: 'translator', label: '译者', placeholder: '选填' },
      { key: 'source', label: '书籍来源', options: ['购买', '借阅', '赠书', '图书馆', '电子书', '其他'] }
    ],
    comic: [
      { key: 'publisher', label: '出版社 / 连载杂志', placeholder: '选填' },
      { key: 'serialStatus', label: '连载状态', placeholder: '连载中 / 已完结', options: ['连载中', '已完结', '休载'] },
      { key: 'source', label: '书籍来源', options: ['购买', '借阅', '赠书', '图书馆', '电子书', '其他'] }
    ],
    tv: [
      { key: 'platform', label: '播出平台', placeholder: 'Netflix / 爱奇艺 …' },
      { key: 'runtime', label: '单集时长（分钟）', placeholder: '45', numeric: true },
      { key: 'cast', label: '主演', placeholder: '用顿号分隔' }
    ],
    anime: [
      { key: 'studio', label: '制作公司', placeholder: 'MADHOUSE …' },
      { key: 'platform', label: '播出平台', placeholder: 'B 站 / Netflix …' },
      { key: 'cast', label: '主役声优', placeholder: '用顿号分隔' }
    ],
    variety: [
      { key: 'platform', label: '播出平台', placeholder: '芒果 TV …' },
      { key: 'runtime', label: '单集时长（分钟）', placeholder: '90', numeric: true }
    ],
    movie: [
      { key: 'runtime', label: '片长（分钟）', placeholder: '120', numeric: true },
      { key: 'country', label: '制片国家 / 地区', placeholder: '中国大陆 / 日本 …' },
      { key: 'cast', label: '主演', placeholder: '用顿号分隔' }
    ],
    drama: [
      { key: 'platform', label: '收听平台', placeholder: '猫耳 FM / M 站 …' },
      { key: 'cv', label: '主役声优', placeholder: '选填' }
    ],
    stage: [
      { key: 'venue', label: '剧场 / 城市', placeholder: '选填' },
      { key: 'runtime', label: '时长（分钟）', placeholder: '150', numeric: true }
    ],
    game: [
      { key: 'platform', label: '平台', placeholder: 'PC / PS5 / Switch …' },
      { key: 'gameType', label: '类型', options: ['单机', '手游', '主机', '网页', '独立', '其他'] }
    ],
    music: [
      { key: 'publisher', label: '唱片公司', placeholder: '选填' },
      { key: 'albumType', label: '专辑类型', options: ['专辑', '单曲', 'OST', '角色歌', '同人'] }
    ],
    magazine: []
  };

  var STATUSES = { wish: '愿望单', doing: '进行中', done: '已完成', paused: '搁置' };
  var STATUS_KEYS = ['wish', 'doing', 'done', 'paused'];

  var PRESET_TAGS = ['科幻', '奇幻', '悬疑', '推理', '言情', '历史', '武侠', '都市', '治愈',
    '恐怖', '青春', '纪实', '剧情', '喜剧', '动画', '犯罪', '冒险', '文艺', '家庭', '战争'];

  var COVER_COLORS = ['#E86A9A', '#E89A4E', '#8C7BE8', '#4FA8D8', '#D96A9E',
    '#6E86E8', '#45AFA0', '#E07A5F', '#9A6FD8', '#5B9FE0'];

  var LOG_LABELS = { add: '收录', start: '开始', finish: '完成', pause: '搁置', rewatch: '重看', wish: '愿望单' };

  /* ---------------- 图标 ---------------- */

  var ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m16.4 16.4 4.1 4.1"/>',
    gear: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2.3" fill="currentColor" stroke="none"/><circle cx="8" cy="17" r="2.3" fill="currentColor" stroke="none"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    trash: '<path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l.9 13h9.2l.9-13"/>',
    download: '<path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14"/>',
    share: '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.8 15.7 6.3M8.3 13.2l7.4 4.5"/>',
    check: '<path d="M5 12.5 10 17.5 19 7"/>',
    sparkle: '<path d="M12 3.5 13.7 9l5.3 1.8-5.3 1.8L12 18l-1.7-5.4L5 10.8 10.3 9z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/>',
    novel: '<path d="M12 6.6C10.4 5.1 8 4.6 5 4.6v13.2c3 0 5.4.5 7 2 1.6-1.5 4-2 7-2V4.6c-3 0-5.4.5-7 2z"/><path d="M12 6.6v13.2"/>',
    comic: '<rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="M8 9h5M8 13h8M8 17h4"/>',
    tv: '<rect x="2.5" y="6" width="19" height="12.5" rx="2.5"/><path d="M8 21.4h8M12 18.5v2.9"/>',
    movie: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M8 5v14M16 5v14M3 9.4h5M3 14.6h5M16 9.4h5M16 14.6h5"/>',
    anime: '<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="m10 8.8 5.2 3.2-5.2 3.2z"/>',
    variety: '<rect x="9" y="2.8" width="6" height="10.4" rx="3"/><path d="M5.8 11.2a6.2 6.2 0 0 0 12.4 0M12 17.4V21M9 21h6"/>',
    magazine: '<rect x="4.5" y="3" width="15" height="18" rx="2.5"/><path d="M8 7h8M8 10.6h8M8 14.2h5"/><path d="M2.6 6.4v11"/>',
    drama: '<path d="M4 14.5v-2a8 8 0 0 1 16 0v2"/><rect x="2.4" y="13.2" width="4.6" height="7.4" rx="2.3"/><rect x="17" y="13.2" width="4.6" height="7.4" rx="2.3"/>',
    stage: '<path d="M3.4 5.4h17.2v6.2a8.6 8.6 0 0 1-17.2 0z"/><path d="M8.2 9.2h.02M15.8 9.2h.02"/><path d="M8.4 13.6c1.9 1.6 5.3 1.6 7.2 0"/>',
    game: '<rect x="2.4" y="7" width="19.2" height="10" rx="5"/><path d="M7 10.2v3.6M5.2 12h3.6"/><circle cx="16" cy="10.9" r="1.05"/><circle cx="18.3" cy="13.2" r="1.05"/>',
    music: '<path d="M9.2 17.6V6.4l9.4-1.9v11.2"/><ellipse cx="6.6" cy="17.8" rx="2.7" ry="2.3"/><ellipse cx="16" cy="15.9" rx="2.7" ry="2.3"/>',
    'check-square': '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 12.2 11 15l5-5.6"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.6" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.6" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.6" cy="18" r="1.2" fill="currentColor" stroke="none"/>',
    grid: '<rect x="3.6" y="3.6" width="7" height="7" rx="2"/><rect x="13.4" y="3.6" width="7" height="7" rx="2"/><rect x="3.6" y="13.4" width="7" height="7" rx="2"/><rect x="13.4" y="13.4" width="7" height="7" rx="2"/>',
    wall: '<rect x="3.4" y="3.4" width="5.4" height="17.2" rx="1.8"/><rect x="9.7" y="3.4" width="5.4" height="17.2" rx="1.8"/><rect x="16" y="3.4" width="4.6" height="17.2" rx="1.8"/>',
    quote: '<path d="M9.6 6.4c-3 1.4-4.6 3.7-4.6 6.9v4.3h5.4v-5.4H7.6c0-1.9.9-3.2 2.9-4.1zM19.6 6.4c-3 1.4-4.6 3.7-4.6 6.9v4.3h5.4v-5.4h-2.8c0-1.9.9-3.2 2.9-4.1z" fill="currentColor" stroke="none"/>',
    user: '<circle cx="12" cy="8.4" r="3.6"/><path d="M4.8 20c.6-3.6 3.5-5.6 7.2-5.6s6.6 2 7.2 5.6"/>',
    archive: '<rect x="3.4" y="4.2" width="17.2" height="4.6" rx="2"/><path d="M5 8.8v9.4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.8"/><path d="M9.8 12.6h4.4"/>',

  };

  function icon(name, size, cls) {
    return '<svg class="ico ' + (cls || '') + '" width="' + (size || 20) + '" height="' + (size || 20) +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  /* ---------------- 工具 ---------------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function md(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function todayISO() { return ymd(new Date()); }

  function uid() {
    return 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function clampRating(v) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return Math.min(10, Math.round(n * 2) / 2);
  }

  function num(v) {
    var n = Number(v);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function fmtHours(h) {
    if (!h) return '0';
    return (Math.round(h * 10) / 10).toString();
  }

  function cnNum(n) {
    var d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    if (n <= 10) return d[n] || String(n);
    if (n < 20) return '十' + d[n - 10];
    return String(n);
  }

  function coverColor(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 9973;
    return COVER_COLORS[h % COVER_COLORS.length];
  }

  function firstChar(s) {
    return String(s || '?').trim().charAt(0) || '?';
  }

  function sameMonth(ts, date) {
    var d = new Date(ts);
    return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth();
  }

  function recordYear(r) {
    var m = String(r.year || '').match(/(19|20)\d{2}/);
    return m ? m[0] : '';
  }

  function safeCover(url) {
    return /^https?:\/\//i.test(String(url || '')) ? String(url) : '';
  }

  /* ---------- 评分制 ---------- */

  function ratingScale() {
    return state.prefs.ratingScale === '5' ? 5 : 10;
  }

  function ratingText(v, dash) {
    if (!v) return dash === false ? '' : '—';
    if (ratingScale() === 5) return (Math.round(v) / 2).toFixed(1).replace(/\.0$/, '');
    return v.toFixed(1);
  }

  function ratingBadge(v) {
    if (!v) return '';
    if (ratingScale() === 5) return '<span class="rating-star">★</span>' + ratingText(v);
    return ratingText(v);
  }

  function isReleased(r) {
    if (r.releaseDate) return r.releaseDate <= todayISO();
    var y = recordYear(r);
    if (y) return Number(y) <= new Date().getFullYear();
    return true;
  }

  function releaseTs(r) {
    if (r.releaseDate) return Date.parse(r.releaseDate) || 0;
    var y = recordYear(r);
    return y ? Date.parse(y + '-01-01') || 0 : 0;
  }

  /* ---------------- 状态 ---------------- */

  var state = {
    records: [],
    lists: [],
    prefs: { theme: 'system', lastExportAt: 0, ratingScale: '10', goalCount: 0, goalHours: 0 },
    route: { name: 'home', id: null },
    returnTo: '#/home',
    filters: { status: 'all', type: 'all', tag: 'all', year: 'all', release: 'all', rating: 'all', sort: 'updated' },
    ui: {
      listId: 'all', selectMode: false, selected: {}, sortMode: false, view: 'grid', fold: {},
      quoteType: 'all', quoteQ: ''
    },
    archive: { year: 0 },
    serverSw: '',
    authors: { open: '' },
    categories: [],
    timeline: { view: 'axis', y: 0, m: 0, selected: null, type: 'all' },
    checkins: [],
    checkin: { y: 0, m: 0, sel: '' },
    report: { year: 0, month: 'all', type: 'all', data: null },
    draft: null,
    search: '',
    pasteOpen: false,
    pasteText: ''
  };

  /* ---------------- 存储 ---------------- */

  function normalizeMeta(m) {
    var o = {};
    if (!m || typeof m !== 'object') return o;
    META_KEYS.forEach(function (k) {
      if (m[k] != null && String(m[k]).trim()) o[k] = String(m[k]).trim().slice(0, 60);
    });
    return o;
  }

  function normalizeMagazine(m, fallbackYear) {
    var o = m && typeof m === 'object' ? m : {};
    var y = String(o.year || '');
    if (!/^(19|20)\d{2}$/.test(y)) {
      var fy = String(fallbackYear || '');
      y = /^(19|20)\d{2}$/.test(fy) ? fy : '';
    }
    var mo = Number(o.month);
    return {
      edition: MAG_EDITIONS.indexOf(o.edition) >= 0 ? o.edition : '',
      year: y,
      month: (mo >= 1 && mo <= 12) ? String(mo) : '',
      part: MAG_PARTS.indexOf(o.part) >= 0 ? o.part : '',
      issueNo: String(o.issueNo == null ? '' : o.issueNo).slice(0, 12),
      totalNo: String(o.totalNo == null ? '' : o.totalNo).slice(0, 12),
      frequency: MAG_FREQ.indexOf(o.frequency) >= 0 ? o.frequency : '',
      publisher: String(o.publisher || '').slice(0, 60)
    };
  }

  function normalizeRecord(r) {
    if (!r || typeof r !== 'object') return null;
    var title = String(r.title == null ? '' : r.title).trim();
    if (!title) return null;
    var now = Date.now();
    var type = TYPE_KEYS.indexOf(r.type) >= 0 ? r.type : 'novel';
    var mode = TYPES[type].mode;
    var p = r.progress && typeof r.progress === 'object' ? r.progress : {};

    /* 计量单位：小说 / 漫画可以在「章 / 话」与「卷 / 部」之间切换，两套数值分别保存 */
    var unit = (mode === 'book' && (p.unit === 'volume' || p.unit === 'page')) ? p.unit : 'chapter';
    var hasCh = p.chapter && typeof p.chapter === 'object';
    var hasVol = p.volume && typeof p.volume === 'object';
    var chapter = {
      current: hasCh ? num(p.chapter.current) : (unit === 'chapter' ? num(p.current) : 0),
      total: hasCh ? num(p.chapter.total) : (unit === 'chapter' ? num(p.total) : 0)
    };
    var volume = {
      current: hasVol ? num(p.volume.current) : (unit === 'volume' ? num(p.current) : 0),
      total: hasVol ? num(p.volume.total) : (unit === 'volume' ? num(p.total) : 0)
    };
    var page = {
      current: num(p.page && p.page.current),
      total: num(p.page && p.page.total)
    };

    /* 完成度：游戏这类没有固定章节的，用 0-100 百分比 */
    var percent = Math.max(0, Math.min(100, Math.round(Number(p.percent) || 0)));

    /* 分段进度：剧集按季、小说按部、漫画按卷；旧的 seasons 字段自动读入 */
    var segments = [];
    var rawSegs = Array.isArray(p.segments) ? p.segments : (Array.isArray(p.seasons) ? p.seasons : null);
    if (rawSegs) {
      segments = rawSegs.map(function (sg, i) {
        var st = num(sg && sg.total);
        var sc = num(sg && sg.current);
        var sd = !!(sg && sg.done) || (st > 0 && sc >= st);
        if (sd && st > 0) sc = st;
        return { n: num(sg && sg.n) || i + 1, current: sc, total: st, done: sd };
      });
    } else if (mode === 'series' && (num(p.current) > 0 || num(p.total) > 0)) {
      var t1 = num(p.total);
      var c1 = num(p.current);
      segments = [{ n: num(p.season) || 1, current: c1, total: t1, done: t1 > 0 && c1 >= t1 }];
    }

    var ud = Number(r.updateDay);
    var updateDay = (isFinite(ud) && ud >= 0 && ud <= 6) ? ud : -1;

    /* 旧字段保持同步，导出的 JSON 仍然可读 */
    var legacy = { current: num(p.current), total: num(p.total), season: num(p.season) };
    if (mode === 'series' && segments.length) {
      var act = null;
      for (var si = segments.length - 1; si >= 0; si--) {
        if (!segments[si].done) { act = segments[si]; break; }
      }
      if (!act) act = segments[segments.length - 1];
      legacy = { current: act.current, total: act.total, season: act.n };
    } else if (mode === 'book') {
      var srcU = unit === 'volume' ? volume : (unit === 'page' ? page : chapter);
      legacy = { current: srcU.current, total: srcU.total, season: 1 };
    }

    var startedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(r.startedAt || '')) ? String(r.startedAt) : '';
    var finishedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(r.finishedAt || '')) ? String(r.finishedAt) : '';

    var episodes = Array.isArray(r.episodes) ? r.episodes.map(function (e) {
      return {
        id: (e && e.id) || uid(),
        no: Math.max(0, Math.floor(num(e && e.no))),
        date: (e && /^\d{4}-\d{2}-\d{2}$/.test(String(e.date || ''))) ? String(e.date) : '',
        rating: clampRating(e && e.rating),
        review: e && e.review ? String(e.review).slice(0, 300) : ''
      };
    }).filter(function (e) { return e.no > 0 || e.review; }).slice(0, 300) : [];

    var douban = Math.max(0, Math.min(10, Math.round((Number(r.douban) || 0) * 10) / 10));
    var recommend = ['yes', 'meh', 'no'].indexOf(r.recommend) >= 0 ? r.recommend : '';
    var category = r.category ? String(r.category).slice(0, 16) : '';

    var rawSec = r.sections && typeof r.sections === 'object' ? r.sections : {};
    var sections = {};
    var hasSection = false;
    SECTION_KEYS.forEach(function (sec) {
      var v = rawSec[sec.key] ? String(rawSec[sec.key]).slice(0, 2000) : '';
      sections[sec.key] = v;
      if (v) hasSection = true;
    });

    var notesLog = Array.isArray(r.notesLog) ? r.notesLog.map(function (n) {
      return {
        id: (n && n.id) || uid(),
        date: (n && /^\d{4}-\d{2}-\d{2}$/.test(String(n.date || ''))) ? String(n.date) : todayISO(),
        text: n && n.text ? String(n.text).slice(0, 3000) : ''
      };
    }).filter(function (n) { return n.text.trim(); }).slice(0, 100) : [];

    var quotes = Array.isArray(r.quotes) ? r.quotes.map(function (q) {
      return {
        id: (q && q.id) || uid(),
        text: q && q.text ? String(q.text).slice(0, 600) : '',
        page: q && q.page ? String(q.page).slice(0, 24) : ''
      };
    }).filter(function (q) { return q.text.trim(); }).slice(0, 300) : [];
    if (!quotes.length && r.quote) {
      quotes = [{ id: uid(), text: String(r.quote).slice(0, 600), page: '' }];
    }

    var rewatches = Array.isArray(r.rewatches) ? r.rewatches.map(function (w) {
      return {
        id: (w && w.id) || uid(),
        date: (w && w.date) || '',
        rating: clampRating(w && w.rating),
        review: w && w.review ? String(w.review).slice(0, 600) : ''
      };
    }) : [];
    var logs = Array.isArray(r.logs) ? r.logs.filter(function (l) {
      return l && l.action && isFinite(Number(l.at));
    }).map(function (l) {
      return { action: String(l.action), at: Number(l.at) };
    }) : [];

    return {
      id: r.id ? String(r.id) : uid(),
      type: type,
      title: title.slice(0, 120),
      originalTitle: r.originalTitle ? String(r.originalTitle).slice(0, 120) : '',
      aliases: Array.isArray(r.aliases) ? r.aliases.filter(function (t) {
        return typeof t === 'string' && t.trim();
      }).map(function (t) { return t.trim().slice(0, 40); }).slice(0, 10) : [],
      creator: r.creator ? String(r.creator).slice(0, 80) : '',
      year: r.year ? String(r.year).slice(0, 12) : '',
      releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(String(r.releaseDate || '')) ? String(r.releaseDate) : '',
      tags: Array.isArray(r.tags) ? r.tags.filter(function (t) {
        return typeof t === 'string' && t.trim();
      }).map(function (t) { return t.trim().slice(0, 16); }).slice(0, 20) : [],
      rating: clampRating(r.rating),
      status: STATUS_KEYS.indexOf(r.status) >= 0 ? r.status : 'wish',
      review: r.review ? String(r.review).slice(0, 2000) : '',
      quotes: quotes,
      douban: douban,
      recommend: recommend,
      category: category,
      sections: sections,
      hasSection: hasSection,
      notesLog: notesLog,
      hours: num(r.hours),
      cover: safeCover(r.cover),
      updateDay: updateDay,
      meta: normalizeMeta(r.meta),
      magazine: normalizeMagazine(r.magazine, r.year),
      startedAt: startedAt,
      finishedAt: finishedAt,
      episodes: episodes,
      progress: {
        unit: unit,
        current: legacy.current,
        total: legacy.total,
        season: legacy.season,
        percent: percent,
        chapter: chapter,
        volume: volume,
        page: page,
        segments: segments
      },
      rewatches: rewatches,
      logs: logs,
      createdAt: Number(r.createdAt) || now,
      updatedAt: Number(r.updatedAt) || now
    };
  }

  function normalizeCategories(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (c) {
      var v = String(c || '').trim().slice(0, 16);
      if (v && out.indexOf(v) < 0) out.push(v);
    });
    return out.slice(0, 80);
  }

  function normalizeCheckin(c) {
    if (!c || typeof c !== 'object') return null;
    var date = /^\d{4}-\d{2}-\d{2}$/.test(String(c.date || '')) ? String(c.date) : '';
    if (!date) return null;
    return {
      id: c.id ? String(c.id) : uid(),
      date: date,
      recordId: c.recordId ? String(c.recordId) : '',
      minutes: Math.max(0, Math.min(1440, Math.floor(num(c.minutes)))),
      note: c.note ? String(c.note).slice(0, 200) : ''
    };
  }

  function normalizeList(l) {
    if (!l || typeof l !== 'object' || !l.name) return null;
    var ru = l.rules && typeof l.rules === 'object' ? l.rules : {};
    return {
      id: l.id ? String(l.id) : 'l_' + uid(),
      name: String(l.name).slice(0, 30),
      kind: l.kind === 'manual' ? 'manual' : 'smart',
      rules: {
        status: STATUS_KEYS.indexOf(ru.status) >= 0 ? ru.status : 'all',
        type: TYPE_KEYS.indexOf(ru.type) >= 0 ? ru.type : 'all',
        year: ru.year ? String(ru.year) : 'all',
        minRating: clampRating(ru.minRating),
        tags: Array.isArray(ru.tags) ? ru.tags.filter(function (t) { return typeof t === 'string' && t; }).slice(0, 6) : []
      },
      ids: Array.isArray(l.ids) ? l.ids.filter(function (x) { return typeof x === 'string'; }) : []
    };
  }

  var currentSavedAt = '';

  function applyRaw(raw) {
    if (!raw) return '';
    var data;
    try { data = JSON.parse(raw); } catch (e) { return ''; }
    var list = data && Array.isArray(data.records) ? data.records : [];
    state.records = list.map(normalizeRecord).filter(Boolean);
    state.lists = (data && Array.isArray(data.lists) ? data.lists : []).map(normalizeList).filter(Boolean);
    var seenDates = {};
    state.checkins = (data && Array.isArray(data.checkins) ? data.checkins : [])
      .map(normalizeCheckin).filter(Boolean).filter(function (c) {
        if (seenDates[c.date]) return false;
        seenDates[c.date] = true;
        return true;
      });
    state.categories = normalizeCategories(data && data.categories);
    return (data && data.savedAt) || '';
  }

  function load() {
    try {
      var raw = localStorage.getItem(DB_KEY);
      if (raw) currentSavedAt = applyRaw(raw);
    } catch (e) {
      console.warn('读取本地缓存失败', e);
    }
    try {
      var p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      if (p.theme) state.prefs.theme = p.theme;
      if (p.lastExportAt) state.prefs.lastExportAt = Number(p.lastExportAt) || 0;
      if (p.ratingScale === '5') state.prefs.ratingScale = '5';
    } catch (e) { /* ignore */ }
  }

  /* ---------------- IndexedDB 主存储 ---------------- */
  /* 主存储：IndexedDB，一条记录一个 key，保存时只写改动过的条目。
     localStorage 只在记录不多时当启动缓存（保证首屏同步渲染、不闪空），
     数据量大了自动停用缓存，改为从数据库异步载入。 */

  var DB_NAME = 'shilu-db';
  var DB_VER = 2;
  var DB_REC = 'records';
  var DB_META = 'meta';
  var CACHE_MAX_RECORDS = 2200;   /* 超过这个条数就不再写 localStorage 缓存 */
  var CACHE_MIN_INTERVAL = 10000; /* 缓存最快 10 秒写一次，避免每次保存都全量序列化 */

  var dbPromise = null;
  var written = {};        /* id -> 上次写入数据库时的 JSON，用于算增量 */
  var writeTimer = null;

  function dbOpen() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      if (!window.indexedDB) { resolve(null); return; }
      var req;
      try { req = window.indexedDB.open(DB_NAME, DB_VER); } catch (e) { resolve(null); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(DB_REC)) db.createObjectStore(DB_REC, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(DB_META)) db.createObjectStore(DB_META, { keyPath: 'k' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
      req.onblocked = function () { resolve(null); };
    });
    return dbPromise;
  }

  function dbGetAllRecords() {
    return dbOpen().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var req = db.transaction(DB_REC, 'readonly').objectStore(DB_REC).getAll();
          req.onsuccess = function () { resolve(req.result || []); };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    }).catch(function () { return null; });
  }

  function dbGetMeta(k) {
    return dbOpen().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var req = db.transaction(DB_META, 'readonly').objectStore(DB_META).get(k);
          req.onsuccess = function () { resolve(req.result || null); };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    }).catch(function () { return null; });
  }

  /* 读旧版本（v1 单块存储）留下的数据，用于迁移 */
  function dbGetLegacy() {
    return dbOpen().then(function (db) {
      if (!db || !db.objectStoreNames.contains('state')) return null;
      return new Promise(function (resolve) {
        try {
          var req = db.transaction('state', 'readonly').objectStore('state').get('db');
          req.onsuccess = function () { resolve(req.result || null); };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    }).catch(function () { return null; });
  }

  function seedWritten(list) {
    written = {};
    for (var i = 0; i < list.length; i++) {
      try { written[list[i].id] = JSON.stringify(list[i]); } catch (e) { /* ignore */ }
    }
  }

  /* 全量写入（迁移 / 缓存比数据库新时使用） */
  function dbImport(records, lists, checkins, categories) {
    return dbOpen().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction([DB_REC, DB_META], 'readwrite');
          var store = tx.objectStore(DB_REC);
          store.clear();
          for (var i = 0; i < records.length; i++) store.put(records[i]);
          tx.objectStore(DB_META).put({
            k: 'collections', savedAt: currentSavedAt,
            lists: lists, checkins: checkins, categories: categories
          });
          tx.oncomplete = function () { seedWritten(records); resolve(true); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    }).catch(function () { return false; });
  }

  /* 增量写入：只 put 新增/改动的，delete 已删除的 */
  function flushWrite() {
    writeTimer = null;
    return dbOpen().then(function (db) {
      if (!db) return false;
      var list = state.records;
      var next = {};
      var puts = [];
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        var j;
        try { j = JSON.stringify(r); } catch (e) { continue; }
        next[r.id] = j;
        if (written[r.id] !== j) puts.push(r);
      }
      var dels = [];
      for (var id in written) {
        if (!(id in next)) dels.push(id);
      }
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction([DB_REC, DB_META], 'readwrite');
          var store = tx.objectStore(DB_REC);
          for (var k = 0; k < puts.length; k++) store.put(puts[k]);
          for (var m = 0; m < dels.length; m++) store.delete(dels[m]);
          tx.objectStore(DB_META).put({
            k: 'collections', savedAt: currentSavedAt,
            lists: state.lists, checkins: state.checkins, categories: state.categories
          });
          tx.oncomplete = function () { written = next; resolve(true); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    }).catch(function () { return false; });
  }

  function dbClear() {
    return dbOpen().then(function (db) {
      if (!db) return;
      try {
        var tx = db.transaction([DB_REC, DB_META], 'readwrite');
        tx.objectStore(DB_REC).clear();
        tx.objectStore(DB_META).clear();
      } catch (e) { /* ignore */ }
      written = {};
    }).catch(function () { /* ignore */ });
  }

  function queueWrite() {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(flushWrite, 250);
  }

  function applyCollections(meta) {
    if (!meta) return;
    state.lists = (Array.isArray(meta.lists) ? meta.lists : []).map(normalizeList).filter(Boolean);
    var seenDates = {};
    state.checkins = (Array.isArray(meta.checkins) ? meta.checkins : [])
      .map(normalizeCheckin).filter(Boolean).filter(function (c) {
        if (seenDates[c.date]) return false;
        seenDates[c.date] = true;
        return true;
      });
    state.categories = normalizeCategories(meta.categories);
  }

  /* 启动时：迁移旧数据 / 用数据库校正缓存 */
  function initDB() {
    dbOpen().then(function (db) {
      if (!db) return null;
      return Promise.all([dbGetAllRecords(), dbGetMeta('collections')]).then(function (res) {
        var recs = res[0] || [];
        var meta = res[1] || null;
        var localRaw = null;
        try { localRaw = localStorage.getItem(DB_KEY); } catch (e) { /* ignore */ }

        /* 空库：先把旧数据迁进来 */
        if (!recs.length && !meta) {
          if (localRaw) {
            return dbImport(state.records, state.lists, state.checkins, state.categories);
          }
          return dbGetLegacy().then(function (row) {
            if (!row || !row.json) return null;
            var data = null;
            try { data = JSON.parse(row.json); } catch (e) { return null; }
            var list = (data && Array.isArray(data.records) ? data.records : []).map(normalizeRecord).filter(Boolean);
            var lists = (data && Array.isArray(data.lists) ? data.lists : []).map(normalizeList).filter(Boolean);
            var seen = {};
            var cks = (data && Array.isArray(data.checkins) ? data.checkins : [])
              .map(normalizeCheckin).filter(Boolean).filter(function (c) {
                if (seen[c.date]) return false;
                seen[c.date] = true;
                return true;
              });
            state.records = list;
            state.lists = lists;
            state.checkins = cks;
            state.categories = normalizeCategories(data && data.categories);
            currentSavedAt = (data && data.savedAt) || new Date().toISOString();
            render();
            return dbImport(list, lists, cks, state.categories);
          });
        }

        var dbSaved = (meta && meta.savedAt) || '';

        /* 没有缓存 → 完全以数据库为准 */
        if (!localRaw) {
          state.records = recs.map(normalizeRecord).filter(Boolean);
          applyCollections(meta);
          currentSavedAt = dbSaved;
          seedWritten(state.records);
          render();
          return null;
        }

        /* 数据库更新 → 覆盖内存 */
        if (dbSaved && currentSavedAt && dbSaved > currentSavedAt) {
          state.records = recs.map(normalizeRecord).filter(Boolean);
          applyCollections(meta);
          currentSavedAt = dbSaved;
          seedWritten(state.records);
          render();
          return null;
        }

        /* 缓存更新 → 推给数据库 */
        if (currentSavedAt && dbSaved && currentSavedAt > dbSaved) {
          return dbImport(state.records, state.lists, state.checkins, state.categories);
        }

        /* 一致 → 只记录基线，方便后面算增量 */
        seedWritten(recs.map(normalizeRecord).filter(Boolean));
        return null;
      });
    }).catch(function () { /* ignore */ });
  }

  var cacheTimer = null;
  var lastCacheAt = 0;

  function buildCacheJson() {
    try {
      return JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        savedAt: currentSavedAt,
        records: state.records,
        lists: state.lists,
        checkins: state.checkins,
        categories: state.categories
      });
    } catch (e) {
      return null;
    }
  }

  /* 立刻写缓存（节流到期 / 切后台时调用） */
  function writeCacheNow() {
    if (cacheTimer) { clearTimeout(cacheTimer); cacheTimer = null; }
    if (state.records.length > CACHE_MAX_RECORDS) {
      try { localStorage.removeItem(DB_KEY); } catch (e) { /* ignore */ }
      lastCacheAt = Date.now();
      return;
    }
    var json = buildCacheJson();
    try {
      if (json) localStorage.setItem(DB_KEY, json);
    } catch (e) {
      try { localStorage.removeItem(DB_KEY); } catch (e2) { /* ignore */ }
    }
    lastCacheAt = Date.now();
  }

  /* 节流：10 秒内最多写一次，避免频繁全量序列化 */
  function scheduleCacheWrite() {
    var wait = CACHE_MIN_INTERVAL - (Date.now() - lastCacheAt);
    if (wait <= 0) { writeCacheNow(); return; }
    if (cacheTimer) return;
    cacheTimer = setTimeout(writeCacheNow, wait);
  }

  function save() {
    currentSavedAt = new Date().toISOString();

    /* 偏好项很小，每次都写 */
    try { localStorage.setItem(PREF_KEY, JSON.stringify(state.prefs)); } catch (e) { /* ignore */ }

    scheduleCacheWrite();
    queueWrite();
  }

  function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(state.prefs)); } catch (e) { /* ignore */ }
  }

  /* ---------------- 主题 ---------------- */

  function applyTheme() {
    var t = state.prefs.theme;
    var dark = t === 'dark' || (t === 'system' && window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#14111F' : '#FAF7FF');
  }

  /* ---------------- 路由 ---------------- */

  function parseRoute() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/');
    var name = parts[0];
    if (!name) return { name: 'home', id: null };
    if (name === 'edit' && parts[1]) return { name: 'edit', id: parts[1] };
    if (['home', 'library', 'timeline', 'stats', 'settings', 'new',
      'quotes', 'authors', 'archive'].indexOf(name) >= 0) {
      return { name: name, id: null };
    }
    return { name: 'home', id: null };
  }

  var view = document.getElementById('view');

  function render(opts) {
    opts = opts || {};
    var y = window.scrollY;
    var r = state.route;
    document.body.classList.toggle('is-editing', r.name === 'new' || r.name === 'edit');
    document.body.classList.toggle('is-selecting', !!state.ui.selectMode && r.name === 'library');

    var html = '';
    if (r.name === 'home') html = homeView();
    else if (r.name === 'library') html = libraryView();
    else if (r.name === 'new' || r.name === 'edit') html = editView();
    else if (r.name === 'timeline') html = timelineView();
    else if (r.name === 'stats') html = statsView();
    else if (r.name === 'quotes') html = quotesView();
    else if (r.name === 'authors') html = authorsView();
    else if (r.name === 'archive') html = archiveView();
    else if (r.name === 'settings') html = settingsView();

    view.innerHTML = '<div class="page">' + html + '</div>';
    updateTabbar();
    if (opts.keepScroll) window.scrollTo(0, y);
    else window.scrollTo(0, 0);
    afterRender();
  }

  function afterRender() {
    if (state.ui.sortMode) enableDragSort();
    if (state.route.name === 'quotes' && state.ui.quoteQ) filterQuoteCards(state.ui.quoteQ);
    if (state.route.name === 'settings') { paintServerVersion(); paintStorageInfo(); }
  }

  function updateTabbar() {
    var name = state.route.name;
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('is-active', tabs[i].dataset.tab === name);
    }
  }

  function onRouteChange() {
    var r = parseRoute();
    state.route = r;
    if (r.name === 'new') {
      if (!state.draft || state.draft.id) initDraft(null);
    } else if (r.name === 'edit') {
      initDraft(r.id);
    } else {
      state.draft = null;
    }
    if (r.name !== 'library') {
      state.ui.selectMode = false;
      state.ui.selected = {};
      state.ui.sortMode = false;
    }
    if (r.name === 'timeline' && !state.timeline.y) {
      var now = new Date();
      state.timeline.y = now.getFullYear();
      state.timeline.m = now.getMonth();
      state.checkin.y = now.getFullYear();
      state.checkin.m = now.getMonth();
    }
    render();
  }

  /* ---------------- 通用片段 ---------------- */

  function pageHead(eyebrow, title, withGear) {
    return '<header class="page-head">' +
      '<div><p class="eyebrow">' + esc(eyebrow) + '</p><h1 class="page-title">' + esc(title) + '</h1></div>' +
      (withGear === false ? '' : '<button class="icon-btn" data-action="settings" aria-label="设置">' + icon('gear', 20) + '</button>') +
      '</header>';
  }

  function coverInner(r, cls) {
    var html = '<span class="pcard-initial">' + esc(firstChar(r.title)) + '</span>';
    if (r.cover) {
      html += '<img class="pcard-img" src="' + esc(r.cover) + '" alt="" loading="lazy" decoding="async" ' +
        'onload="this.classList.add(\'is-loaded\')" onerror="this.parentNode.removeChild(this)">';
    }
    return html;
  }

  function segmentsOf(r) {
    return (r.progress && r.progress.segments) || [];
  }

  function segmentStats(r) {
    var list = segmentsOf(r);
    var watched = 0, total = 0, doneCount = 0;
    list.forEach(function (s) {
      watched += s.current || 0;
      total += s.total || 0;
      if (s.done) doneCount++;
    });
    return { list: list, watched: watched, total: total, done: doneCount };
  }

  function segmentDoneWord(r) {
    return TYPES[r.type].mode === 'series' ? '看完' : '读完';
  }

  /* 期刊：国内版 · 2026 年 10 月 · A 刊 · 第 10 期 · 总第 128 期 */
  function magazineIssueText(r) {
    var m = r.magazine || {};
    var bits = [];
    if (m.edition) bits.push(m.edition);
    var y = m.year || recordYear(r);
    if (y && m.month) bits.push(y + ' 年 ' + m.month + ' 月');
    else if (y) bits.push(y + ' 年');
    if (m.part) bits.push(/刊$/.test(m.part) ? m.part : m.part + '刊');
    if (m.issueNo) bits.push('第 ' + m.issueNo + ' 期');
    if (m.totalNo) bits.push('总第 ' + m.totalNo + ' 期');
    return bits.length ? bits.join(' · ') : STATUSES[r.status];
  }

  function progressText(r) {
    var t = TYPES[r.type];
    var p = r.progress || {};
    if (r.type === 'magazine') return magazineIssueText(r);
    if (t.mode === 'percent') {
      var pc = Math.max(0, Math.min(100, p.percent || 0));
      if (r.status === 'done' || pc >= 100) return '已通关';
      if (!pc) return STATUSES[r.status];
      return '进度 ' + pc + '%';
    }
    if (t.mode === 'single') return STATUSES[r.status];

    var st = segmentStats(r);
    if (st.list.length) {
      var doneWord = segmentDoneWord(r);
      if (st.done === st.list.length) {
        var allDone = st.list.length > 1
          ? '全 ' + st.list.length + ' ' + t.segUnit + '已' + doneWord
          : '已' + doneWord;
        return allDone + (st.total ? ' · ' + st.total + ' ' + t.itemUnit : '');
      }
      var cur = null;
      for (var i = st.list.length - 1; i >= 0; i--) {
        if (!st.list[i].done) { cur = st.list[i]; break; }
      }
      if (!cur) cur = st.list[st.list.length - 1];
      var prefix = st.done ? '已' + doneWord + ' ' + st.done + ' ' + t.segUnit + ' · ' : '';
      var label = st.list.length > 1 ? '第 ' + (cur.n || (st.list.indexOf(cur) + 1)) + ' ' + t.segUnit + ' ' : '';
      if (!cur.current) return prefix ? prefix + label + '未开始' : '尚未开始';
      return prefix + label + '第 ' + cur.current + ' ' + t.itemUnit + (cur.total ? ' / ' + cur.total : '');
    }

    if (!p.current) {
      if (r.status === 'done') return t.mode === 'series' ? '已看完' : '已完成';
      return '尚未开始';
    }
    var u = t.mode === 'book'
      ? (p.unit === 'volume' ? t.volumeUnit : (p.unit === 'page' ? '页' : t.itemUnit))
      : t.itemUnit;
    return '第 ' + p.current + ' ' + u + (p.total ? ' / 共 ' + p.total + ' ' + u : '');
  }

  function progressPercent(r) {
    var p = r.progress || {};
    if (TYPES[r.type] && TYPES[r.type].mode === 'percent') {
      return Math.max(0, Math.min(100, p.percent || 0));
    }
    var st = segmentStats(r);
    if (st.list.length) {
      if (st.total > 0) return Math.min(100, Math.round(st.watched / st.total * 100));
      return Math.round(st.done / st.list.length * 100);
    }
    if (p.total > 0 && p.current > 0) return Math.min(100, Math.round(p.current / p.total * 100));
    if (r.status === 'done') return 100;
    return 0;
  }

  function ratingBar(r) {
    if (!r.rating) return '';
    return '<div class="tl-rating"><div class="rating-bar"><i style="width:' + (r.rating * 10) + '%"></i></div>' +
      '<span>' + (ratingScale() === 5 ? '★ ' : '') + ratingText(r.rating) + '</span></div>';
  }

  function tagPills(r) {
    if (!r.tags || !r.tags.length) return '';
    return '<div class="tl-tags">' + r.tags.map(function (t) {
      return '<span class="tag-mini">' + esc(t) + '</span>';
    }).join('') + '</div>';
  }

  function logLine(r) {
    if (!r.logs || !r.logs.length) return '';
    var items = r.logs.slice().sort(function (a, b) { return a.at - b.at; }).map(function (l) {
      return (LOG_LABELS[l.action] || l.action) + ' ' + md(new Date(l.at));
    });
    var uniq = [];
    items.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    return '<button class="tl-logs" data-action="history" data-id="' + r.id + '">' +
      '<span>' + esc(uniq.slice(-4).join(' · ')) + '</span>' +
      '<span class="tl-logs-more">历史</span></button>';
  }

  function openHistory(id) {
    var r = state.records.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    openModal({
      title: r.title,
      desc: '这条记录的操作历史',
      body: '<div class="log-list">' + logListHTML(r.logs) + '</div>',
      actions: [{ label: '关闭', value: null, variant: 'ghost' }]
    });
  }

  /* ---------------- 总览 ---------------- */

  function homeView() {
    var recs = state.records;
    var q = state.search.trim();
    var total = recs.length;
    var doneN = recs.filter(function (r) { return r.status === 'done'; }).length;
    var monthN = recs.filter(function (r) { return sameMonth(r.createdAt, new Date()); }).length;
    var rated = recs.filter(function (r) { return r.rating > 0; });
    var avg = rated.length ? rated.reduce(function (s, r) { return s + r.rating; }, 0) / rated.length : 0;
    var hours = recs.reduce(function (s, r) { return s + (r.hours || 0); }, 0);
    var doing = recs.filter(function (r) { return r.status === 'doing'; })
      .sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    var now = new Date();

    var html = pageHead(
      now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 · 周' + '日一二三四五六'[now.getDay()],
      '次元簿'
    );

    html += '<div class="search">' + icon('search', 18) +
      '<input id="global-search" type="search" placeholder="搜索标题、标签、创作者" autocomplete="off" value="' + esc(state.search) + '">' +
      '<button class="search-clear" data-action="clear-search" aria-label="清空搜索">' + icon('close', 15) + '</button>' +
      '</div>';

    html += '<div id="search-panel" class="search-panel' + (q ? '' : ' hidden') + '">' + (q ? searchResultsHTML(q) : '') + '</div>';

    html += '<div id="home-main"' + (q ? ' class="hidden"' : '') + '>';

    /* hero */
    var subline = total === 0
      ? '从第一部开始，慢慢攒成自己的小宇宙。'
      : '已收录 <b>' + total + '</b> 条记录，累计投入 <b>' + fmtHours(hours) + '</b> 小时。';
    html += '<section class="hero">' +
      '<div class="hero-deco" aria-hidden="true"></div>' +
      '<span class="sparkle sp1" aria-hidden="true">✦</span>' +
      '<span class="sparkle sp2" aria-hidden="true">✦</span>' +
      '<span class="sparkle sp3" aria-hidden="true">✦</span>' +
      '<span class="hero-mark" aria-hidden="true">次</span>' +
      '<p class="hero-eyebrow">' + (total === 0 ? '欢迎来到次元簿' : '今天也记一点') + '</p>' +
      '<h2 class="hero-title">读过、看过，<br>都留在这里。</h2>' +
      '<p class="hero-sub">' + subline + '</p>' +
      '<div class="hero-foot"><button class="btn btn-primary" data-action="new">' + icon('plus', 17) + ' 记录一条</button></div>' +
      '</section>';

    /* 数据概览 */
    html += '<section class="section"><div class="section-head"><h2 class="section-title">数据概览</h2></div>' +
      '<div class="stat-grid">' +
      statCell(total, '收录总数', '') +
      statCell(doneN, '已完成', '') +
      statCell(monthN, '本月新增', '') +
      statCell(ratingText(avg), '平均评分', '') +
      '</div></section>';

    /* 年度目标 */
    var goalHTML = goalCardHTML(recs);
    if (goalHTML) html += goalHTML;

    /* 正在继续 */
    /* 正在看 */
    if (doing.length) {
      var featured = doing[0];
      var rest = doing.slice(1);
      html += '<section class="section"><div class="section-head"><h2 class="section-title">正在继续</h2>' +
        '<div class="head-right"><span class="section-note">' + doing.length + ' 条进行中</span>' +
        '<button class="link-btn" data-action="ics">' + icon('calendar', 14) + ' 追更日历</button></div></div>' +
        watchingCard(featured) +
        (rest.length ? '<div class="rail" style="margin-top:12px">' + rest.map(railCard).join('') + '</div>' : '') +
        '</section>';
    }

    html += backupHintHTML();
    html += '</div>';

    return html;
  }

  function goalCardHTML(recs) {
    var gc = Number(state.prefs.goalCount) || 0;
    var gh = Number(state.prefs.goalHours) || 0;
    if (!gc && !gh) return '';

    var y = new Date().getFullYear();
    var yearRecs = recs.filter(function (r) { return new Date(r.createdAt).getFullYear() === y; });
    var count = yearRecs.length;
    var hours = yearRecs.reduce(function (sum, r) { return sum + (r.hours || 0); }, 0);

    var rows = [];
    if (gc) {
      var pctC = Math.min(100, Math.round(count / gc * 100));
      rows.push('<div class="goal-row">' +
        '<div class="goal-top"><span>今年收录</span><b>' + count + ' / ' + gc + ' 条</b></div>' +
        '<div class="goal-bar"><i style="width:' + pctC + '%"></i></div>' +
        '<p class="goal-note">' + (count >= gc ? '目标达成，厉害。' : '还差 ' + (gc - count) + ' 条') + '</p></div>');
    }
    if (gh) {
      var pctH = Math.min(100, Math.round(hours / gh * 100));
      rows.push('<div class="goal-row">' +
        '<div class="goal-top"><span>今年投入</span><b>' + fmtHours(hours) + ' / ' + gh + ' 小时</b></div>' +
        '<div class="goal-bar"><i style="width:' + pctH + '%"></i></div>' +
        '<p class="goal-note">' + (hours >= gh ? '目标达成，厉害。' : '还差 ' + fmtHours(gh - hours) + ' 小时') + '</p></div>');
    }

    return '<section class="section"><div class="section-head"><h2 class="section-title">' + y + ' 年度目标</h2>' +
      '<button class="link-btn" data-action="settings">调整</button></div>' +
      '<div class="goal-card">' + rows.join('') + '</div></section>';
  }

  function statCell(v, label) {
    return '<div class="stat"><div class="stat-num">' + esc(v) + '</div><div class="stat-label">' + esc(label) + '</div></div>';
  }

  function watchingCard(r) {
    var pct = progressPercent(r);
    var t = TYPES[r.type];
    var canPlus = t.mode === 'book' || t.mode === 'series';
    return '<div class="watching">' +
      '<div class="watching-cover" style="background:' + coverColor(r.title) + '" data-action="open" data-id="' + r.id + '">' +
      coverInner(r) + '</div>' +
      '<div class="watching-body" data-action="open" data-id="' + r.id + '">' +
      '<span class="watching-label">' + TYPES[r.type].label + ' · ' + STATUSES[r.status] + '</span>' +
      '<div class="watching-title">' + esc(r.title) + '</div>' +
      '<div class="watching-prog">' + esc(progressText(r)) + '</div>' +
      '<div class="watching-bar"><i style="width:' + pct + '%"></i></div>' +
      '</div>' +
      (canPlus ? '<button class="watching-plus" data-action="plus-one" data-id="' + r.id + '" aria-label="进度加一">' +
        '<strong>+1</strong>进度</button>' : '') +
      '</div>';
  }

  function syncProgressMirror(r) {
    var p = r.progress;
    if (!p) return;
    var t = TYPES[r.type];
    if (t && t.mode === 'book') {
      var src = p.unit === 'volume' ? p.volume : (p.unit === 'page' ? p.page : p.chapter);
      p.current = src ? src.current : 0;
      p.total = src ? src.total : 0;
    }
  }

  function bumpProgress(r) {
    var t = TYPES[r.type];
    if (!t || t.mode === 'single' || t.mode === 'issue' || t.mode === 'percent') return false;

    var segs = r.progress.segments || (r.progress.segments = []);
    if (t.mode === 'series' || segs.length) {
      if (!segs.length) segs.push({ n: 1, current: 0, total: 0, done: false });
      var s = null;
      for (var i = 0; i < segs.length; i++) {
        var cur = segs[i];
        if (!cur.done && (!cur.total || cur.current < cur.total)) { s = cur; break; }
      }
      if (!s) return false;
      s.current = (s.current || 0) + 1;
      if (s.total > 0 && s.current >= s.total) { s.current = s.total; s.done = true; }
      return true;
    }

    var box = r.progress.unit === 'volume' ? r.progress.volume
      : (r.progress.unit === 'page' ? r.progress.page : r.progress.chapter);
    if (!box) return false;
    box.current = (box.current || 0) + 1;
    if (box.total > 0 && box.current > box.total) box.current = box.total;
    syncProgressMirror(r);
    return true;
  }

  function railCard(r) {
    var pct = progressPercent(r);
    return '<div class="rail-card" data-action="open" data-id="' + r.id + '" role="button" tabindex="0">' +
      '<div class="rail-cover" style="background:' + coverColor(r.title) + '">' + coverInner(r) + '</div>' +
      '<div class="rail-body">' +
      '<div class="rail-title">' + esc(r.title) + '</div>' +
      '<div class="rail-prog">' + esc(progressText(r)) + '</div>' +
      '<div class="prog"><i style="width:' + pct + '%"></i></div>' +
      '</div></div>';
  }

  function backupHintHTML() {
    if (!state.records.length) return '';
    var last = state.prefs.lastExportAt;
    var days = last ? Math.floor((Date.now() - last) / DAY) : null;
    if (last && days < 7) return '';
    var txt = last ? '距上次备份已 ' + days + ' 天' : '你还没有备份过数据';
    return '<section class="backup">' +
      '<div class="backup-ico">' + icon('download', 17) + '</div>' +
      '<div class="backup-text"><strong>' + esc(txt) + '</strong><span>数据只存在这台设备，建议导出一份 JSON。</span></div>' +
      '<button class="btn btn-ghost btn-sm" data-action="goto-settings">去备份</button>' +
      '</section>';
  }

  function matchesQuery(r, q) {
    var s = q.toLowerCase();
    return (r.title || '').toLowerCase().indexOf(s) >= 0 ||
      (r.originalTitle || '').toLowerCase().indexOf(s) >= 0 ||
      (r.aliases || []).some(function (t) { return t.toLowerCase().indexOf(s) >= 0; }) ||
      (r.creator || '').toLowerCase().indexOf(s) >= 0 ||
      (r.review || '').toLowerCase().indexOf(s) >= 0 ||
      (r.quotes || []).some(function (q) { return q.text.toLowerCase().indexOf(s) >= 0; }) ||
      (r.type === 'magazine' && magazineIssueText(r).toLowerCase().indexOf(s) >= 0) ||
      (r.tags || []).some(function (t) { return t.toLowerCase().indexOf(s) >= 0; });
  }

  function searchResultsHTML(q) {
    var list = state.records.filter(function (r) { return matchesQuery(r, q); })
      .sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    if (!list.length) {
      return '<div class="empty"><div class="empty-mark">·</div>' +
        '<p class="empty-title">没有找到相关记录</p>' +
        '<p class="empty-text">试试作品名、作者、标签，或者直接记一条新的。</p>' +
        '<button class="btn btn-ghost btn-sm" data-action="new">＋ 记录一条</button></div>';
    }
    return '<p class="search-head">找到 ' + list.length + ' 条</p>' + list.map(function (r) {
      return '<div class="srow" data-action="open" data-id="' + r.id + '" role="button" tabindex="0">' +
        '<div class="srow-cover" style="background:' + coverColor(r.title) + '">' + coverInner(r) + '</div>' +
        '<div class="srow-body">' +
        '<div class="srow-title">' + esc(r.title) + '</div>' +
        '<div class="srow-meta">' + esc([TYPES[r.type].label, r.creator, STATUSES[r.status]].filter(Boolean).join(' · ')) + '</div>' +
        '</div>' +
        '<span class="pcard-rating">' + (r.rating ? ratingBadge(r.rating) : '') + '</span>' +
      (r.recommend && r.recommend !== 'meh' ? '<span class="pcard-rec" data-r="' + r.recommend + '">♥</span>' : '') +
        '</div>';
    }).join('');
  }

  function updateSearchPanel() {
    var panel = document.getElementById('search-panel');
    var main = document.getElementById('home-main');
    if (!panel || !main) return;
    var q = state.search.trim();
    panel.innerHTML = q ? searchResultsHTML(q) : '';
    panel.classList.toggle('hidden', !q);
    main.classList.toggle('hidden', !!q);
  }

  /* ---------------- 收藏 ---------------- */

  function tagCounts() {
    var map = {};
    state.records.forEach(function (r) {
      (r.tags || []).forEach(function (t) { map[t] = (map[t] || 0) + 1; });
    });
    return Object.keys(map).map(function (k) { return [k, map[k]]; })
      .sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0], 'zh'); });
  }

  function yearOptions() {
    var set = {};
    state.records.forEach(function (r) {
      var y = recordYear(r);
      if (y) set[y] = true;
    });
    return Object.keys(set).sort().reverse();
  }

  function createdYears() {
    var set = {};
    state.records.forEach(function (r) {
      set[new Date(r.createdAt).getFullYear()] = true;
    });
    return Object.keys(set).sort().reverse();
  }

  function activeList() {
    if (state.ui.listId === 'all') return null;
    return state.lists.filter(function (l) { return l.id === state.ui.listId; })[0] || null;
  }

  function matchFilters(r) {
    var f = state.filters;
    if (f.status !== 'all' && r.status !== f.status) return false;
    if (f.type !== 'all' && r.type !== f.type) return false;
    if (f.tag !== 'all' && (r.tags || []).indexOf(f.tag) < 0) return false;
    if (f.year !== 'all' && recordYear(r) !== f.year) return false;
    if (f.release === 'released' && !isReleased(r)) return false;
    if (f.release === 'unreleased' && isReleased(r)) return false;
    if (f.rating && f.rating !== 'all') {
      var rt = r.rating || 0;
      if (f.rating === 'none' && rt > 0) return false;
      if (f.rating === 'high' && rt < 9) return false;
      if (f.rating === '8' && (rt < 8 || rt >= 9)) return false;
      if (f.rating === '7' && (rt < 7 || rt >= 8)) return false;
      if (f.rating === '6' && (rt < 6 || rt >= 7)) return false;
      if (f.rating === 'low' && (rt <= 0 || rt >= 6)) return false;
    }
    return true;
  }

  function matchList(r, list) {
    if (!list) return true;
    if (list.kind === 'manual') return list.ids.indexOf(r.id) >= 0;
    var ru = list.rules;
    if (ru.status !== 'all' && r.status !== ru.status) return false;
    if (ru.type !== 'all' && r.type !== ru.type) return false;
    if (ru.year !== 'all' && recordYear(r) !== ru.year) return false;
    if (ru.minRating > 0 && r.rating < ru.minRating) return false;
    if (ru.tags.length) {
      for (var i = 0; i < ru.tags.length; i++) {
        if ((r.tags || []).indexOf(ru.tags[i]) < 0) return false;
      }
    }
    return true;
  }

  function listCount(l) {
    if (l.kind === 'manual') {
      return l.ids.filter(function (id) {
        return state.records.some(function (r) { return r.id === id; });
      }).length;
    }
    return state.records.filter(function (r) { return matchList(r, l); }).length;
  }

  function sortRecords(arr, mode) {
    var copy = arr.slice();
    if (mode === 'created-desc') copy.sort(function (a, b) { return b.createdAt - a.createdAt; });
    else if (mode === 'created-asc') copy.sort(function (a, b) { return a.createdAt - b.createdAt; });
    else if (mode === 'release-desc') copy.sort(function (a, b) { return (releaseTs(b) - releaseTs(a)) || (b.createdAt - a.createdAt); });
    else if (mode === 'release-asc') copy.sort(function (a, b) {
      var x = releaseTs(a) || 9e15, y = releaseTs(b) || 9e15;
      return x - y || b.createdAt - a.createdAt;
    });
    else if (mode === 'rating') copy.sort(function (a, b) { return (b.rating - a.rating) || (b.createdAt - a.createdAt); });
    else copy.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    return copy;
  }

  function libraryRecords() {
    var list = activeList();
    if (list && list.kind === 'manual') {
      var map = {};
      state.records.forEach(function (r) { map[r.id] = r; });
      return list.ids.map(function (id) { return map[id]; })
        .filter(function (r) { return r && matchFilters(r); });
    }
    var arr = state.records.filter(function (r) { return matchFilters(r) && matchList(r, list); });
    return sortRecords(arr, state.filters.sort);
  }

  function libraryView() {
    var f = state.filters;
    var list = activeList();
    var rows = libraryRecords();
    var tags = tagCounts();
    var years = yearOptions();
    var selecting = state.ui.selectMode;
    var selCount = Object.keys(state.ui.selected).filter(function (k) { return state.ui.selected[k]; }).length;

    var html = '<header class="page-head">' +
      '<div><p class="eyebrow">共 ' + state.records.length + ' 条' +
      (list ? ' · ' + esc(list.name) : '') + '</p><h1 class="page-title">收藏</h1></div>' +
      '<div class="head-actions">' +
      (state.records.length
        ? '<button class="icon-btn" data-action="toggle-view" aria-label="切换视图">' +
        icon(state.ui.view === 'wall' ? 'grid' : 'wall', 19) + '</button>' : '') +
      (state.records.length && !selecting
        ? '<button class="icon-btn" data-action="select-mode" aria-label="批量选择">' + icon('check-square', 19) + '</button>' : '') +
      '<button class="icon-btn" data-action="settings" aria-label="设置">' + icon('gear', 20) + '</button>' +
      '</div></header>';

    /* 列表 chips */
    html += '<div class="list-bar">' +
      '<button class="list-chip ' + (state.ui.listId === 'all' ? 'is-on' : '') + '" data-action="pick-list" data-id="all">全部</button>' +
      state.lists.map(function (l) {
        return '<button class="list-chip ' + (state.ui.listId === l.id ? 'is-on' : '') + '" data-action="pick-list" data-id="' + l.id + '">' +
          (l.kind === 'manual' ? icon('list', 12) : icon('sparkle', 12)) +
          '<span>' + esc(l.name) + '</span><i class="list-count">' + listCount(l) + '</i></button>';
      }).join('') +
      '<button class="list-chip add" data-action="new-list">＋ 列表</button>' +
      (list ? '<button class="list-chip icon" data-action="edit-list" data-id="' + list.id + '" aria-label="编辑列表">' + icon('gear', 12) + '</button>' : '') +
      '</div>';

    html += '<div class="seg">' +
      ['all'].concat(STATUS_KEYS).map(function (k) {
        var label = k === 'all' ? '全部' : STATUSES[k];
        return '<button data-action="filter-status" data-value="' + k + '" class="' + (f.status === k ? 'is-active' : '') + '">' + label + '</button>';
      }).join('') + '</div>';

    html += '<div class="seg seg-type">' +
      ['all'].concat(TYPE_KEYS).map(function (k) {
        var label = k === 'all' ? '全部' : TYPES[k].label;
        return '<button data-action="filter-type" data-value="' + k + '" class="' + (f.type === k ? 'is-active' : '') + '">' + label + '</button>';
      }).join('') + '</div>';

    html += '<div class="filters">' +
      '<select class="select" data-filter="tag" aria-label="按题材筛选">' +
      '<option value="all">题材：全部</option>' +
      tags.map(function (t) {
        return '<option value="' + esc(t[0]) + '"' + (f.tag === t[0] ? ' selected' : '') + '>' + esc(t[0]) + '（' + t[1] + '）</option>';
      }).join('') + '</select>' +
      '<select class="select" data-filter="year" aria-label="按年份筛选">' +
      '<option value="all">年份：全部</option>' +
      years.map(function (y) {
        return '<option value="' + esc(y) + '"' + (f.year === y ? ' selected' : '') + '>' + esc(y) + ' 年</option>';
      }).join('') + '</select>' +
      '<select class="select" data-filter="release" aria-label="按上映状态筛选">' +
      '<option value="all"' + (f.release === 'all' ? ' selected' : '') + '>上映：全部</option>' +
      '<option value="released"' + (f.release === 'released' ? ' selected' : '') + '>已上映</option>' +
      '<option value="unreleased"' + (f.release === 'unreleased' ? ' selected' : '') + '>未上映</option>' +
      '</select>' +
      '<select class="select" data-filter="rating" aria-label="按评分筛选">' +
      [['all', '评分：全部'], ['high', '9 分以上'], ['8', '8 – 8.9'], ['7', '7 – 7.9'],
      ['6', '6 – 6.9'], ['low', '6 分以下'], ['none', '未评分']].map(function (o) {
        return '<option value="' + o[0] + '"' + (f.rating === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') +
      '</select>' +
      (!list || list.kind !== 'manual'
        ? '<select class="select" data-filter="sort" aria-label="排序">' +
        [['updated', '最近更新'], ['created-desc', '最近添加'], ['created-asc', '最早添加'],
        ['release-desc', '发布：新→旧'], ['release-asc', '发布：旧→新'], ['rating', '评分最高']].map(function (o) {
          return '<option value="' + o[0] + '"' + (f.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select>' : '') +
      '<button class="btn btn-ghost btn-sm" data-action="save-view">存为视图</button>' +
      ((f.tag !== 'all' || f.year !== 'all' || f.status !== 'all' || f.type !== 'all' || f.release !== 'all' || f.rating !== 'all')
        ? '<button class="btn btn-ghost btn-sm" data-action="clear-filters">清除</button>' : '') +
      '</div>';

    if (selecting) {
      html += '<div class="select-note">选择模式下点击卡片多选 · 已选 ' + selCount + ' 项</div>';
    }

    if (!rows.length) {
      if (!state.records.length) html += emptyLibrary();
      else if (list && list.kind === 'manual') {
        html += '<div class="empty"><div class="empty-mark">·</div>' +
          '<p class="empty-title">这个列表还是空的</p>' +
          '<p class="empty-text">把想放在一起的作品挑进来。</p>' +
          '<button class="btn btn-primary btn-sm" data-action="list-pick">＋ 添加作品</button></div>';
      } else {
        html += '<div class="empty"><div class="empty-mark">·</div>' +
          '<p class="empty-title">这个条件下还没有作品</p>' +
          '<p class="empty-text">换个筛选，或者补一条新的。</p>' +
          '<button class="btn btn-ghost btn-sm" data-action="clear-filters">清除筛选</button></div>';
      }
    } else if (state.ui.view === 'wall') {
      html += '<div class="wall-cards">' + rows.map(wallCard).join('') + '</div>';
    } else {
      html += '<div class="grid-cards' + (state.ui.sortMode ? ' is-sorting' : '') + '">' +
        rows.map(posterCard).join('') + '</div>';
      if (list && list.kind === 'manual') {
        html += '<div class="list-tools">' +
          '<button class="btn btn-ghost btn-sm" data-action="toggle-sort">' + (state.ui.sortMode ? '完成排序' : '拖动排序') + '</button>' +
          '<button class="btn btn-ghost btn-sm" data-action="list-pick">添加作品</button>' +
          '</div>';
      }
    }

    if (selecting) {
      html += '<div class="select-bar">' +
        '<span class="select-count">已选 <b>' + selCount + '</b></span>' +
        '<button class="btn btn-ghost btn-sm" data-action="select-all">全选</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="bulk-status">状态</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="bulk-tag">标签</button>' +
        '<button class="btn btn-ghost btn-sm danger" data-action="bulk-delete">删除</button>' +
        '<button class="btn btn-primary btn-sm" data-action="exit-select">完成</button>' +
        '</div>';
    }
    return html;
  }

  function wallCard(r) {
    var selecting = state.ui.selectMode;
    var checked = !!state.ui.selected[r.id];
    return '<div class="wcard' + (selecting ? ' is-selecting' : '') + (checked ? ' is-checked' : '') + '" ' +
      (selecting ? 'data-action="toggle-select"' : 'data-action="open"') + ' data-id="' + r.id + '" role="button" tabindex="0" ' +
      'style="--cc:' + coverColor(r.title) + '">' +
      coverInner(r) +
      '<span class="wcard-tip">' + esc(r.title) + '</span>' +
      (r.rating ? '<span class="wcard-rate">' + ratingBadge(r.rating) + '</span>' : '') +
      (selecting ? '<span class="pcard-check">' + (checked ? icon('check', 13) : '') + '</span>' : '') +
      '</div>';
  }

  function emptyLibrary() {
    return '<div class="empty">' +
      '<div class="empty-mark">次</div>' +
      '<p class="empty-title">书架还空着</p>' +
      '<p class="empty-text">记录第一条，之后的每一次回顾都会从这里开始。</p>' +
      '<button class="btn btn-primary" data-action="new">＋ 记录一条</button>' +
      '<div style="margin-top:14px"><button class="btn btn-ghost btn-sm" data-action="seed-demo">填充示例数据看看</button></div>' +
      '</div>';
  }

  function posterCard(r) {
    var selecting = state.ui.selectMode;
    var checked = !!state.ui.selected[r.id];
    return '<div class="pcard' + (selecting ? ' is-selecting' : '') + (checked ? ' is-checked' : '') + '" ' +
      (selecting ? 'data-action="toggle-select"' : 'data-action="open"') + ' data-id="' + r.id + '" role="button" tabindex="0">' +
      '<div class="pcard-cover" style="--cc:' + coverColor(r.title) + '">' +
      coverInner(r) +
      '<span class="pcard-type">' + TYPES[r.type].label + '</span>' +
      (selecting ? '<span class="pcard-check">' + (checked ? icon('check', 13) : '') + '</span>' : '') +
      '</div>' +
      '<div class="pcard-body">' +
      '<h3 class="pcard-title">' + esc(r.title) + '</h3>' +
      '<div class="pcard-meta">' +
      '<span class="sdot" data-s="' + r.status + '"></span>' +
      '<span>' + STATUSES[r.status] + '</span>' +
      '<span class="pcard-rating">' + (r.rating ? ratingBadge(r.rating) : '') + '</span>' +
      '</div></div></div>';
  }

  /* ---------------- 列表（智能 / 手动） ---------------- */

  function smartRulesHTML(draft, tags) {
    var typeOpts = '<option value="all">全部类型</option>' + TYPE_KEYS.map(function (k) {
      return '<option value="' + k + '"' + (draft.rules.type === k ? ' selected' : '') + '>' + TYPES[k].label + '</option>';
    }).join('');
    var statusOpts = '<option value="all">全部状态</option>' + STATUS_KEYS.map(function (k) {
      return '<option value="' + k + '"' + (draft.rules.status === k ? ' selected' : '') + '>' + STATUSES[k] + '</option>';
    }).join('');

    return '<label class="field"><span class="field-label">最低评分：<b id="rule-score">' +
      (draft.rules.minRating ? ratingText(draft.rules.minRating) + (ratingScale() === 5 ? ' 星' : ' 分') : '不限') +
      '</b></span>' +
      '<input type="range" class="range" id="rule-rating" min="0" max="10" step="0.5" value="' + (draft.rules.minRating || 0) +
      '" style="--pct:' + (draft.rules.minRating * 10) + '%"></label>' +
      '<div class="row2">' +
      '<label class="field"><span class="field-label">类型</span><select class="input" id="rule-type">' + typeOpts + '</select></label>' +
      '<label class="field"><span class="field-label">状态</span><select class="input" id="rule-status">' + statusOpts + '</select></label>' +
      '</div>' +
      '<div class="field"><span class="field-label">包含标签（需全部满足）</span><div class="tag-picker">' +
      (tags.length ? tags.map(function (t) {
        return '<button type="button" class="tag-chip ' + (draft.rules.tags.indexOf(t) >= 0 ? 'is-on' : '') + '" data-rtag="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('') : '<span class="hint">还没有标签，先去记录里加几个。</span>') +
      '</div></div>';
  }

  function openListEditor(id) {
    var root = document.getElementById('modal-root');
    var editing = id ? state.lists.filter(function (l) { return l.id === id; })[0] : null;
    var draft = editing ? JSON.parse(JSON.stringify(editing)) : {
      id: '', name: '', kind: 'smart',
      rules: { status: 'all', type: 'all', year: 'all', minRating: 0, tags: [] },
      ids: []
    };
    var tags = tagCounts().map(function (t) { return t[0]; });

    function close() {
      root.innerHTML = '';
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    function draw() {
      root.innerHTML = '<div class="modal-backdrop"><div class="modal modal-wide">' +
        '<h3 class="modal-title">' + (editing ? '编辑列表' : '新建列表') + '</h3>' +
        '<p class="modal-desc">智能列表按规则自动更新；手动列表自己挑作品，可以拖动排序。</p>' +
        '<label class="field"><span class="field-label">名称</span>' +
        '<input class="input" id="list-name" value="' + esc(draft.name) + '" placeholder="例如：悬疑高分待看" maxlength="30"></label>' +
        '<div class="field"><span class="field-label">类型</span>' +
        '<div class="theme-seg">' +
        '<button data-kind="smart" class="' + (draft.kind === 'smart' ? 'is-active' : '') + '">智能列表</button>' +
        '<button data-kind="manual" class="' + (draft.kind === 'manual' ? 'is-active' : '') + '">手动列表</button>' +
        '</div></div>' +
        (draft.kind === 'smart' ? smartRulesHTML(draft, tags)
          : '<p class="hint">创建后回到列表，用「添加作品」把想放在一起的作品挑进来。</p>') +
        '<div class="modal-actions">' +
        (editing ? '<button class="btn btn-ghost" data-l="del">删除</button>' : '') +
        '<button class="btn btn-ghost" data-l="cancel">取消</button>' +
        '<button class="btn btn-primary" data-l="save">保存</button>' +
        '</div></div></div>';

      root.querySelector('[data-l="cancel"]').addEventListener('click', close);
      root.querySelector('[data-l="save"]').addEventListener('click', commit);
      var del = root.querySelector('[data-l="del"]');
      if (del) {
        del.addEventListener('click', function () {
          var lid = draft.id;
          close();
          openModal({
            title: '删除列表',
            desc: '「' + draft.name + '」会被删除，里面的作品记录不受影响。',
            actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '删除', value: 'ok', variant: 'danger' }]
          }).then(function (v) {
            if (v !== 'ok') return;
            state.lists = state.lists.filter(function (l) { return l.id !== lid; });
            if (state.ui.listId === lid) state.ui.listId = 'all';
            save();
            toast('已删除列表');
            render();
          });
        });
      }

      var nameEl = root.querySelector('#list-name');
      nameEl.addEventListener('input', function () { draft.name = nameEl.value; });

      root.querySelectorAll('[data-kind]').forEach(function (b) {
        b.addEventListener('click', function () {
          draft.name = root.querySelector('#list-name').value;
          draft.kind = b.dataset.kind;
          draw();
        });
      });

      if (draft.kind === 'smart') {
        var range = root.querySelector('#rule-rating');
        range.addEventListener('input', function () {
          draft.rules.minRating = Number(range.value);
          root.querySelector('#rule-score').textContent = draft.rules.minRating
            ? ratingText(draft.rules.minRating) + (ratingScale() === 5 ? ' 星' : ' 分') : '不限';
          range.style.setProperty('--pct', (draft.rules.minRating * 10) + '%');
        });
        root.querySelector('#rule-type').addEventListener('change', function (e) { draft.rules.type = e.target.value; });
        root.querySelector('#rule-status').addEventListener('change', function (e) { draft.rules.status = e.target.value; });
        root.querySelectorAll('[data-rtag]').forEach(function (b) {
          b.addEventListener('click', function () {
            var t = b.dataset.rtag;
            var i = draft.rules.tags.indexOf(t);
            if (i >= 0) draft.rules.tags.splice(i, 1);
            else draft.rules.tags.push(t);
            b.classList.toggle('is-on');
          });
        });
      }
      var input = root.querySelector('#list-name');
      if (!editing && !draft.name) setTimeout(function () { input.focus(); }, 60);
    }

    function commit() {
      var name = (root.querySelector('#list-name').value || '').trim();
      if (!name) { toast('给列表起个名字'); return; }
      var item = normalizeList({
        id: draft.id || '',
        name: name,
        kind: draft.kind,
        rules: draft.rules,
        ids: draft.kind === 'manual' ? draft.ids : []
      });
      if (!item) return;
      var i = state.lists.findIndex(function (l) { return l.id === item.id; });
      if (i >= 0) state.lists[i] = item;
      else state.lists.push(item);
      state.ui.listId = item.id;
      save();
      close();
      toast(editing ? '已保存列表' : '已创建列表');
      render();
    }

    draw();
  }

  function saveCurrentView() {
    var f = state.filters;
    var name = '视图 ' + (state.lists.length + 1);
    openModal({
      title: '存为视图',
      desc: '把当前的状态、类型、题材、年份、上映条件保存成一个命名视图。',
      body: '<input class="input" id="modal-input" value="' + esc(name) + '" maxlength="30">',
      actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '保存', collect: true, variant: 'primary' }]
    }).then(function (val) {
      var n = String(val || '').trim();
      if (!n) return;
      var item = normalizeList({
        name: n, kind: 'smart',
        rules: {
          status: f.status, type: f.type, year: f.year, minRating: 0,
          tags: f.tag !== 'all' ? [f.tag] : []
        },
        ids: []
      });
      state.lists.push(item);
      state.ui.listId = item.id;
      save();
      toast('已保存视图');
      render();
    });
  }

  function openListPicker() {
    var list = activeList();
    if (!list || list.kind !== 'manual') return;
    var root = document.getElementById('modal-root');
    var picked = {};
    list.ids.forEach(function (id) { picked[id] = true; });

    function close() { root.innerHTML = ''; document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    var items = state.records.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    root.innerHTML = '<div class="modal-backdrop"><div class="modal modal-wide">' +
      '<h3 class="modal-title">添加到「' + esc(list.name) + '」</h3>' +
      '<p class="modal-desc">勾选要放进这个列表的作品。</p>' +
      '<input class="input" id="pick-search" placeholder="搜索标题…" style="margin-bottom:10px">' +
      '<div class="bulk-list" id="pick-list">' + items.map(function (r) {
        return '<label class="bulk-item" data-title="' + esc(r.title.toLowerCase()) + '">' +
          '<input type="checkbox" data-pick="' + r.id + '"' + (picked[r.id] ? ' checked' : '') + '>' +
          '<span class="bulk-main"><strong>' + esc(r.title) + '</strong>' +
          '<em>' + TYPES[r.type].label + ' · ' + STATUSES[r.status] + (r.creator ? ' · ' + esc(r.creator) : '') + '</em></span>' +
          '</label>';
      }).join('') + '</div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" data-l="cancel">取消</button>' +
      '<button class="btn btn-primary" data-l="ok">保存</button></div></div></div>';

    root.querySelector('[data-l="cancel"]').addEventListener('click', close);
    root.querySelector('[data-l="ok"]').addEventListener('click', function () {
      var ids = [];
      root.querySelectorAll('[data-pick]').forEach(function (el) {
        if (el.checked) ids.push(el.dataset.pick);
      });
      list.ids = ids;
      save();
      close();
      toast('列表已更新');
      render();
    });

    var search = root.querySelector('#pick-search');
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      root.querySelectorAll('#pick-list .bulk-item').forEach(function (el) {
        el.classList.toggle('hidden', !!q && el.dataset.title.indexOf(q) < 0);
      });
    });
  }

  function enableDragSort() {
    var grid = document.querySelector('.grid-cards.is-sorting');
    if (!grid) return;
    var dragging = null;

    grid.addEventListener('pointerdown', function (e) {
      var card = e.target.closest('.pcard');
      if (!card) return;
      e.preventDefault();
      dragging = card;
      card.classList.add('dragging');
      try { card.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });

    grid.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var over = el && el.closest ? el.closest('.pcard') : null;
      if (!over || over === dragging) return;
      var rect = over.getBoundingClientRect();
      var before = (e.clientX - rect.left) < rect.width / 2;
      grid.insertBefore(dragging, before ? over : over.nextSibling);
    });

    function finish() {
      if (!dragging) return;
      dragging.classList.remove('dragging');
      dragging = null;
      var list = activeList();
      if (!list || list.kind !== 'manual') return;
      list.ids = Array.prototype.map.call(grid.children, function (c) { return c.dataset.id; });
      save();
      toast('顺序已保存');
    }
    grid.addEventListener('pointerup', finish);
    grid.addEventListener('pointercancel', finish);
  }

  /* ---------------- 批量操作 ---------------- */

  function selectedIds() {
    return Object.keys(state.ui.selected).filter(function (k) { return state.ui.selected[k]; });
  }

  function bulkStatus() {
    var ids = selectedIds();
    if (!ids.length) { toast('先选几条记录'); return; }
    openModal({
      title: '批量修改状态',
      desc: '把选中的 ' + ids.length + ' 条记录改为：',
      body: '<div class="modal-choice">' + STATUS_KEYS.map(function (k) {
        return '<button class="choice" data-bs="' + k + '"><strong>' + STATUSES[k] + '</strong></button>';
      }).join('') + '</div>',
      actions: [{ label: '取消', value: null, variant: 'ghost' }]
    });
    var root = document.getElementById('modal-root');
    root.querySelectorAll('[data-bs]').forEach(function (b) {
      b.addEventListener('click', function () {
        var st = b.dataset.bs;
        var cancel = root.querySelector('[data-idx="0"]');
        if (cancel) cancel.click(); else closeModal();
        var now = Date.now();
        state.records.forEach(function (r) {
          if (ids.indexOf(r.id) < 0) return;
          if (r.status !== st) {
            var act = st === 'done' ? 'finish' : st === 'doing' ? 'start' : st === 'paused' ? 'pause' : 'wish';
            r.logs.push({ action: act, at: now });
          }
          r.status = st;
          r.updatedAt = now;
        });
        save();
        exitSelect();
        toast('已修改 ' + ids.length + ' 条记录');
        render();
      });
    });
  }

  function bulkTag() {
    var ids = selectedIds();
    if (!ids.length) { toast('先选几条记录'); return; }
    var tags = tagCounts().map(function (t) { return t[0]; });
    if (!tags.length) { toast('还没有标签'); return; }
    var chosen = tags[0];

    openModal({
      title: '批量标签',
      desc: '给选中的 ' + ids.length + ' 条记录添加或移除标签：',
      body: '<select class="input" id="modal-input">' + tags.map(function (t) {
        return '<option value="' + esc(t) + '">' + esc(t) + '</option>';
      }).join('') + '</select>',
      actions: [
        { label: '取消', value: null, variant: 'ghost' },
        { label: '移除', value: 'remove', variant: 'ghost' },
        { label: '添加', value: 'add', variant: 'primary' }
      ]
    });

    var root = document.getElementById('modal-root');
    var sel = root.querySelector('#modal-input');
    if (sel) sel.addEventListener('change', function () { chosen = sel.value; });
    root.querySelectorAll('[data-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = Number(btn.dataset.idx);
        if (idx === 0) return;
        var mode = idx === 2 ? 'add' : 'remove';
        var val = sel ? sel.value : chosen;
        var now = Date.now();
        state.records.forEach(function (r) {
          if (ids.indexOf(r.id) < 0) return;
          var i = r.tags.indexOf(val);
          if (mode === 'add' && i < 0) r.tags.push(val);
          if (mode === 'remove' && i >= 0) r.tags.splice(i, 1);
          r.updatedAt = now;
        });
        save();
        exitSelect();
        toast(mode === 'add' ? '已添加标签' : '已移除标签');
        render();
      });
    });
  }

  function bulkDelete() {
    var ids = selectedIds();
    if (!ids.length) { toast('先选几条记录'); return; }
    openModal({
      title: '删除 ' + ids.length + ' 条记录？',
      desc: '这些记录会从本地数据中移除，无法撤销。',
      actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '删除', value: 'ok', variant: 'danger' }]
    }).then(function (v) {
      if (v !== 'ok') return;
      state.records = state.records.filter(function (r) { return ids.indexOf(r.id) < 0; });
      state.lists.forEach(function (l) {
        l.ids = l.ids.filter(function (id) { return ids.indexOf(id) < 0; });
      });
      save();
      exitSelect();
      toast('已删除 ' + ids.length + ' 条');
      render();
    });
  }

  function exitSelect() {
    state.ui.selectMode = false;
    state.ui.selected = {};
  }

  /* ---------------- 添加 / 编辑 ---------------- */

  function initDraft(id) {
    if (id) {
      var r = state.records.filter(function (x) { return x.id === id; })[0];
      if (!r) { location.hash = '#/library'; return; }
      state.draft = JSON.parse(JSON.stringify(r));
    } else {
      state.draft = {
        id: '', type: 'novel', title: '', originalTitle: '', aliases: [],
        creator: '', year: '', releaseDate: '', tags: [], rating: 0,
        status: 'wish', review: '', quotes: [], hours: 0, cover: '', updateDay: -1,
        douban: 0, recommend: '', category: '', sections: {}, notesLog: [],
        meta: {},
        magazine: normalizeMagazine({}, ''),
        startedAt: '', finishedAt: '', episodes: [],
        progress: {
          unit: 'chapter', current: 0, total: 0, season: 1, percent: 0,
          chapter: { current: 0, total: 0 },
          volume: { current: 0, total: 0 },
          page: { current: 0, total: 0 },
          segments: []
        },
        rewatches: [], logs: [], createdAt: 0, updatedAt: 0
      };
    }
    state.pasteOpen = false;
    state.pasteText = '';
  }

  function editView() {
    var d = state.draft;
    if (!d) return '';
    var isNew = !d.id;
    var type = d.type;
    var meta = TYPES[type];
    var mode = meta.mode;
    var isBook = mode === 'book';
    var isReadWord = isBook || mode === 'issue';

    var html = '<header class="edit-head">' +
      '<button class="icon-btn" data-action="back" aria-label="返回">' + icon('back', 19) + '</button>' +
      '<h1 class="edit-title">' + (isNew ? '记录一条' : '编辑记录') + '</h1>' +
      (isNew
        ? '<span class="icon-btn ghost"></span>'
        : '<button class="icon-btn" data-action="delete" aria-label="删除">' + icon('trash', 18) + '</button>') +
      '</header>';

    /* 类型 */
    html += '<section class="block"><div class="type-picker">' +
      TYPE_KEYS.map(function (k) {
        return '<button class="type-tile ' + (type === k ? 'is-on' : '') + '" data-action="set-type" data-value="' + k + '">' +
          icon(k, 24) + '<span>' + TYPES[k].label + '</span></button>';
      }).join('') + '</div></section>';

    /* 快速录入 */
    html += '<section class="block flush"><button class="paste-toggle ' + (state.pasteOpen ? 'is-open' : '') + '" data-action="toggle-paste">' +
      icon('sparkle', 16) + ' 粘贴文本快速填充<span class="chev">' + icon('chevron', 13) + '</span></button>' +
      '<div class="paste-body' + (state.pasteOpen ? '' : ' hidden') + '">' +
      '<textarea id="paste-input" class="input" rows="4" placeholder="粘贴一段简介，比如豆瓣条目：&#10;三体&#10;刘慈欣 / 重庆出版社 / 2008-1&#10;8.9">' + esc(state.pasteText) + '</textarea>' +
      '<div style="margin-top:9px"><button class="btn btn-ghost btn-sm" data-action="parse-paste">智能识别并填入</button></div>' +
      '</div></section>';

    /* 基础信息 */
    html += '<section class="block">' +
      '<label class="field"><span class="field-label">标题 <em>必填</em></span>' +
      '<input class="input" data-field="title" value="' + esc(d.title) + '" placeholder="作品名称"></label>' +

      '<div class="row2">' +
      '<label class="field"><span class="field-label">原名 / 外文名</span>' +
      '<input class="input" data-field="originalTitle" value="' + esc(d.originalTitle) + '" placeholder="选填"></label>' +
      '<label class="field"><span class="field-label">别名</span>' +
      '<input class="input" data-field="aliases" value="' + esc((d.aliases || []).join(', ')) + '" placeholder="多个用逗号分隔"></label>' +
      '</div>' +

      '<label class="field"><span class="field-label">' + esc(meta.creator) + '</span>' +
      '<input class="input" data-field="creator" value="' + esc(d.creator) + '" placeholder="' + esc(meta.creatorHint) + '"></label>' +

      '<div class="row2">' +
      '<label class="field"><span class="field-label">年份</span>' +
      '<input class="input" data-field="year" value="' + esc(d.year) + '" inputmode="numeric" placeholder="2024"></label>' +
      '<label class="field"><span class="field-label">状态</span>' +
      '<select class="input" data-field="status">' +
      STATUS_KEYS.map(function (k) {
        return '<option value="' + k + '"' + (d.status === k ? ' selected' : '') + '>' + STATUSES[k] + '</option>';
      }).join('') + '</select></label>' +
      '</div>' +

      '<label class="field"><span class="field-label">' + (isBook || mode === 'issue' ? '出版日期' : '上映 / 播出日期') + '</span>' +
      '<input class="input" type="date" data-field="releaseDate" value="' + esc(d.releaseDate) + '">' +
      '<span class="hint" style="display:block;margin-top:6px">' +
      (d.releaseDate
        ? (isReleased(d) ? (isBook || mode === 'issue' ? '已出版' : '已上映') : (isBook || mode === 'issue' ? '未出版（还没到日期）' : '未上映（还没到日期）'))
        : '留空时按年份判断；保存时会按年份自动补全') +
      '</span></label>' +

      '<div class="row2">' +
      '<label class="field"><span class="field-label">开始日期</span>' +
      '<input class="input" type="date" data-field="startedAt" value="' + esc(d.startedAt || '') + '"></label>' +
      '<label class="field"><span class="field-label">完成日期</span>' +
      '<input class="input" type="date" data-field="finishedAt" value="' + esc(d.finishedAt || '') + '">' +
      '<span class="hint" id="date-hint" style="display:block;margin-top:6px">' + dateSpanHint(d) + '</span></label>' +
      '</div>';

    /* 评分 */
    if (ratingScale() === 5) {
      html += '<div class="field"><span class="field-label">评分（半星可点）</span>' +
        '<div class="rating-field">' +
        starInputHTML(d.rating) +
        '<div class="rating-value"><strong id="rating-num">' + (d.rating ? ratingText(d.rating) : '—') + '</strong><span>/ 5</span></div>' +
        '</div></div>';
    } else {
      var pct = (d.rating || 0) * 10;
      html += '<div class="field"><span class="field-label">评分</span>' +
        '<div class="rating-field">' +
        '<input type="range" class="range" min="0" max="10" step="0.5" value="' + (d.rating || 0) + '" data-field="rating" style="--pct:' + pct + '%">' +
        '<div class="rating-value"><strong id="rating-num">' + (d.rating ? d.rating.toFixed(1) : '—') + '</strong><span>/ 10</span></div>' +
        '</div></div>';
    }

    /* 豆瓣评分 / 推荐指数 / 分类 */
    html += '<div class="row2">' +
      '<label class="field"><span class="field-label">豆瓣评分</span>' +
      '<input class="input" type="number" min="0" max="10" step="0.1" data-field="douban" value="' + (d.douban || '') + '" placeholder="8.9"></label>' +
      '<label class="field"><span class="field-label">推荐指数</span>' +
      '<select class="input" data-field="recommend">' +
      '<option value="">不标记</option>' +
      RECOMMEND_LEVELS.map(function (r) {
        return '<option value="' + r.key + '"' + (d.recommend === r.key ? ' selected' : '') + '>' + r.mark + ' ' + r.label + '</option>';
      }).join('') + '</select></label>' +
      '</div>' +
      '<label class="field"><span class="field-label">分类</span>' +
      '<select class="input" data-field="category">' +
      '<option value="">不分类</option>' +
      (function () {
        var opts = state.categories.slice();
        if (d.category && opts.indexOf(d.category) < 0) opts.push(d.category);
        return opts.map(function (c) {
          return '<option value="' + esc(c) + '"' + (d.category === c ? ' selected' : '') + '>' + esc(c) + '</option>';
        }).join('');
      })() + '</select></label>';

    /* 标签 */
    var custom = d.tags.filter(function (t) { return PRESET_TAGS.indexOf(t) < 0; });
    html += '<div class="field"><span class="field-label">题材标签</span>' +
      '<div class="tag-picker">' +
      PRESET_TAGS.map(function (t) {
        return '<button class="tag-chip ' + (d.tags.indexOf(t) >= 0 ? 'is-on' : '') + '" data-action="toggle-tag" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('') +
      custom.map(function (t) {
        return '<button class="tag-chip is-on" data-action="toggle-tag" data-tag="' + esc(t) + '">' + esc(t) + ' ×</button>';
      }).join('') +
      '</div>' +
      '<input class="input" id="tag-input" placeholder="添加自定义标签，回车确认">' +
      '</div>';

    html += '</section>';

    /* 期刊刊期 */
    if (mode === 'issue') html += magazineFieldsHTML(d);

    /* 类型专属字段 */
    if ((EXTRA_FIELDS[type] || []).length) html += extrasFieldsHTML(d);

    /* 进度 */
    if (mode === 'book') html += bookProgressHTML(d);
    else if (mode === 'series') html += seriesProgressHTML(d);
    else if (mode === 'percent') html += percentProgressHTML(d);
    if (mode === 'series') html += episodesHTML(d);

    /* 短评与时长 */
    html += '<section class="block">' +
      '<label class="field"><span class="field-label">短评</span>' +
      '<textarea class="input" rows="3" data-field="review" placeholder="一句话记下此刻的感受…">' + esc(d.review) + '</textarea></label>' +
      quotesHTML(d) +
      '<div class="row2">' +
      '<label class="field"><span class="field-label">投入时长（小时）</span>' +
      '<input class="input" type="number" min="0" step="0.5" data-field="hours" value="' + (d.hours || '') + '" placeholder="选填"></label>' +
      '<label class="field"><span class="field-label">消费次数</span>' +
      '<input class="input" value="共 ' + (1 + d.rewatches.length) + ' 次' + (d.rewatches.length ? '（' + cnNum(1 + d.rewatches.length) + '刷）' : '') + '" disabled></label>' +
      '</div></section>';

    /* 看剧笔记 / 读书笔记 */
    if (isScreenType(type)) html += sectionsHTML(d);
    if (isBookType(type)) html += notesLogHTML(d);

    /* 重看记录 */
    html += '<section class="block"><p class="block-title">' + (isReadWord ? '重读' : '重看') + '记录</p>' +
      '<div class="field">' +
      d.rewatches.map(function (w, i) { return rewatchRow(w, i); }).join('') +
      '<button class="btn btn-ghost btn-sm" data-action="add-rewatch">＋ 添加一次' + (isReadWord ? '重读' : '重看') + '</button>' +
      '</div></section>';

    /* 操作历史 */
    if (!isNew && d.logs && d.logs.length) {
      html += '<section class="block"><p class="block-title">操作历史</p>' +
        '<div class="log-list">' + logListHTML(d.logs) + '</div></section>';
    }

    /* 封面 */
    html += '<section class="block">' +
      '<label class="field"><span class="field-label">封面图片链接</span>' +
      '<input class="input" data-field="cover" value="' + esc(d.cover) + '" placeholder="https://…jpg" inputmode="url"></label>' +
      '<p class="hint">只支持图片链接，不会把图片存进数据里，导出更轻。</p>' +
      '</section>';

    html += '<div class="edit-bar">' +
      '<button class="btn btn-ghost" data-action="back">取消</button>' +
      '<button class="btn btn-primary grow" data-action="save">保存</button>' +
      '</div>';

    return html;
  }

  function rewatchRow(w, i) {
    return '<div class="rewatch">' +
      '<div class="rewatch-head">' +
      '<span class="rw-badge">' + cnNum(i + 2) + '刷</span>' +
      '<input class="input input-date" type="date" data-rw="date" data-id="' + w.id + '" value="' + esc(w.date) + '">' +
      '<button class="icon-btn tiny" data-action="del-rewatch" data-id="' + w.id + '" aria-label="删除这次记录">' + icon('close', 13) + '</button>' +
      '</div>' +
      '<div class="row2">' +
      '<input class="input" type="number" min="0" max="10" step="0.5" placeholder="评分" data-rw="rating" data-id="' + w.id + '" value="' + (w.rating || '') + '">' +
      '<input class="input" placeholder="这一次的感受" data-rw="review" data-id="' + w.id + '" value="' + esc(w.review) + '">' +
      '</div></div>';
  }

  function setDraftField(path, value) {
    var d = state.draft;
    if (!d) return;
    if (path === 'hours') { d.hours = num(value); return; }
    if (path === 'updateDay') { d.updateDay = Number(value); return; }
    if (path === 'douban') {
      d.douban = Math.max(0, Math.min(10, Math.round((Number(value) || 0) * 10) / 10));
      return;
    }
    if (path === 'aliases') {
      d.aliases = String(value || '').split(/[,，、\/]/).map(function (s) {
        return s.trim();
      }).filter(Boolean).slice(0, 10);
      return;
    }
    if (path === 'p.current') { d.progress.current = num(value); return; }
    if (path === 'p.total') { d.progress.total = num(value); return; }
    if (path === 'p.percent') {
      d.progress.percent = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
      return;
    }

    /* 点路径：p.chapter.current / mag.edition / meta.publisher */
    if (path.indexOf('.') > 0) {
      var parts = path.split('.');
      var root;
      if (parts[0] === 'mag') root = d.magazine || (d.magazine = normalizeMagazine({}, d.year));
      else if (parts[0] === 'meta') root = d.meta || (d.meta = {});
      else if (parts[0] === 'p') root = d.progress || (d.progress = {});
      else root = d[parts[0]] || (d[parts[0]] = {});

      var obj = root;
      for (var i = 1; i < parts.length - 1; i++) {
        obj = obj[parts[i]] || (obj[parts[i]] = {});
      }
      var key = parts[parts.length - 1];
      obj[key] = (key === 'current' || key === 'total') ? num(value) : value;
      if (parts[0] === 'mag' && key === 'year' && /^(19|20)\d{2}$/.test(String(value))) d.year = String(value);
      return;
    }
    d[path] = value;
  }

  /* ---------- 分季进度 ---------- */

  function segmentRowsHTML(d) {
    var t = TYPES[d.type];
    var segs = d.progress.segments || [];
    var watched = 0, total = 0, doneCount = 0;
    segs.forEach(function (sg) {
      watched += sg.current || 0;
      total += sg.total || 0;
      if (sg.done) doneCount++;
    });
    var doneWord = t.mode === 'series' ? '看完' : '读完';

    var summary = segs.length
      ? '已' + (t.mode === 'series' ? '看' : '读') + ' ' + watched + ' ' + t.itemUnit +
        (total ? ' / 共 ' + total + ' ' + t.itemUnit : '') + ' · ' + doneCount + ' ' + t.segUnit + '已' + doneWord
      : '还没有' + t.segUnit + '，先添加一' + t.segUnit + '开始记录。';

    var rows = segs.map(function (sg, i) {
      var no = sg.n || (i + 1);
      return '<div class="season-row">' +
        '<div class="season-head">' +
        '<span class="season-badge">第 ' + no + ' ' + t.segUnit + '</span>' +
        '<label class="season-done"><input type="checkbox" data-season-done="' + i + '"' + (sg.done ? ' checked' : '') + '><span>已' + doneWord + '</span></label>' +
        '<button class="icon-btn tiny" data-action="del-season" data-index="' + i + '" aria-label="删除第 ' + no + ' ' + t.segUnit + '">' + icon('close', 13) + '</button>' +
        '</div>' +
        '<div class="row2">' +
        '<label class="field"><span class="field-label">看到第几' + t.itemUnit + '</span>' +
        '<input class="input" type="number" min="0" data-season="' + i + '" data-sfield="current" value="' + (sg.current || '') + '"' + (sg.done ? ' disabled' : '') + ' placeholder="5"></label>' +
        '<label class="field"><span class="field-label">本' + t.segUnit + '共几' + t.itemUnit + '</span>' +
        '<input class="input" type="number" min="0" data-season="' + i + '" data-sfield="total" value="' + (sg.total || '') + '" placeholder="10"></label>' +
        '</div></div>';
    }).join('');

    return (rows || '<p class="season-empty">还没有' + t.segUnit + '，先添加一' + t.segUnit + '开始记录。</p>') +
      '<p class="season-sum">' + esc(summary) + '</p>' +
      '<button class="btn btn-ghost btn-sm" data-action="add-season" style="margin-bottom:14px">＋ 添加一' + t.segUnit + '</button>';
  }

  function bookProgressHTML(d) {
    var t = TYPES[d.type];
    var segs = d.progress.segments || [];
    var html = '<section class="block"><p class="block-title">阅读进度</p>';

    if (segs.length) {
      html += segmentRowsHTML(d);
      html += '<p class="hint" style="margin-top:2px">按' + t.segUnit + '细分后，每一' + t.segUnit +
        '单独记' + t.itemUnit + '数；删光分' + t.segUnit + '会回到单一进度。</p></section>';
      return html;
    }

    var unit = d.progress.unit === 'volume' ? 'volume' : (d.progress.unit === 'page' ? 'page' : 'chapter');
    var box = (unit === 'volume' ? d.progress.volume : (unit === 'page' ? d.progress.page : d.progress.chapter)) || { current: 0, total: 0 };
    var uLabel = unit === 'volume' ? t.volumeUnit : (unit === 'page' ? '页' : t.itemUnit);

    html += '<div class="unit-seg">' +
      '<button class="' + (unit === 'chapter' ? 'is-on' : '') + '" data-action="set-unit" data-value="chapter">按' + t.itemUnit + '</button>' +
      '<button class="' + (unit === 'volume' ? 'is-on' : '') + '" data-action="set-unit" data-value="volume">按' + t.volumeUnit + '</button>' +
      '<button class="' + (unit === 'page' ? 'is-on' : '') + '" data-action="set-unit" data-value="page">按页</button>' +
      '</div>';

    html += '<div class="row2">' +
      '<label class="field"><span class="field-label">当前第几' + uLabel + '</span>' +
      '<input class="input" type="number" min="0" data-field="p.' + unit + '.current" value="' + (box.current || '') + '" placeholder="' + (unit === 'volume' ? '5' : (unit === 'page' ? '120' : '45')) + '"></label>' +
      '<label class="field"><span class="field-label">共多少' + uLabel + '</span>' +
      '<input class="input" type="number" min="0" data-field="p.' + unit + '.total" value="' + (box.total || '') + '" placeholder="' + (unit === 'volume' ? '12' : (unit === 'page' ? '350' : '120')) + '"></label>' +
      '</div>';

    if (unit === 'chapter') {
      html += '<button class="btn btn-ghost btn-sm" data-action="add-season">＋ 分' + t.segUnit + '记录（可选）</button>' +
        '<p class="hint" style="margin-top:2px">' +
        (d.type === 'novel' ? '小说分几部出版时，可以按部细分，每部单独记章数。' : '漫画按卷出版时，可以按卷细分，每卷单独记话数。') +
        '</p>';
    } else if (unit === 'volume') {
      html += '<p class="hint" style="margin-top:2px">按' + t.volumeUnit + '记录适合实体书：直接填「第几' +
        t.volumeUnit + ' / 共几' + t.volumeUnit + '」。</p>';
    } else {
      html += '<p class="hint" style="margin-top:2px">按页记录适合电子书或带页码的版本，百分比会按页数自动算。</p>';
    }

    html += '</section>';
    return html;
  }

  function seriesProgressHTML(d) {
    var t = TYPES[d.type];
    return '<section class="block"><p class="block-title">分' + t.segUnit + '进度</p>' +
      segmentRowsHTML(d) +
      '<label class="field"><span class="field-label">更新日</span>' +
      '<select class="input" data-field="updateDay">' + dayOptionsHTML(d.updateDay) + '</select>' +
      '<span class="hint" style="display:block;margin-top:6px">设置后可在总览或设置里生成追更日历，每周提醒你。</span></label>' +
      '</section>';
  }

  function percentProgressHTML(d) {
    var pct = Math.max(0, Math.min(100, Math.round(d.progress.percent || 0)));
    return '<section class="block"><p class="block-title">通关进度</p>' +
      '<div class="rating-field">' +
      '<input type="range" class="range" min="0" max="100" step="1" value="' + pct + '" data-field="p.percent" style="--pct:' + pct + '%">' +
      '<div class="rating-value"><strong id="percent-num">' + pct + '%</strong></div>' +
      '</div>' +
      '<p class="hint" style="margin-top:2px">适合没有固定章节的游戏；状态改成「已完成」会自动显示为已通关。</p>' +
      '</section>';
  }

  function dateSpanHint(d) {
    if (!d.startedAt || !d.finishedAt) return '填了开始和完成日期，会自动算用时';
    var a = new Date(d.startedAt + 'T00:00:00');
    var b = new Date(d.finishedAt + 'T00:00:00');
    var days = Math.round((b - a) / 86400000) + 1;
    return days > 0 ? '用时 ' + days + ' 天' : '完成日期早于开始日期';
  }

  function isScreenType(type) {
    return ['tv', 'anime', 'movie', 'variety', 'drama', 'stage'].indexOf(type) >= 0;
  }

  function isBookType(type) {
    return ['novel', 'comic', 'magazine'].indexOf(type) >= 0;
  }

  function sectionsHTML(d) {
    var sec = d.sections || (d.sections = {});
    var open = state.ui.fold || (state.ui.fold = {});
    return '<section class="block"><p class="block-title">看剧笔记</p>' +
      '<p class="hint" style="margin:-2px 0 10px">分块记，比一大段更好翻。</p>' +
      SECTION_KEYS.map(function (item) {
        var val = sec[item.key] || '';
        var isOpen = open['sec_' + item.key] || !!val;
        return '<div class="fold' + (isOpen ? ' is-open' : '') + '">' +
          '<button class="fold-head" data-action="fold" data-key="sec_' + item.key + '">' +
          '<span>' + item.label + '</span>' +
          '<em>' + (val ? val.length + ' 字' : '空') + '</em>' + icon('chevron', 14) + '</button>' +
          (isOpen
            ? '<div class="fold-body"><textarea class="input" rows="3" data-sec="' + item.key + '" placeholder="' + item.label + '方面想说的…">' + esc(val) + '</textarea></div>'
            : '') +
          '</div>';
      }).join('') + '</section>';
  }

  function notesLogHTML(d) {
    var list = (d.notesLog || []).slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    var rows = list.map(function (n) {
      return '<div class="note-item">' +
        '<div class="note-head">' +
        '<input class="input input-date" type="date" data-note="date" data-id="' + n.id + '" value="' + esc(n.date) + '">' +
        '<button class="icon-btn tiny" data-action="del-note" data-id="' + n.id + '" aria-label="删除这条笔记">' + icon('close', 13) + '</button>' +
        '</div>' +
        '<textarea class="input" rows="4" data-note="text" data-id="' + n.id + '" placeholder="写点什么…">' + esc(n.text) + '</textarea>' +
        '</div>';
    }).join('');
    return '<section class="block"><p class="block-title">读书笔记' +
      (list.length ? ' <em class="opt">' + list.length + ' 篇</em>' : '') + '</p>' +
      '<p class="hint" style="margin:-2px 0 10px">可以按日期写多篇，长一点也没关系。</p>' +
      (rows || '<p class="season-empty">还没有笔记。读到有意思的地方就写一段。</p>') +
      '<button class="btn btn-ghost btn-sm" data-action="add-note">＋ 写一篇</button>' +
      '</section>';
  }

  function quotesHTML(d) {
    var list = d.quotes || [];
    var rows = list.map(function (q, i) { return quoteRow(q, i); }).join('');
    return '<div class="field"><span class="field-label">摘抄 <em class="opt">' +
      (list.length ? list.length + ' 条' : '可选') + '</em></span>' +
      (rows || '<p class="hint" style="margin:0 0 8px">喜欢的台词、歌词、段落都可以抄在这里，可以多条。</p>') +
      '<button class="btn btn-ghost btn-sm" data-action="add-quote">＋ 添加摘抄</button></div>';
  }

  function quoteRow(q, i) {
    return '<div class="quote-row">' +
      '<textarea class="input" rows="2" data-q="text" data-id="' + q.id + '" placeholder="摘抄内容">' + esc(q.text) + '</textarea>' +
      '<div class="quote-foot">' +
      '<input class="input input-page" data-q="page" data-id="' + q.id + '" value="' + esc(q.page) + '" placeholder="页码 / 出处">' +
      '<button class="icon-btn tiny" data-action="del-quote" data-id="' + q.id + '" aria-label="删除这条摘抄">' + icon('close', 13) + '</button>' +
      '</div></div>';
  }

  function episodesHTML(d) {
    var list = d.episodes || [];
    var rows = list.map(function (e, i) { return episodeRow(e, i); }).join('');
    return '<section class="block"><p class="block-title">单集记录</p>' +
      (rows || '<p class="season-empty">还没有单集记录。追完一集想写两句时，记在这里。</p>') +
      '<button class="btn btn-ghost btn-sm" data-action="add-episode">＋ 添加一集</button>' +
      '</section>';
  }

  function episodeRow(e, i) {
    return '<div class="ep-row">' +
      '<div class="ep-head">' +
      '<label class="ep-no"><span>第</span>' +
      '<input class="input" type="number" min="1" data-ep="no" data-id="' + e.id + '" value="' + (e.no || '') + '" placeholder="' + (i + 1) + '">' +
      '<span>集</span></label>' +
      '<input class="input input-date" type="date" data-ep="date" data-id="' + e.id + '" value="' + esc(e.date) + '">' +
      '<button class="icon-btn tiny" data-action="del-episode" data-id="' + e.id + '" aria-label="删除这一集">' + icon('close', 13) + '</button>' +
      '</div>' +
      '<div class="row2">' +
      '<input class="input" type="number" min="0" max="10" step="0.5" data-ep="rating" data-id="' + e.id + '" value="' + (e.rating || '') + '" placeholder="评分">' +
      '<input class="input" data-ep="review" data-id="' + e.id + '" value="' + esc(e.review) + '" placeholder="这一集的一句话">' +
      '</div></div>';
  }

  function magazineFieldsHTML(d) {
    var m = d.magazine || (d.magazine = normalizeMagazine({}, d.year));
    function opts(list, cur, blank) {
      return '<option value="">' + blank + '</option>' + list.map(function (o) {
        return '<option value="' + esc(o) + '"' + (cur === o ? ' selected' : '') + '>' + esc(o) + '</option>';
      }).join('');
    }
    var partOpts = '<option value="">无</option>' + MAG_PARTS.map(function (o) {
      var label = /刊$/.test(o) ? o : o + '刊';
      return '<option value="' + esc(o) + '"' + (m.part === o ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');

    return '<section class="block"><p class="block-title">刊期信息</p>' +
      '<div class="row2">' +
      '<label class="field"><span class="field-label">版别</span>' +
      '<select class="input" data-field="mag.edition">' + opts(MAG_EDITIONS, m.edition, '不指定') + '</select></label>' +
      '<label class="field"><span class="field-label">刊期</span>' +
      '<select class="input" data-field="mag.frequency">' + opts(MAG_FREQ, m.frequency, '不指定') + '</select></label>' +
      '</div>' +
      '<div class="row3">' +
      '<label class="field"><span class="field-label">年份</span>' +
      '<input class="input" type="number" min="1900" max="2099" data-field="mag.year" value="' + esc(m.year) + '" placeholder="2026"></label>' +
      '<label class="field"><span class="field-label">月份</span>' +
      '<input class="input" type="number" min="1" max="12" data-field="mag.month" value="' + esc(m.month) + '" placeholder="10"></label>' +
      '<label class="field"><span class="field-label">刊别</span>' +
      '<select class="input" data-field="mag.part">' + partOpts + '</select></label>' +
      '</div>' +
      '<div class="row2">' +
      '<label class="field"><span class="field-label">第几期</span>' +
      '<input class="input" data-field="mag.issueNo" value="' + esc(m.issueNo) + '" placeholder="10"></label>' +
      '<label class="field"><span class="field-label">总第几期</span>' +
      '<input class="input" data-field="mag.totalNo" value="' + esc(m.totalNo) + '" placeholder="128"></label>' +
      '</div>' +
      '<label class="field"><span class="field-label">出版方</span>' +
      '<input class="input" data-field="mag.publisher" value="' + esc(m.publisher) + '" placeholder="出版社 / 编辑部"></label>' +
      '<p class="hint">会显示成「' + esc(magazineIssueText({ type: 'magazine', magazine: m, year: d.year, status: d.status })) + '」</p>' +
      '</section>';
  }

  function extrasFieldsHTML(d) {
    var list = EXTRA_FIELDS[d.type] || [];
    if (!list.length) return '';
    var m = d.meta || (d.meta = {});
    var cells = list.map(function (f) {
      var val = m[f.key] == null ? '' : String(m[f.key]);
      var input;
      if (f.options) {
        input = '<select class="input" data-field="meta.' + f.key + '">' +
          '<option value="">不指定</option>' +
          f.options.map(function (o) {
            return '<option value="' + esc(o) + '"' + (val === o ? ' selected' : '') + '>' + esc(o) + '</option>';
          }).join('') + '</select>';
      } else {
        input = '<input class="input" ' + (f.numeric ? 'type="number" min="0" ' : '') +
          'data-field="meta.' + f.key + '" value="' + esc(val) + '" placeholder="' + esc(f.placeholder || '选填') + '">';
      }
      return '<label class="field"><span class="field-label">' + esc(f.label) + '</span>' + input + '</label>';
    });
    return '<section class="block"><p class="block-title">' + TYPES[d.type].label + '信息</p>' +
      '<div class="row2">' + cells.join('') + '</div></section>';
  }

  function starInputHTML(rating) {
    var pct = Math.round(rating || 0) * 10;
    var stars = '★★★★★';
    var hits = '';
    for (var i = 1; i <= 10; i++) {
      hits += '<button data-action="set-star" data-value="' + (i * 0.5) + '" aria-label="' + (i * 0.5) + ' 星"></button>';
    }
    return '<div class="stars" id="star-input">' +
      '<span class="stars-bg">' + stars + '</span>' +
      '<span class="stars-fill" style="width:' + pct + '%">' + stars + '</span>' +
      '<span class="stars-hit">' + hits + '</span>' +
      '</div>';
  }

  function dayOptionsHTML(cur) {    var names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    var html = '<option value="-1"' + (Number(cur) < 0 ? ' selected' : '') + '>不设置</option>';
    for (var i = 0; i < 7; i++) {
      html += '<option value="' + i + '"' + (Number(cur) === i ? ' selected' : '') + '>每' + names[i] + '</option>';
    }
    return html;
  }

  function logListHTML(logs) {
    if (!logs || !logs.length) return '<p class="hint" style="margin:0">暂无历史记录</p>';
    return logs.slice().sort(function (a, b) { return b.at - a.at; }).map(function (l) {
      var d = new Date(l.at);
      return '<div class="log-row">' +
        '<span class="log-dot" data-a="' + esc(l.action) + '"></span>' +
        '<span class="log-name">' + esc(LOG_LABELS[l.action] || l.action) + '</span>' +
        '<span class="log-time">' + ymd(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</span>' +
        '</div>';
    }).join('');
  }

  function saveDraft() {
    var d = state.draft;
    if (!d) return;
    var title = String(d.title || '').trim();
    if (!title) {
      toast('先写个标题吧');
      var el = document.querySelector('[data-field="title"]');
      if (el) {
        el.focus();
        el.classList.add('shake');
        setTimeout(function () { el.classList.remove('shake'); }, 400);
      }
      return;
    }

    var now = Date.now();
    var isNew = !d.id;

    var todayStr = todayISO();
    var startedAt = d.startedAt || '';
    var finishedAt = d.finishedAt || '';
    if (!startedAt && (d.status === 'doing' || d.status === 'done')) startedAt = todayStr;
    if (!finishedAt && d.status === 'done') finishedAt = todayStr;

    var yearOut = d.year;
    if (d.type === 'magazine' && d.magazine && /^(19|20)\d{2}$/.test(String(d.magazine.year || ''))) {
      yearOut = String(d.magazine.year);
    }

    var releaseDate = d.releaseDate || '';
    if (!releaseDate) {
      var ym = String(yearOut || '').match(/^(19|20)\d{2}$/);
      if (ym && Number(yearOut) < new Date().getFullYear()) releaseDate = yearOut + '-01-01';
    }

    var rec = normalizeRecord({
      id: d.id || '',
      type: d.type,
      title: title,
      originalTitle: d.originalTitle,
      aliases: d.aliases,
      creator: d.creator,
      year: yearOut,
      releaseDate: releaseDate,
      tags: d.tags,
      rating: d.rating,
      status: d.status,
      review: d.review,
      quotes: (d.quotes || []).filter(function (q) { return q.text && q.text.trim(); }),
      douban: d.douban || 0,
      recommend: d.recommend || '',
      category: d.category || '',
      sections: d.sections || {},
      notesLog: (d.notesLog || []).filter(function (n) { return n.text && n.text.trim(); }),
      hours: d.hours,
      cover: d.cover,
      updateDay: d.updateDay,
      meta: d.meta || {},
      magazine: d.magazine || {},
      startedAt: startedAt,
      finishedAt: finishedAt,
      episodes: (d.episodes || []).slice().sort(function (a, b) { return (a.no || 0) - (b.no || 0); }),
      progress: {
        unit: d.progress.unit,
        percent: d.progress.percent || 0,
        chapter: d.progress.chapter || { current: 0, total: 0 },
        volume: d.progress.volume || { current: 0, total: 0 },
        page: d.progress.page || { current: 0, total: 0 },
        segments: (d.progress.segments || []).map(function (sg, i) {
          return { n: sg.n || (i + 1), current: sg.current, total: sg.total, done: sg.done };
        })
      },
      rewatches: d.rewatches,
      logs: d.logs,
      createdAt: d.createdAt || now,
      updatedAt: now
    });
    if (!rec) return;

    var prev = isNew ? null : state.records.filter(function (r) { return r.id === rec.id; })[0];
    var logs = Array.isArray(d.logs) ? d.logs.slice() : [];

    var rwLogs = logs.filter(function (l) { return l.action === 'rewatch'; }).length;
    var need = rec.rewatches.length - rwLogs;
    for (var k = 0; k < need; k++) logs.push({ action: 'rewatch', at: now });

    if (isNew) {
      logs = logs.filter(function (l) { return l.action !== 'add'; });
      logs.forEach(function (l) { if (l.at < rec.createdAt) l.at = rec.createdAt; });
      logs.unshift({ action: 'add', at: rec.createdAt });
      if (rec.status === 'doing') logs.push({ action: 'start', at: now });
      if (rec.status === 'done') logs.push({ action: 'finish', at: now });
    } else if (prev && prev.status !== rec.status) {
      var act = rec.status === 'done' ? 'finish' : rec.status === 'doing' ? 'start'
        : rec.status === 'paused' ? 'pause' : 'wish';
      logs.push({ action: act, at: now });
    }
    rec.logs = logs;

    if (isNew) {
      state.records.unshift(rec);
    } else {
      var i = state.records.findIndex(function (r) { return r.id === rec.id; });
      if (i >= 0) state.records[i] = rec;
      else state.records.unshift(rec);
    }
    save();
    state.draft = null;
    toast(isNew ? '已收录「' + rec.title + '」' : '已保存');
    location.hash = state.returnTo || '#/library';
  }

  /* ---------------- 时间线 ---------------- */

  function timelineView() {
    var t = state.timeline;
    var html = '<div class="narrow">';
    html += pageHead('按时间回顾', '时间线');

    html += '<div class="seg">' +
      '<button data-action="tl-view" data-value="axis" class="' + (t.view === 'axis' ? 'is-active' : '') + '">时间轴</button>' +
      '<button data-action="tl-view" data-value="cal" class="' + (t.view === 'cal' ? 'is-active' : '') + '">日历</button>' +
      '<button data-action="tl-view" data-value="checkin" class="' + (t.view === 'checkin' ? 'is-active' : '') + '">打卡</button>' +
      '</div>';

    html += t.view === 'axis' ? axisHTML() : (t.view === 'cal' ? calendarHTML() : checkinHTML());
    html += '</div>';
    return html;
  }

  function checkinOf(date) {
    return state.checkins.filter(function (c) { return c.date === date; })[0] || null;
  }

  function checkinStats() {
    var map = {};
    state.checkins.forEach(function (c) { map[c.date] = c; });
    var minutes = state.checkins.reduce(function (s2, c) { return s2 + (c.minutes || 0); }, 0);
    var streak = 0;
    var d = new Date();
    if (!map[ymd(d)]) d.setDate(d.getDate() - 1);
    while (map[ymd(d)]) { streak++; d.setDate(d.getDate() - 1); }
    var y = state.checkin.y, m = state.checkin.m;
    var monthDays = state.checkins.filter(function (c) {
      var dd = new Date(c.date + 'T00:00:00');
      return dd.getFullYear() === y && dd.getMonth() === m;
    }).length;
    return { total: Object.keys(map).length, minutes: minutes, streak: streak, monthDays: monthDays };
  }

  function checkinHTML() {
    var c = state.checkin;
    var y = c.y, m = c.m;
    var todayStr = todayISO();
    var sel = c.sel || todayStr;
    var entry = checkinOf(sel);
    var selDate = new Date(sel + 'T00:00:00');

    var first = new Date(y, m, 1);
    var startWd = first.getDay();
    var days = new Date(y, m + 1, 0).getDate();
    var map = {};
    state.checkins.forEach(function (x) {
      var dd = new Date(x.date + 'T00:00:00');
      if (dd.getFullYear() === y && dd.getMonth() === m) map[dd.getDate()] = x;
    });

    var cells = '';
    for (var i = 0; i < startWd; i++) cells += '<span class="cal-day is-blank"></span>';
    for (var d = 1; d <= days; d++) {
      var ds = y + '-' + pad(m + 1) + '-' + pad(d);
      var cls = 'cal-day';
      if (map[d]) cls += ' has-rec';
      if (ds === todayStr) cls += ' is-today';
      if (ds === sel) cls += ' is-selected';
      cells += '<button class="' + cls + '" data-action="checkin-day" data-date="' + ds + '">' + d + '</button>';
    }

    var st = checkinStats();
    var recs = state.records.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    var opts = '<option value="">不关联作品</option>' + recs.map(function (r) {
      return '<option value="' + r.id + '"' + (entry && entry.recordId === r.id ? ' selected' : '') + '>' + esc(r.title) + '</option>';
    }).join('');

    return '<div class="checkin-stats">' +
      '<div><strong>' + st.monthDays + '</strong><span>本月打卡</span></div>' +
      '<div><strong>' + st.streak + '</strong><span>连续天数</span></div>' +
      '<div><strong>' + fmtHours(st.minutes / 60) + '</strong><span>累计小时</span></div>' +
      '</div>' +
      '<div class="cal-card">' +
      '<div class="cal-head">' +
      '<button class="icon-btn" data-action="checkin-prev" aria-label="上个月">' + icon('back', 17) + '</button>' +
      '<div class="cal-title">' + y + ' 年 ' + (m + 1) + ' 月</div>' +
      '<button class="icon-btn" data-action="checkin-next" aria-label="下个月">' + icon('chevron', 17) + '</button>' +
      '</div>' +
      '<div class="cal-grid">' +
      ['日', '一', '二', '三', '四', '五', '六'].map(function (w) { return '<div class="cal-wd">' + w + '</div>'; }).join('') +
      cells + '</div></div>' +

      '<div class="checkin-card">' +
      '<div class="checkin-head">' +
      '<span>' + (sel === todayStr ? '今天 · ' : '补记 · ') + (selDate.getMonth() + 1) + ' 月 ' + selDate.getDate() + ' 日</span>' +
      (entry ? '<span class="checkin-done">已打卡</span>' : '<span class="checkin-todo">还没打卡</span>') +
      '</div>' +
      '<div class="row2">' +
      '<label class="field"><span class="field-label">在看 / 在读</span>' +
      '<select class="input" data-checkin="record">' + opts + '</select></label>' +
      '<label class="field"><span class="field-label">时长（分钟）</span>' +
      '<input class="input" type="number" min="0" max="1440" data-checkin="minutes" value="' + (entry ? entry.minutes : '') + '" placeholder="30"></label>' +
      '</div>' +
      '<label class="field"><span class="field-label">今天的一句</span>' +
      '<input class="input" data-checkin="note" value="' + (entry ? esc(entry.note) : '') + '" placeholder="选填"></label>' +
      '<div class="checkin-actions">' +
      '<button class="btn btn-primary btn-sm" data-action="checkin-save">' + (entry ? '保存修改' : '打卡') + '</button>' +
      (entry ? '<button class="btn btn-ghost btn-sm" data-action="checkin-del">撤销这天</button>' : '') +
      (sel !== todayStr ? '<button class="btn btn-ghost btn-sm" data-action="checkin-today">回到今天</button>' : '') +
      '</div></div>' +

      checkinListHTML();
  }

  function checkinListHTML() {
    var list = state.checkins.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 12);
    if (!list.length) return '<p class="day-empty" style="margin-top:14px">还没有打卡记录，从今天开始吧。</p>';
    return '<div class="checkin-list">' + list.map(function (c) {
      var r = state.records.filter(function (x) { return x.id === c.recordId; })[0];
      var d = new Date(c.date + 'T00:00:00');
      return '<div class="checkin-row">' +
        '<span class="checkin-date">' + (d.getMonth() + 1) + '月' + d.getDate() + '日</span>' +
        '<span class="checkin-main">' + esc(r ? r.title : (c.note || '打卡')) +
        (r && c.note ? '<em class="checkin-note">' + esc(c.note) + '</em>' : '') + '</span>' +
        '<span class="checkin-min">' + (c.minutes ? c.minutes + ' 分钟' : '') + '</span>' +
        '</div>';
    }).join('') + '</div>';
  }

  function axisHTML() {
    var recs = state.records.slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    if (!recs.length) {
      return '<div class="empty"><div class="empty-mark">·</div>' +
        '<p class="empty-title">时间线还没有内容</p>' +
        '<p class="empty-text">每记录一条作品，这里就会多一个坐标。</p>' +
        '<button class="btn btn-ghost btn-sm" data-action="new">＋ 记录一条</button></div>';
    }
    var groups = {};
    var order = [];
    recs.forEach(function (r) {
      var d = new Date(r.createdAt);
      var key = d.getFullYear() + '-' + pad(d.getMonth() + 1);
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(r);
    });

    return order.map(function (key) {
      var parts = key.split('-');
      var list = groups[key];
      return '<div class="tl-month"><h3>' + parts[0] + ' 年 ' + Number(parts[1]) + ' 月</h3>' +
        '<span>' + list.length + ' 条</span></div>' +
        '<div class="tl-list">' + list.map(timelineItem).join('') + '</div>';
    }).join('');
  }

  function timelineItem(r) {
    var d = new Date(r.createdAt);
    return '<div class="tl-item"><div class="tl-body" data-action="open" data-id="' + r.id + '" role="button" tabindex="0">' +
      '<div class="tl-top"><span class="tl-date">' + md(d) + '</span>' +
      '<span class="chip" data-s="' + r.status + '">' + STATUSES[r.status] + '</span></div>' +
      '<h3 class="tl-title">' + esc(r.title) + '</h3>' +
      (r.review ? '<p class="tl-review">' + esc(r.review) + '</p>' : '') +
      (r.quotes && r.quotes.length ? '<div class="quote-block">' + esc(r.quotes[0].text) + '</div>' +
        (r.quotes.length > 1 ? '<p class="quote-more">还有 ' + (r.quotes.length - 1) + ' 条摘抄</p>' : '') : '') +
      ratingBar(r) +
      tagPills(r) +
      logLine(r) +
      '</div></div>';
  }

  function calendarHTML() {
    var t = state.timeline;
    var y = t.y, m = t.m;
    var first = new Date(y, m, 1);
    var startWd = first.getDay();
    var days = new Date(y, m + 1, 0).getDate();
    var today = new Date();
    var todayStr = ymd(today);

    var pool = state.records.filter(function (r) {
      return t.type === 'all' || r.type === t.type;
    });

    var map = {};
    pool.forEach(function (r) {
      var d = new Date(r.createdAt);
      if (d.getFullYear() === y && d.getMonth() === m) {
        var k = d.getDate();
        (map[k] = map[k] || []).push(r);
      }
    });

    var selected = t.selected;
    if (!selected || selected.indexOf(y + '-' + pad(m + 1)) !== 0) {
      var dayKeys = Object.keys(map).map(Number).sort(function (a, b) { return b - a; });
      var isThisMonth = today.getFullYear() === y && today.getMonth() === m;
      if (isThisMonth && map[today.getDate()]) selected = todayStr;
      else if (dayKeys.length) selected = y + '-' + pad(m + 1) + '-' + pad(dayKeys[0]);
      else if (isThisMonth) selected = todayStr;
      else selected = null;
    }

    var cells = '';
    for (var i = 0; i < startWd; i++) cells += '<span class="cal-day is-blank"></span>';
    for (var d = 1; d <= days; d++) {
      var ds = y + '-' + pad(m + 1) + '-' + pad(d);
      var cls = 'cal-day';
      if (map[d]) cls += ' has-rec';
      if (ds === todayStr) cls += ' is-today';
      if (ds === selected) cls += ' is-selected';
      cells += '<button class="' + cls + '" data-action="cal-day" data-date="' + ds + '">' + d + '</button>';
    }

    var selList = selected ? pool.filter(function (r) {
      return ymd(new Date(r.createdAt)) === selected;
    }) : [];

    return '<div class="seg seg-type cal-filter">' +
      ['all'].concat(TYPE_KEYS).map(function (k) {
        var label = k === 'all' ? '全部' : TYPES[k].label;
        return '<button data-action="cal-type" data-value="' + k + '" class="' + (t.type === k ? 'is-active' : '') + '">' + label + '</button>';
      }).join('') + '</div>' +
      '<div class="cal-card">' +
      '<div class="cal-head">' +
      '<button class="icon-btn" data-action="cal-prev" aria-label="上个月">' + icon('back', 17) + '</button>' +
      '<div class="cal-title">' + y + ' 年 ' + (m + 1) + ' 月</div>' +
      '<button class="icon-btn" data-action="cal-next" aria-label="下个月">' + icon('chevron', 17) + '</button>' +
      '</div>' +
      '<div class="cal-grid">' +
      ['日', '一', '二', '三', '四', '五', '六'].map(function (w) { return '<div class="cal-wd">' + w + '</div>'; }).join('') +
      cells +
      '</div>' +
      '<div class="cal-foot"><span>' + Object.keys(map).reduce(function (s, k) { return s + map[k].length; }, 0) + ' 条记录</span>' +
      '<button class="link-btn" data-action="cal-export">' + icon('download', 13) + ' 导出本月日历</button></div>' +
      '</div>' +
      '<div class="day-panel">' +
      (selected
        ? '<h3 class="day-title">' + selected.split('-')[0] + ' 年 ' + Number(selected.split('-')[1]) + ' 月 ' + Number(selected.split('-')[2]) + ' 日</h3>' +
        (selList.length
          ? '<div class="tl-list">' + selList.map(timelineItem).join('') + '</div>'
          : '<p class="day-empty">这一天没有记录。</p>')
        : '<p class="day-empty">这个月还没有记录。</p>') +
      '</div>';
  }

  function exportMonthICS() {
    var y = state.timeline.y, m = state.timeline.m;
    var list = state.records.filter(function (r) {
      var d = new Date(r.createdAt);
      if (d.getFullYear() !== y || d.getMonth() !== m) return false;
      if (state.timeline.type !== 'all' && r.type !== state.timeline.type) return false;
      return true;
    });
    if (!list.length) { toast('这个月没有可导出的记录'); return; }

    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ShiLu//Diary//CN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:' + icsEscape('次元簿 · ' + y + ' 年 ' + (m + 1) + ' 月')
    ];
    list.forEach(function (r) {
      var d = new Date(r.createdAt);
      var ds = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
      var nd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      var next = nd.getFullYear() + pad(nd.getMonth() + 1) + pad(nd.getDate());
      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + r.id + '-diary@shilu.local');
      lines.push('DTSTAMP:' + icsUTC(new Date()));
      lines.push('DTSTART;VALUE=DATE:' + ds);
      lines.push('DTEND;VALUE=DATE:' + next);
      lines.push('SUMMARY:' + icsEscape('《' + r.title + '》' + (r.status === 'done' ? '已完成' : '收录')));
      lines.push('DESCRIPTION:' + icsEscape([TYPES[r.type].label, r.creator, r.rating ? ratingText(r.rating) + ' 分' : ''].filter(Boolean).join(' · ')));
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');

    var blob = new Blob([lines.map(foldICS).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
    downloadBlob(blob, 'shilu-' + y + '-' + pad(m + 1) + '.ics');
    toast('已导出 ' + list.length + ' 条记录');
  }

  /* ---------------- 数据 ---------------- */

  function last12Months() {
    var arr = [];
    var now = new Date();
    for (var i = 11; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push({ y: d.getFullYear(), m: d.getMonth() + 1, count: 0 });
    }
    state.records.forEach(function (r) {
      var d = new Date(r.createdAt);
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].y === d.getFullYear() && arr[i].m === d.getMonth() + 1) { arr[i].count++; break; }
      }
    });
    return arr;
  }

  function trendSVG(data) {
    var W = 680, H = 230, pl = 10, pr = 10, pt = 18, pb = 16;
    var max = Math.max(1, Math.max.apply(null, data.map(function (d) { return d.count; })));
    var iw = W - pl - pr, ih = H - pt - pb;
    var x = function (i) { return pl + (iw / (data.length - 1)) * i; };
    var y = function (v) { return pt + ih - (v / max) * ih; };

    var line = data.map(function (d, i) {
      return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d.count).toFixed(1);
    }).join(' ');

    var area = line + ' L ' + x(data.length - 1).toFixed(1) + ' ' + (pt + ih) + ' L ' + pl + ' ' + (pt + ih) + ' Z';

    var grid = '';
    for (var g = 0; g <= 2; g++) {
      var gy = pt + (ih / 2) * g;
      grid += '<line x1="' + pl + '" y1="' + gy + '" x2="' + (W - pr) + '" y2="' + gy + '" stroke="var(--line)" stroke-width="1"/>';
    }

    var dots = data.map(function (d, i) {
      if (!d.count) return '';
      return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(d.count).toFixed(1) + '" r="3.4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>';
    }).join('');

    return '<svg class="trend" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="var(--accent)" stop-opacity=".18"/>' +
      '<stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      grid +
      '<path d="' + area + '" fill="url(#areaGrad)"/>' +
      '<path d="' + line + '" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>' +
      dots +
      '</svg>';
  }

  function donutSVG(counts) {
    var total = TYPE_KEYS.reduce(function (s, k) { return s + (counts[k] || 0); }, 0);
    var r = 60, c = 2 * Math.PI * r;
    var off = 0;
    var segs = TYPE_KEYS.map(function (k) {
      var n = counts[k] || 0;
      if (!n || !total) return '';
      var len = (n / total) * c;
      var gap = total > 1 ? 3 : 0;
      var dash = Math.max(len - gap, 1);
      var s = '<circle cx="80" cy="80" r="' + r + '" fill="none" stroke="var(--t-' + k + ')" stroke-width="15" ' +
        'stroke-dasharray="' + dash.toFixed(2) + ' ' + (c - dash).toFixed(2) + '" ' +
        'stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 80 80)"/>';
      off += len;
      return s;
    }).join('');

    return '<svg class="donut" viewBox="0 0 160 160" aria-hidden="true">' +
      '<circle cx="80" cy="80" r="' + r + '" fill="none" stroke="var(--surface-2)" stroke-width="15"/>' +
      segs +
      '<text x="80" y="78" text-anchor="middle" class="donut-center" fill="var(--ink)" font-size="28" font-weight="600">' + total + '</text>' +
      '<text x="80" y="96" text-anchor="middle" fill="var(--ink-3)" font-size="10" letter-spacing="2">条</text>' +
      '</svg>';
  }

  function emptyTypeCounts() {
    var o = {};
    TYPE_KEYS.forEach(function (k) { o[k] = 0; });
    return o;
  }

  function statsView() {
    var recs = state.records;
    var total = recs.length;
    var hours = recs.reduce(function (s, r) { return s + (r.hours || 0); }, 0);
    var rated = recs.filter(function (r) { return r.rating > 0; });
    var avg = rated.length ? rated.reduce(function (s, r) { return s + r.rating; }, 0) / rated.length : 0;
    var tags = tagCounts();

    var counts = emptyTypeCounts();
    recs.forEach(function (r) { if (counts[r.type] != null) counts[r.type]++; });

    var data = last12Months();
    var maxCount = Math.max.apply(null, data.map(function (d) { return d.count; }).concat([0]));

    var html = pageHead('看得见的积累', '数据');

    html += '<div class="kpi-row">' +
      '<div class="kpi"><strong>' + fmtHours(hours) + '</strong><span>累计小时</span></div>' +
      '<div class="kpi"><strong>' + (avg ? ratingText(avg) : '—') + '</strong><span>平均评分</span></div>' +
      '<div class="kpi"><strong>' + (tags.length ? tags[0][0] : '—') + '</strong><span>最常题材</span></div>' +
      '</div>';

    /* 趋势 */
    html += '<div class="chart-card"><div class="chart-head"><h3 class="chart-title">近 12 个月</h3>' +
      '<span class="chart-note">最多 ' + maxCount + ' 条 / 月</span></div>' +
      trendSVG(data) +
      '<div class="trend-x">' + data.map(function (d, i) {
        var show = i % 3 === 0 || i === data.length - 1;
        return '<span>' + (show ? d.m + '月' : '') + '</span>';
      }).join('') + '</div></div>';

    /* 类型构成 */
    html += '<div class="chart-card"><div class="chart-head"><h3 class="chart-title">类型构成</h3>' +
      '<span class="chart-note">共 ' + total + ' 条</span></div>' +
      '<div class="donut-wrap">' + donutSVG(counts) +
      '<div class="legend">' + TYPE_KEYS.map(function (k) {
        var pct = total ? Math.round(counts[k] / total * 100) : 0;
        return '<div class="legend-row"><span class="legend-dot" style="background:var(--t-' + k + ')"></span>' +
          '<span class="legend-name">' + TYPES[k].label + '</span>' +
          '<span class="legend-val">' + counts[k] + ' 条 · ' + pct + '%</span></div>';
      }).join('') + '</div></div></div>';

    /* 打卡 */
    if (state.checkins.length) {
      var ck = checkinStats();
      html += '<div class="chart-card"><div class="chart-head"><h3 class="chart-title">打卡</h3>' +
        '<span class="chart-note">共 ' + ck.total + ' 天</span></div>' +
        '<div class="ckp-row">' +
        '<div><strong>' + ck.total + '</strong><span>累计天数</span></div>' +
        '<div><strong>' + ck.streak + '</strong><span>连续天数</span></div>' +
        '<div><strong>' + fmtHours(ck.minutes / 60) + '</strong><span>累计小时</span></div>' +
        '</div></div>';
    }

    /* 细分洞察 */
    html += insightHTML(recs);

    /* 报告 */
    html += reportSection();

    /* 更多回顾 */
    html += '<div class="more-row">' +
      '<button class="more-btn" data-action="go" data-to="quotes">' + icon('quote', 18) + '<span>摘抄库</span></button>' +
      '<button class="more-btn" data-action="go" data-to="authors">' + icon('user', 18) + '<span>创作者</span></button>' +
      '<button class="more-btn" data-action="go" data-to="archive">' + icon('archive', 18) + '<span>归档</span></button>' +
      '</div>';
    return html;
  }

  function insightHTML(recs) {
    var byType = {};
    recs.forEach(function (r) { byType[r.type] = (byType[r.type] || 0) + 1; });
    var topType = null, topN = 0;
    TYPE_KEYS.forEach(function (k) {
      if ((byType[k] || 0) > topN) { topN = byType[k]; topType = k; }
    });

    var best = recs.filter(function (r) { return r.rating > 0; })
      .sort(function (a, b) { return b.rating - a.rating; })[0];
    var repeat = recs.slice().sort(function (a, b) { return b.rewatches.length - a.rewatches.length; })[0];
    var longest = recs.slice().sort(function (a, b) { return (b.hours || 0) - (a.hours || 0); })[0];

    var rows = [];
    if (topType) rows.push(['最常消费类型', TYPES[topType].label, topN + ' 条']);
    if (best) rows.push(['评分最高作品', best.title, ratingText(best.rating) + (ratingScale() === 5 ? ' 星' : ' 分')]);
    if (repeat && repeat.rewatches.length) rows.push(['重刷最多', repeat.title, (1 + repeat.rewatches.length) + ' 次']);
    if (longest && longest.hours) rows.push(['投入最多', longest.title, fmtHours(longest.hours) + ' h']);

    if (!rows.length) return '';
    return '<div class="chart-card"><div class="chart-head"><h3 class="chart-title">细分洞察</h3>' +
      '<span class="chart-note">基于全部记录</span></div><div class="insight-list">' +
      rows.map(function (r) {
        return '<div class="insight-row"><span class="insight-k">' + esc(r[0]) + '</span>' +
          '<span class="insight-v">' + esc(r[1]) + '</span><span class="insight-n">' + esc(r[2]) + '</span></div>';
      }).join('') + '</div></div>';
  }

  function reportSection() {
    var rs = state.report;
    var years = createdYears();
    var curY = new Date().getFullYear();
    if (years.indexOf(String(curY)) < 0) years.unshift(String(curY));
    if (!rs.year) rs.year = curY;

    var html = '<div class="chart-card"><div class="chart-head"><h3 class="chart-title">生成一份报告</h3>' +
      '<span class="chart-note">可保存为图片</span></div>' +
      '<div class="report-form">' +
      '<select class="select" data-report="year">' + years.map(function (y) {
        return '<option value="' + y + '"' + (String(rs.year) === String(y) ? ' selected' : '') + '>' + y + ' 年</option>';
      }).join('') + '</select>' +
      '<select class="select" data-report="month">' +
      '<option value="all"' + (rs.month === 'all' ? ' selected' : '') + '>全年</option>' +
      Array.apply(null, { length: 12 }).map(function (_, i) {
        var m = i + 1;
        return '<option value="' + m + '"' + (String(rs.month) === String(m) ? ' selected' : '') + '>' + m + ' 月</option>';
      }).join('') + '</select>' +
      '<select class="select" data-report="type">' +
      '<option value="all"' + (rs.type === 'all' ? ' selected' : '') + '>全部类型</option>' +
      TYPE_KEYS.map(function (k) {
        return '<option value="' + k + '"' + (rs.type === k ? ' selected' : '') + '>' + TYPES[k].label + '</option>';
      }).join('') + '</select>' +
      '<button class="btn btn-primary btn-sm" data-action="gen-report">生成报告</button>' +
      '</div></div>';

    if (rs.data) {
      html += '<div class="report-wrap">' + reportCardHTML(rs.data);
      html += '<div class="poster-actions">' +
        '<button class="btn btn-ghost btn-sm" data-action="save-poster">' + icon('download', 15) + ' 保存图片</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="share-poster">' + icon('share', 15) + ' 分享</button>' +
        '</div></div>';
    }
    return html;
  }

  function buildReport(year, month, type) {
    var list = state.records.filter(function (r) {
      var d = new Date(r.createdAt);
      if (d.getFullYear() !== Number(year)) return false;
      if (month !== 'all' && d.getMonth() + 1 !== Number(month)) return false;
      if (type !== 'all' && r.type !== type) return false;
      return true;
    }).sort(function (a, b) { return a.createdAt - b.createdAt; });

    var done = list.filter(function (r) { return r.status === 'done'; });
    var hours = list.reduce(function (s, r) { return s + (r.hours || 0); }, 0);
    var rated = list.filter(function (r) { return r.rating > 0; });
    var avg = rated.length ? rated.reduce(function (s, r) { return s + r.rating; }, 0) / rated.length : 0;

    var counts = emptyTypeCounts();
    var tagMap = {};
    list.forEach(function (r) {
      if (counts[r.type] != null) counts[r.type]++;
      (r.tags || []).forEach(function (t) { tagMap[t] = (tagMap[t] || 0) + 1; });
    });
    var topTags = Object.keys(tagMap).map(function (k) { return [k, tagMap[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);

    var bestHours = list.slice().sort(function (a, b) { return (b.hours || 0) - (a.hours || 0); })[0];
    var bestRating = rated.slice().sort(function (a, b) { return b.rating - a.rating; })[0];
    var bestRepeat = list.slice().sort(function (a, b) { return b.rewatches.length - a.rewatches.length; })[0];

    var topType = null, topTypeN = 0;
    TYPE_KEYS.forEach(function (k) {
      if (counts[k] > topTypeN) { topTypeN = counts[k]; topType = k; }
    });

    return {
      year: Number(year),
      month: month,
      type: type,
      title: String(year) + (month === 'all' ? ' 年度' : ' 年 ' + month + ' 月'),
      count: list.length,
      done: done.length,
      hours: hours,
      avg: avg,
      counts: counts,
      topTags: topTags,
      topType: topType,
      topTypeN: topTypeN,
      bestHours: bestHours && bestHours.hours ? bestHours : null,
      bestRating: bestRating || null,
      bestRepeat: bestRepeat && bestRepeat.rewatches.length ? bestRepeat : null,
      types: type === 'all' ? '全部类型' : TYPES[type].label
    };
  }

  function reportCardHTML(d) {
    if (!d.count) {
      return '<div class="report" id="report-card"><div class="rp-top"><span>次元簿 · JIGEN</span><span>' + d.title + '</span></div>' +
        '<h2 class="rp-title">这段时间<br>还没有记录</h2>' +
        '<p class="rp-sub">换个年份或月份看看，或者现在去记录一条。</p></div>';
    }
    var maxType = Math.max.apply(null, TYPE_KEYS.map(function (k) { return d.counts[k]; })) || 1;
    var typeColors = {};
    TYPE_KEYS.forEach(function (k) { typeColors[k] = TYPES[k].color; });

    var bestRows = '';
    if (d.bestHours) {
      bestRows += '<li><span class="k">投入最多</span><span class="v">' + esc(d.bestHours.title) + '</span><span class="n">' + fmtHours(d.bestHours.hours) + ' h</span></li>';
    }
    if (d.bestRating) {
      bestRows += '<li><span class="k">评分最高</span><span class="v">' + esc(d.bestRating.title) + '</span><span class="n">' + ratingText(d.bestRating.rating) + '</span></li>';
    }
    if (d.bestRepeat) {
      bestRows += '<li><span class="k">刷得最多</span><span class="v">' + esc(d.bestRepeat.title) + '</span><span class="n">' + (1 + d.bestRepeat.rewatches.length) + ' 次</span></li>';
    }

    return '<div class="report" id="report-card">' +
      '<div class="rp-top"><span>次元簿 · JIGEN</span><span>' + esc(d.types) + '</span></div>' +
      '<h2 class="rp-title">' + d.year + '<br>' + (d.month === 'all' ? '年度报告' : Number(d.month) + ' 月小结') + '</h2>' +
      '<p class="rp-sub">' + (d.month === 'all' ? '这一年，' : '这个月，') + '你把时间交给了 ' + d.count + ' 个故事。</p>' +

      '<div class="rp-nums">' +
      '<div><strong>' + d.count + '</strong><span>收录</span></div>' +
      '<div><strong>' + d.done + '</strong><span>完成</span></div>' +
      '<div><strong>' + fmtHours(d.hours) + '</strong><span>小时</span></div>' +
      '<div><strong>' + ratingText(d.avg) + '</strong><span>均分</span></div>' +
      '</div>' +

      '<div class="rp-highlights">' +
      '<div class="rp-high"><span>' + (d.month === 'all' ? '年度' : '本月') + '最高分作品</span>' +
      '<strong>' + (d.bestRating ? esc(d.bestRating.title) : '—') + '</strong>' +
      '<em>' + (d.bestRating ? ratingText(d.bestRating.rating) + (ratingScale() === 5 ? ' 星' : ' 分') : '暂无评分') + '</em></div>' +
      '<div class="rp-high"><span>' + (d.month === 'all' ? '年度' : '本月') + '最常看类型</span>' +
      '<strong>' + (d.topType ? TYPES[d.topType].label : '—') + '</strong>' +
      '<em>' + (d.topType ? d.topTypeN + ' 条 · ' + Math.round(d.topTypeN / d.count * 100) + '%' : '暂无记录') + '</em></div>' +
      '</div>' +

      '<div class="rp-section"><h4>类型构成</h4><div class="rp-bars">' +
      TYPE_KEYS.map(function (k) {
        var n = d.counts[k];
        if (!n) return '';
        var w = Math.round(n / maxType * 100);
        return '<div class="rp-bar-row"><span class="rp-bar-name">' + TYPES[k].label + '</span>' +
          '<span class="rp-bar-track"><i class="rp-bar-fill" style="width:' + w + '%;background:' + typeColors[k] + '"></i></span>' +
          '<span class="rp-bar-val">' + n + '</span></div>';
      }).join('') +
      '</div></div>' +

      (d.topTags.length ? '<div class="rp-section"><h4>偏好标签</h4><div class="rp-tags">' +
        d.topTags.map(function (t) { return '<span class="rp-tag">' + esc(t[0]) + ' · ' + t[1] + '</span>'; }).join('') +
        '</div></div>' : '') +

      (bestRows ? '<div class="rp-section"><h4>' + (d.month === 'all' ? '年度之最' : '本月之最') + '</h4><ul class="rp-best">' + bestRows + '</ul></div>' : '') +

      '<div class="rp-foot"><span>记录于 ' + todayISO() + '</span><span>次元簿</span></div>' +
      '</div>';
  }

  /* ---------------- 海报导出 ---------------- */

  var h2cPromise = null;

  function loadHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    if (h2cPromise) return h2cPromise;
    h2cPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.onload = function () { window.html2canvas ? resolve(window.html2canvas) : reject(new Error('empty')); };
      s.onerror = function () { reject(new Error('network')); };
      document.head.appendChild(s);
      setTimeout(function () { if (!window.html2canvas) reject(new Error('timeout')); }, 6000);
    });
    return h2cPromise;
  }

  function drawPosterFallback(d) {
    var dark = document.documentElement.dataset.theme === 'dark';
    var W = 900, H = 1440;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');

    var bg = ctx.createLinearGradient(0, 0, W, H);
    if (dark) { bg.addColorStop(0, '#2B1B36'); bg.addColorStop(1, '#152238'); }
    else { bg.addColorStop(0, '#FFF3FA'); bg.addColorStop(1, '#E4F2FF'); }
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    var ink = dark ? '#F3EEFF' : '#2C2545';
    var sub = dark ? '#A79AC4' : '#6F628F';
    var accent = dark ? '#FF7AA8' : '#E8457A';
    var serif = '"Songti SC","STSong","SimSun",serif';
    var sans = '"PingFang SC","Microsoft YaHei",sans-serif';

    ctx.fillStyle = sub;
    ctx.font = '18px ' + sans;
    ctx.fillText('次元簿 · JIGEN', 70, 96);
    ctx.textAlign = 'right';
    ctx.fillText(d.types, W - 70, 96);
    ctx.textAlign = 'left';

    ctx.fillStyle = ink;
    ctx.font = '600 76px ' + serif;
    ctx.fillText(String(d.year), 70, 208);
    ctx.fillText(d.month === 'all' ? '年度报告' : Number(d.month) + ' 月小结', 70, 296);

    ctx.fillStyle = sub;
    ctx.font = '24px ' + sans;
    ctx.fillText((d.month === 'all' ? '这一年，' : '这个月，') + '你把时间交给了 ' + d.count + ' 个故事。', 70, 348);

    ctx.strokeStyle = dark ? 'rgba(200,180,255,.22)' : 'rgba(124,107,255,.22)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(70, 396); ctx.lineTo(W - 70, 396); ctx.stroke();

    var nums = [[d.count, '收录'], [d.done, '完成'], [fmtHours(d.hours), '小时'], [ratingText(d.avg), '均分']];
    nums.forEach(function (n, i) {
      var x = 70 + i * ((W - 140) / 4);
      ctx.fillStyle = accent;
      ctx.font = '600 60px ' + serif;
      ctx.fillText(String(n[0]), x, 486);
      ctx.fillStyle = sub;
      ctx.font = '20px ' + sans;
      ctx.fillText(n[1], x, 520);
    });

    var y = 600;
    ctx.fillStyle = sub;
    ctx.font = '18px ' + sans;
    ctx.fillText('类型构成', 70, y);
    y += 34;
    var maxType = Math.max.apply(null, TYPE_KEYS.map(function (k) { return d.counts[k]; })) || 1;
    var colors = {};
    TYPE_KEYS.forEach(function (k) { colors[k] = TYPES[k].color; });
    TYPE_KEYS.forEach(function (k) {
      if (!d.counts[k]) return;
      ctx.fillStyle = ink;
      ctx.font = '22px ' + sans;
      ctx.fillText(TYPES[k].label, 70, y + 14);
      var tw = W - 70 - 70 - 220;
      ctx.fillStyle = dark ? 'rgba(200,180,255,.16)' : 'rgba(124,107,255,.14)';
      roundRect(ctx, 190, y, tw, 10, 5); ctx.fill();
      ctx.fillStyle = colors[k];
      roundRect(ctx, 190, y, Math.max(10, tw * d.counts[k] / maxType), 10, 5); ctx.fill();
      ctx.fillStyle = sub;
      ctx.font = '20px ' + sans;
      ctx.fillText(String(d.counts[k]), W - 70 - 30, y + 14);
      y += 48;
    });

    y += 26;
    if (d.topTags.length) {
      ctx.fillStyle = sub;
      ctx.font = '18px ' + sans;
      ctx.fillText('偏好标签', 70, y);
      y += 36;
      ctx.font = '22px ' + sans;
      var x = 70;
      d.topTags.forEach(function (t) {
        var label = t[0] + ' · ' + t[1];
        var w = ctx.measureText(label).width + 40;
        if (x + w > W - 70) { x = 70; y += 52; }
        ctx.strokeStyle = dark ? 'rgba(200,180,255,.3)' : 'rgba(124,107,255,.28)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, x, y - 24, w, 40, 20); ctx.stroke();
        ctx.fillStyle = ink;
        ctx.fillText(label, x + 20, y + 3);
        x += w + 12;
      });
      y += 60;
    }

    var best = [];
    if (d.bestHours) best.push(['投入最多', d.bestHours.title, fmtHours(d.bestHours.hours) + ' h']);
    if (d.bestRating) best.push(['评分最高', d.bestRating.title, ratingText(d.bestRating.rating)]);
    if (d.bestRepeat) best.push(['刷得最多', d.bestRepeat.title, (1 + d.bestRepeat.rewatches.length) + ' 次']);
    if (best.length) {
      ctx.fillStyle = sub;
      ctx.font = '18px ' + sans;
      ctx.fillText(d.month === 'all' ? '年度之最' : '本月之最', 70, y);
      y += 40;
      best.forEach(function (b) {
        ctx.fillStyle = sub;
        ctx.font = '20px ' + sans;
        ctx.fillText(b[0], 70, y);
        ctx.fillStyle = ink;
        ctx.font = '600 24px ' + sans;
        ctx.fillText(b[1], 210, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = sub;
        ctx.font = '20px ' + sans;
        ctx.fillText(b[2], W - 70, y);
        ctx.textAlign = 'left';
        y += 46;
      });
    }

    ctx.fillStyle = sub;
    ctx.font = '18px ' + sans;
    ctx.fillText('记录于 ' + todayISO(), 70, H - 70);
    ctx.textAlign = 'right';
    ctx.fillText('次元簿', W - 70, H - 70);
    ctx.textAlign = 'left';

    return c;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function makePosterCanvas() {
    var card = document.getElementById('report-card');
    if (!card || !state.report.data) return Promise.reject(new Error('no report'));
    return loadHtml2Canvas().then(function (h2c) {
      return h2c(card, { scale: 2, backgroundColor: null, useCORS: true, logging: false });
    }).catch(function () {
      return drawPosterFallback(state.report.data);
    });
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      a.remove();
    }, 800);
  }

  function posterName() {
    var d = state.report.data;
    return 'shilu-' + d.year + (d.month === 'all' ? '-year' : '-' + pad(Number(d.month))) + '-' + todayISO() + '.png';
  }

  function savePoster() {
    toast('正在生成图片…');
    makePosterCanvas().then(function (canvas) {
      canvas.toBlob(function (blob) {
        if (!blob) { toast('生成失败，请重试'); return; }
        downloadBlob(blob, posterName());
        toast('图片已保存');
      }, 'image/png');
    }).catch(function () {
      toast('生成失败，请重试');
    });
  }

  function sharePoster() {
    toast('正在生成图片…');
    makePosterCanvas().then(function (canvas) {
      canvas.toBlob(function (blob) {
        if (!blob) { toast('生成失败，请重试'); return; }
        var file = new File([blob], posterName(), { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
          navigator.share({ files: [file], title: '我的文娱报告' }).catch(function () { });
        } else {
          downloadBlob(blob, posterName());
          toast('当前设备不支持直接分享，已保存图片');
        }
      }, 'image/png');
    }).catch(function () {
      toast('生成失败，请重试');
    });
  }

  /* ---------------- 追更日历（.ics） ---------------- */

  var WEEK_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function icsEscape(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  function foldICS(line) {
    var chars = Array.from(String(line));
    var encoder = new TextEncoder();
    var parts = [];
    var cur = '';
    var bytes = 0;
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      var b = encoder.encode(ch).length;
      if (bytes + b > 70 && cur) {
        parts.push(cur);
        cur = ' ';
        bytes = 1;
      }
      cur += ch;
      bytes += b;
    }
    parts.push(cur);
    return parts.join('\r\n');
  }

  function icsLocal(d) {
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' +
      pad(d.getHours()) + pad(d.getMinutes()) + '00';
  }

  function icsUTC(d) {
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' +
      pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
  }

  function nextWeekday(day, hour) {
    var now = new Date();
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour || 20, 0, 0, 0);
    var diff = (Number(day) - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 7);
    return d;
  }

  function buildICS(records) {
    var tz = 'Asia/Shanghai';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (e) { /* ignore */ }

    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ShiLu//ZhuiGeng//CN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:' + icsEscape('次元簿 · 追更提醒'),
      'X-WR-TIMEZONE:' + tz
    ];

    records.forEach(function (r) {
      var start = nextWeekday(r.updateDay, 20);
      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + r.id + '@shilu.local');
      lines.push('DTSTAMP:' + icsUTC(new Date()));
      lines.push('DTSTART:' + icsLocal(start));
      lines.push('DURATION:PT30M');
      lines.push('RRULE:FREQ=WEEKLY;COUNT=52');
      lines.push('SUMMARY:' + icsEscape(TYPES[r.type].label + '《' + r.title + '》更新'));
      lines.push('DESCRIPTION:' + icsEscape('次元簿 · 每' + WEEK_NAMES[r.updateDay] + '追更提醒'));
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-PT30M');
      lines.push('ACTION:DISPLAY');
      lines.push('DESCRIPTION:' + icsEscape('《' + r.title + '》今天更新'));
      lines.push('END:VALARM');
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');
    return lines.map(foldICS).join('\r\n') + '\r\n';
  }

  function openIcsModal() {
    var list = state.records.filter(function (r) { return r.status === 'doing'; });
    if (!list.length) {
      toast('还没有正在进行的作品');
      return;
    }

    var sel = {};
    list.forEach(function (r) {
      sel[r.id] = { on: r.updateDay >= 0, day: r.updateDay >= 0 ? r.updateDay : 5 };
    });

    var body = '<div class="ics-list">' + list.map(function (r) {
      return '<div class="ics-row">' +
        '<label class="ics-check"><input type="checkbox" data-ics-pick="' + r.id + '"' + (sel[r.id].on ? ' checked' : '') + '>' +
        '<span class="ics-title">' + esc(r.title) + '</span></label>' +
        '<select class="select" data-ics-day="' + r.id + '">' +
        WEEK_NAMES.map(function (n, i) {
          return '<option value="' + i + '"' + (sel[r.id].day === i ? ' selected' : '') + '>每' + n + '</option>';
        }).join('') + '</select>' +
        '</div>';
    }).join('') + '</div>' +
      '<p class="hint">选中后会在每周选定日的 20:00 提醒，共 52 周；导入系统日历即可离线收到通知。</p>';

    openModal({
      title: '生成追更日历',
      desc: '把正在追的作品导出为 .ics 文件，导入手机或电脑日历。',
      body: body,
      actions: [
        { label: '取消', value: null, variant: 'ghost' },
        { label: '生成 .ics', value: 'ok', variant: 'primary' }
      ]
    }).then(function (v) {
      if (v !== 'ok') return;
      var picked = [];
      list.forEach(function (r) {
        if (!sel[r.id].on) return;
        r.updateDay = sel[r.id].day;
        r.updatedAt = Date.now();
        picked.push(r);
      });
      if (!picked.length) { toast('请至少选择一条记录'); return; }
      save();
      var blob = new Blob([buildICS(picked)], { type: 'text/calendar;charset=utf-8' });
      downloadBlob(blob, 'shilu-updates-' + todayISO() + '.ics');
      toast('已生成 ' + picked.length + ' 个追更提醒');
      render({ keepScroll: true });
    });

    var root = document.getElementById('modal-root');
    root.querySelectorAll('[data-ics-pick]').forEach(function (el) {
      el.addEventListener('change', function () { sel[el.dataset.icsPick].on = el.checked; });
    });
    root.querySelectorAll('[data-ics-day]').forEach(function (el) {
      el.addEventListener('change', function () { sel[el.dataset.icsDay].day = Number(el.value); });
    });
  }

  /* ---------------- 摘抄库 ---------------- */

  function allQuotes() {
    var out = [];
    state.records.forEach(function (r) {
      (r.quotes || []).forEach(function (q) {
        out.push({ r: r, q: q });
      });
    });
    return out;
  }

  function quotesView() {
    var all = allQuotes();
    var type = state.ui.quoteType || 'all';

    var list = all.filter(function (x) {
      return type === 'all' || x.r.type === type;
    });

    var html = '<header class="page-head">' +
      '<div><p class="eyebrow">共 ' + all.length + ' 条摘抄</p><h1 class="page-title">摘抄库</h1></div>' +
      '<div class="head-actions"><button class="icon-btn" data-action="settings" aria-label="设置">' + icon('gear', 20) + '</button></div>' +
      '</header>';

    if (!all.length) {
      return html + '<div class="empty"><div class="empty-mark">“</div>' +
        '<p class="empty-title">还没有摘抄</p>' +
        '<p class="empty-text">在任意一条记录的编辑页里，把喜欢的句子抄下来。</p>' +
        '<button class="btn btn-ghost btn-sm" data-action="back-home">回总览</button></div>';
    }

    var types = [];
    all.forEach(function (x) { if (types.indexOf(x.r.type) < 0) types.push(x.r.type); });
    types.sort(function (a, b) { return TYPE_KEYS.indexOf(a) - TYPE_KEYS.indexOf(b); });

    html += '<div class="seg">' +
      '<button data-action="quote-type" data-value="all" class="' + (type === 'all' ? 'is-active' : '') + '">全部</button>' +
      types.map(function (k) {
        return '<button data-action="quote-type" data-value="' + k + '" class="' + (type === k ? 'is-active' : '') + '">' + TYPES[k].label + '</button>';
      }).join('') + '</div>';

    html += '<div class="search search-flat">' + icon('search', 17) +
      '<input id="quote-search" type="search" placeholder="搜摘抄内容、书名、页码" autocomplete="off" value="' + esc(state.ui.quoteQ || '') + '">' +
      '<button class="search-clear" data-action="clear-quote-search" aria-label="清空搜索">' + icon('close', 15) + '</button>' +
      '</div>';

    html += '<div class="quote-count" id="quote-count">' + list.length + ' 条' +
      (list.length !== all.length ? '（共 ' + all.length + '）' : '') + '</div>';

    if (!list.length) {
      html += '<div class="empty"><div class="empty-mark">·</div>' +
        '<p class="empty-title">没有匹配的摘抄</p>' +
        '<p class="empty-text">换个关键词，或切到「全部」。</p></div>';
    } else {
      html += '<div class="qlist">' + list.map(function (x) {
        return '<div class="qcard" data-action="open" data-id="' + x.r.id + '" role="button" tabindex="0" data-hay="' +
          esc((x.q.text + ' ' + (x.q.page || '') + ' ' + x.r.title + ' ' + x.r.creator).toLowerCase()) + '">' +
          '<p class="qcard-text">' + esc(x.q.text) + '</p>' +
          '<div class="qcard-foot">' +
          '<span class="qcard-src">' + esc(x.r.title) + '</span>' +
          (x.q.page ? '<span class="qcard-page">' + esc(x.q.page) + '</span>' : '') +
          '<span class="qcard-type">' + TYPES[x.r.type].label + '</span>' +
          '</div></div>';
      }).join('') + '</div>' +
        '<div id="quote-empty" class="empty hidden"><div class="empty-mark">·</div>' +
        '<p class="empty-title">没有匹配的摘抄</p>' +
        '<p class="empty-text">换个关键词试试。</p></div>';
    }

    return html;
  }

  /* ---------------- 创作者 ---------------- */

  function authorsView() {
    var map = {};
    state.records.forEach(function (r) {
      var name = String(r.creator || '').trim();
      if (!name) return;
      (map[name] = map[name] || { name: name, list: [] }).list.push(r);
    });
    var groups = Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.list.length - a.list.length || a.name.localeCompare(b.name); });

    var html = '<header class="page-head">' +
      '<div><p class="eyebrow">' + groups.length + ' 位创作者</p><h1 class="page-title">创作者</h1></div>' +
      '<div class="head-actions"><button class="icon-btn" data-action="settings" aria-label="设置">' + icon('gear', 20) + '</button></div>' +
      '</header>';

    if (!groups.length) {
      return html + '<div class="empty"><div class="empty-mark">·</div>' +
        '<p class="empty-title">还没有填创作者</p>' +
        '<p class="empty-text">在记录里填上作者、导演或制作方，这里会自动聚合。</p></div>';
    }

    html += '<div class="auth-list">' + groups.map(function (g) {
      var rated = g.list.filter(function (r) { return r.rating > 0; });
      var avg = rated.length ? rated.reduce(function (sum, r) { return sum + r.rating; }, 0) / rated.length : 0;
      var hours = g.list.reduce(function (sum, r) { return sum + (r.hours || 0); }, 0);
      var doneN = g.list.filter(function (r) { return r.status === 'done'; }).length;
      var isOpen = state.authors.open === g.name;

      return '<div class="auth-card' + (isOpen ? ' is-open' : '') + '">' +
        '<button class="auth-head" data-action="author-toggle" data-name="' + esc(g.name) + '">' +
        '<span class="auth-avatar" style="--cc:' + coverColor(g.name) + '">' + esc(firstChar(g.name)) + '</span>' +
        '<span class="auth-main">' +
        '<span class="auth-name">' + esc(g.name) + '</span>' +
        '<span class="auth-meta">' + g.list.length + ' 条 · 完成 ' + doneN +
        (avg ? ' · 均分 ' + ratingText(avg) : '') +
        (hours ? ' · ' + fmtHours(hours) + ' 小时' : '') + '</span>' +
        '</span>' +
        '<span class="auth-arrow">' + icon('chevron', 15) + '</span>' +
        '</button>' +
        (isOpen
          ? '<div class="auth-body">' + g.list.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; }).map(function (r) {
            return '<div class="auth-item" data-action="open" data-id="' + r.id + '" role="button" tabindex="0">' +
              '<span class="auth-item-title">' + esc(r.title) + '</span>' +
              '<span class="auth-item-meta">' + TYPES[r.type].label + ' · ' + STATUSES[r.status] +
              (r.rating ? ' · ' + ratingText(r.rating) : '') + '</span>' +
              '</div>';
          }).join('') + '</div>'
          : '') +
        '</div>';
    }).join('') + '</div>';

    return html;
  }

  /* ---------------- 归档 / 年度档案 ---------------- */

  function archiveYears() {
    var map = {};
    state.records.forEach(function (r) {
      var y = String(new Date(r.createdAt).getFullYear());
      map[y] = (map[y] || 0) + 1;
    });
    return Object.keys(map).sort().reverse().map(function (y) { return { year: y, count: map[y] }; });
  }

  function archiveView() {
    var years = archiveYears();
    var year = String(state.archive.year || 'all');
    if (year !== 'all' && years.map(function (x) { return x.year; }).indexOf(year) < 0) year = 'all';

    var html = '<header class="page-head">' +
      '<div><p class="eyebrow">按年归档</p><h1 class="page-title">' + (year === 'all' ? '归档' : year + ' 年档案') + '</h1></div>' +
      '<div class="head-actions"><button class="icon-btn" data-action="settings" aria-label="设置">' + icon('gear', 20) + '</button></div>' +
      '</header>';

    if (!years.length) {
      return html + '<div class="empty"><div class="empty-mark">·</div>' +
        '<p class="empty-title">还没有可归档的内容</p>' +
        '<p class="empty-text">记录几条之后，这里会按年份整理。</p></div>';
    }

    html += '<div class="seg">' +
      '<button data-action="archive-year" data-value="all" class="' + (year === 'all' ? 'is-active' : '') + '">全部</button>' +
      years.map(function (x) {
        return '<button data-action="archive-year" data-value="' + x.year + '" class="' + (year === x.year ? 'is-active' : '') + '">' + x.year + '</button>';
      }).join('') + '</div>';

    if (year === 'all') {
      html += '<div class="year-list">' + years.map(function (x) {
        var recs = state.records.filter(function (r) { return String(new Date(r.createdAt).getFullYear()) === x.year; });
        var doneN = recs.filter(function (r) { return r.status === 'done'; }).length;
        var hours = recs.reduce(function (sum, r) { return sum + (r.hours || 0); }, 0);
        var typeSet = [];
        recs.forEach(function (r) { if (typeSet.indexOf(r.type) < 0) typeSet.push(r.type); });
        typeSet.sort(function (a, b) { return TYPE_KEYS.indexOf(a) - TYPE_KEYS.indexOf(b); });

        return '<div class="year-card" data-action="archive-year" data-value="' + x.year + '" role="button" tabindex="0">' +
          '<div class="year-num">' + x.year + '</div>' +
          '<div class="year-body">' +
          '<div class="year-line"><b>' + recs.length + '</b> 条 · 完成 <b>' + doneN + '</b>' +
          (hours ? ' · ' + fmtHours(hours) + ' 小时' : '') + '</div>' +
          '<div class="year-types">' + typeSet.map(function (k) {
            return '<span class="year-type">' + TYPES[k].label + '</span>';
          }).join('') + '</div>' +
          '</div>' +
          '<span class="auth-arrow">' + icon('chevron', 15) + '</span>' +
          '</div>';
      }).join('') + '</div>';
      return html;
    }

    var recs = state.records.filter(function (r) { return String(new Date(r.createdAt).getFullYear()) === year; });
    var doneN = recs.filter(function (r) { return r.status === 'done'; }).length;
    var hours = recs.reduce(function (sum, r) { return sum + (r.hours || 0); }, 0);
    var rated = recs.filter(function (r) { return r.rating > 0; });
    var avg = rated.length ? rated.reduce(function (sum, r) { return sum + r.rating; }, 0) / rated.length : 0;
    var quoteN = recs.reduce(function (sum, r) { return sum + (r.quotes || []).length; }, 0);
    var noteN = recs.reduce(function (sum, r) { return sum + (r.notesLog || []).length; }, 0);
    var checkinN = state.checkins.filter(function (c) { return c.date.indexOf(year) === 0; }).length;
    var rate = recs.length ? Math.round(doneN / recs.length * 100) : 0;

    html += '<div class="arch-grid">' +
      '<div><strong>' + recs.length + '</strong><span>收录</span></div>' +
      '<div><strong>' + doneN + '</strong><span>完成</span></div>' +
      '<div><strong>' + rate + '%</strong><span>完成率</span></div>' +
      '<div><strong>' + fmtHours(hours) + '</strong><span>小时</span></div>' +
      '<div><strong>' + ratingText(avg) + '</strong><span>均分</span></div>' +
      '<div><strong>' + quoteN + '</strong><span>摘抄</span></div>' +
      '<div><strong>' + noteN + '</strong><span>笔记</span></div>' +
      '<div><strong>' + checkinN + '</strong><span>打卡</span></div>' +
      '</div>';

    TYPE_KEYS.forEach(function (k) {
      var group = recs.filter(function (r) { return r.type === k; });
      if (!group.length) return;
      html += '<section class="section"><div class="section-head">' +
        '<h2 class="section-title">' + TYPES[k].label + '</h2>' +
        '<span class="section-note">' + group.length + ' 条</span></div>' +
        '<div class="arch-list">' + group.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; }).map(function (r) {
          return '<div class="arch-item" data-action="open" data-id="' + r.id + '" role="button" tabindex="0">' +
            '<span class="arch-cover" style="--cc:' + coverColor(r.title) + '">' + esc(firstChar(r.title)) + '</span>' +
            '<span class="arch-main">' +
            '<span class="arch-title">' + esc(r.title) + '</span>' +
            '<span class="arch-meta">' + esc(progressText(r)) + (r.rating ? ' · ' + ratingText(r.rating) : '') + '</span>' +
            '</span>' +
            '<span class="chip" data-s="' + r.status + '">' + STATUSES[r.status] + '</span>' +
            '</div>';
        }).join('') + '</div></section>';
    });

    return html;
  }

  /* ---------------- 设置 ---------------- */

  function settingsView() {
    var theme = state.prefs.theme;
    var tags = tagCounts();
    var last = state.prefs.lastExportAt;

    var html = '<div class="narrow">';
    html += pageHead('数据与偏好 · v' + APP_VERSION, '设置');

    /* 外观 */
    html += '<div class="set-group"><h2>外观</h2>' +
      '<div class="theme-seg">' +
      [['light', '浅色'], ['dark', '深色'], ['system', '跟随系统']].map(function (t) {
        return '<button data-action="theme" data-value="' + t[0] + '" class="' + (theme === t[0] ? 'is-active' : '') + '">' + t[1] + '</button>';
      }).join('') +
      '</div>' +
      '<div class="set-label" style="margin:16px 0 8px">评分制</div>' +
      '<div class="scale-seg">' +
      '<button data-action="rating-scale" data-value="10" class="' + (state.prefs.ratingScale !== '5' ? 'is-active' : '') + '">10 分制</button>' +
      '<button data-action="rating-scale" data-value="5" class="' + (state.prefs.ratingScale === '5' ? 'is-active' : '') + '">5 星制（半星）</button>' +
      '</div></div>';

    /* 浏览 */
    html += '<div class="set-group"><h2>浏览</h2>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">摘抄库</div>' +
      '<div class="set-desc">所有记录里的摘抄汇总在一处</div>' +
      '</div><button class="btn btn-ghost btn-sm" data-action="go" data-to="quotes">打开</button></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">创作者</div>' +
      '<div class="set-desc">按作者 / 导演聚合，看谁的作品最多</div>' +
      '</div><button class="btn btn-ghost btn-sm" data-action="go" data-to="authors">打开</button></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">归档</div>' +
      '<div class="set-desc">按年份回顾，含完成率、摘抄数、打卡天数</div>' +
      '</div><button class="btn btn-ghost btn-sm" data-action="go" data-to="archive">打开</button></div>' +
      '</div>';

    /* 年度目标 */
    var gc = Number(state.prefs.goalCount) || 0;
    var gh = Number(state.prefs.goalHours) || 0;
    html += '<div class="set-group"><h2>年度目标</h2>' +
      '<p class="muted" style="margin:0 0 10px">填 0 表示不设目标。达成情况会显示在总览页。</p>' +
      '<div class="row2">' +
      '<label class="field"><span class="field-label">今年想记录多少条</span>' +
      '<input class="input" type="number" min="0" max="9999" id="goal-count" value="' + (gc || '') + '" placeholder="30"></label>' +
      '<label class="field"><span class="field-label">今年想投入多少小时</span>' +
      '<input class="input" type="number" min="0" max="99999" id="goal-hours" value="' + (gh || '') + '" placeholder="100"></label>' +
      '</div></div>';

    /* 备份 */
    html += '<div class="set-group"><h2>备份与恢复</h2>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">导出全部数据</div>' +
      '<div class="set-desc">' + (last ? '上次备份：' + ymd(new Date(last)) : '还没有备份过') + ' · 共 ' + state.records.length + ' 条</div>' +
      '</div><div class="set-actions">' +
      '<button class="btn btn-primary btn-sm" data-action="export">JSON</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="export-csv">CSV</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="export-md">Markdown</button>' +
      '</div></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">从 JSON 文件导入</div>' +
      '<div class="set-desc">支持覆盖或合并，合并时按 id 去重</div>' +
      '</div><button class="btn btn-ghost btn-sm" data-action="import">选择文件</button></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">从 CSV 文件导入</div>' +
      '<div class="set-desc">支持 Letterboxd / Goodreads / Trakt / 本应用导出的 CSV</div>' +
      '</div><button class="btn btn-ghost btn-sm" data-action="import-csv">选择文件</button></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">从文本批量导入</div>' +
      '<div class="set-desc">粘贴豆瓣 / Bangumi 条目文本或 JSON，一次生成多条</div>' +
      '</div><button class="btn btn-ghost btn-sm" data-action="bulk-import">粘贴导入</button></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">跨设备同步</div>' +
      '<div class="set-desc">导出后在另一台设备导入即可，数据不经过任何服务器</div>' +
      '</div></div>' +
      '</div>';

    /* 日历提醒 */
    html += '<div class="set-group"><h2>日历提醒</h2>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">追更日历（.ics）</div>' +
      '<div class="set-desc">按作品的更新日导出日历事件，导入系统日历后每周提醒</div>' +
      '</div><button class="btn btn-ghost btn-sm" data-action="ics">生成</button></div>' +
      '</div>';

    /* 安装到桌面 */
    if (!isStandalone()) {
      html += '<div class="set-group"><h2>安装</h2>' +
        '<div class="set-row"><div class="set-row-main">' +
        '<div class="set-label">添加到主屏幕</div>' +
        '<div class="set-desc">像原生 App 一样全屏打开，断网也能查看和记录</div>' +
        '</div><button class="btn btn-ghost btn-sm" data-action="install">安装</button></div>' +
        '</div>';
    }

    /* 标签管理 */
    html += '<div class="set-group"><h2>题材标签</h2>';
    if (!tags.length) {
      html += '<p class="muted" style="margin:4px 0 8px">还没有标签，记录时选几个试试。</p>';
    } else {
      html += tags.map(function (t) {
        return '<div class="tag-row"><span class="tag-name">' + esc(t[0]) + '</span>' +
          '<span class="tag-count">' + t[1] + ' 条</span>' +
          '<span class="tag-ops">' +
          '<button class="mini-btn" data-action="tag-rename" data-tag="' + esc(t[0]) + '">重命名</button>' +
          '<button class="mini-btn" data-action="tag-merge" data-tag="' + esc(t[0]) + '">合并</button>' +
          '<button class="mini-btn danger" data-action="tag-delete" data-tag="' + esc(t[0]) + '">删除</button>' +
          '</span></div>';
      }).join('');
    }
    html += '</div>';

    /* 分类管理 */
    html += '<div class="set-group"><h2>分类</h2>' +
      '<p class="muted" style="margin:0 0 10px">和题材标签分开：分类更粗（小说 / 散文 / 理财…），标签更细。</p>';
    if (!state.categories.length) {
      html += '<p class="muted" style="margin:4px 0 8px">还没有分类。</p>';
    } else {
      html += state.categories.map(function (c) {
        var n = state.records.filter(function (r) { return r.category === c; }).length;
        return '<div class="tag-row"><span class="tag-name">' + esc(c) + '</span>' +
          '<span class="tag-count">' + n + ' 条</span>' +
          '<span class="tag-ops">' +
          '<button class="mini-btn" data-action="cat-rename" data-cat="' + esc(c) + '">重命名</button>' +
          '<button class="mini-btn danger" data-action="cat-delete" data-cat="' + esc(c) + '">删除</button>' +
          '</span></div>';
      }).join('');
    }
    html += '<button class="btn btn-ghost btn-sm" data-action="cat-add" style="margin-top:10px">＋ 新建分类</button>' +
      '</div>';

    /* 其他 */
    html += '<div class="set-group"><h2>其他</h2>' +
      '<div class="set-row"><div class="set-row-main"><div class="set-label">按年份补全发布日期</div>' +
      '<div class="set-desc">给只有年份的作品补一个 1 月 1 日，便于按上映状态筛选</div></div>' +
      '<button class="btn btn-ghost btn-sm" data-action="backfill-date">补全</button></div>' +
      '<div class="set-row"><div class="set-row-main"><div class="set-label">示例数据</div>' +
      '<div class="set-desc">填充几条演示记录，随时可以删掉</div></div>' +
      '<button class="btn btn-ghost btn-sm" data-action="seed-demo">填充</button></div>' +
      '<div class="set-row"><div class="set-row-main"><div class="set-label">清空全部数据</div>' +
      '<div class="set-desc">不可恢复，建议先导出一份备份</div></div>' +
      '<button class="btn btn-ghost btn-sm" data-action="clear-all">清空</button></div>' +
      '</div>';

    /* 关于 */
    html += '<div class="set-group"><h2>关于</h2>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">当前版本</div>' +
      '<div class="set-desc">页面 <b>v' + APP_VERSION + '</b> · 缓存 <b>' + SW_VERSION + '</b>' +
      ' · 服务器 <b id="srv-ver">检测中…</b></div>' +
      '</div><button class="btn btn-ghost btn-sm" data-action="check-update">检查更新</button></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">存储占用</div>' +
      '<div class="set-desc"><b id="stor-info">读取中…</b>（已用 / 本机可用配额）</div>' +
      '</div></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">记录容量</div>' +
      '<div class="set-desc"><b id="stor-cap">读取中…</b>（已用 / 本机可用）</div>' +
      '</div></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">看不到更新时</div>' +
      '<div class="set-desc">点「检查更新」；仍然不行就删掉主屏幕图标，用 Safari 重新打开一次再添加</div>' +
      '</div></div>' +
      '</div>';

    html += '<p class="muted" style="text-align:center;margin:24px 0 8px">次元簿 v' + APP_VERSION + ' · 数据只保存在这台设备的浏览器里</p>';
    html += '</div>';
    return html;
  }

  /* ---------------- 导入 / 导出 ---------------- */

  function exportJSON() {
    var payload = {
      schemaVersion: SCHEMA_VERSION,
      app: '次元簿',
      exportedAt: new Date().toISOString(),
      count: state.records.length,
      records: state.records,
      lists: state.lists,
      checkins: state.checkins,
      categories: state.categories
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var name = 'iread-backup-' + todayISO() + '.json';
    downloadBlob(blob, name);
    state.prefs.lastExportAt = Date.now();
    savePrefs();
    toast('已导出 ' + state.records.length + ' 条记录');
    if (state.route.name === 'settings') render({ keepScroll: true });
  }

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function fmtDateTime(ts) {
    var d = new Date(ts);
    return ymd(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function buildCSV() {
    var rows = [['id', '类型', '标题', '原名', '别名', '创作者', '年份', '分类', '题材', '评分', '豆瓣评分', '推荐指数', '状态', '进度', '刊期',
      '投入小时', '消费次数', '短评', '金句', '笔记数', '封面链接', '发布日期', '开始日期', '完成日期', '收录时间', '更新时间']];
    state.records.forEach(function (r) {
      rows.push([
        r.id,
        TYPES[r.type].label,
        r.title,
        r.originalTitle,
        (r.aliases || []).join(' / '),
        r.creator,
        r.year,
        r.category || '',
        (r.tags || []).join(' / '),
        r.rating ? ratingText(r.rating) : '',
        r.douban ? r.douban.toFixed(1) : '',
        r.recommend ? (RECOMMEND_LEVELS.filter(function (x) { return x.key === r.recommend; })[0] || {}).label || '' : '',
        STATUSES[r.status],
        progressText(r),
        r.type === 'magazine' ? magazineIssueText(r) : '',
        r.hours || '',
        1 + r.rewatches.length,
        r.review,
        (r.quotes || []).map(function (q) { return q.text; }).join(' / '),
        (r.notesLog || []).length || '',
        r.cover,
        r.releaseDate,
        r.startedAt || '',
        r.finishedAt || '',
        fmtDateTime(r.createdAt),
        fmtDateTime(r.updatedAt)
      ]);
    });
    return rows.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
  }

  function mdEscape(v) {
    return String(v == null ? '' : v).replace(/\r?\n/g, '  \n');
  }

  function buildMarkdown() {
    var out = [];
    var now = new Date();
    out.push('# 次元簿 · 我的文娱档案');
    out.push('');
    out.push('> 导出时间：' + fmtDateTime(now.getTime()) + '　共 ' + state.records.length + ' 条记录');
    out.push('');

    TYPE_KEYS.forEach(function (k) {
      var list = state.records.filter(function (r) { return r.type === k; })
        .sort(function (a, b) { return b.updatedAt - a.updatedAt; });
      if (!list.length) return;

      out.push('## ' + TYPES[k].label + '（' + list.length + '）');
      out.push('');

      list.forEach(function (r) {
        var line = '### ' + mdEscape(r.title);
        if (r.year) line += '（' + r.year + '）';
        out.push(line);
        out.push('');

        var facts = [];
        if (r.creator) facts.push('**' + TYPES[r.type].creator + '**：' + mdEscape(r.creator));
        if (r.originalTitle) facts.push('**原名**：' + mdEscape(r.originalTitle));
        if (r.aliases && r.aliases.length) facts.push('**别名**：' + mdEscape(r.aliases.join('、')));
        if (r.category) facts.push('**分类**：' + mdEscape(r.category));
        if (r.tags && r.tags.length) facts.push('**标签**：' + mdEscape(r.tags.join('、')));
        facts.push('**状态**：' + STATUSES[r.status]);
        if (r.rating) facts.push('**我的评分**：' + ratingText(r.rating));
        if (r.douban) facts.push('**豆瓣**：' + r.douban.toFixed(1));
        if (r.recommend) {
          var lv = RECOMMEND_LEVELS.filter(function (x) { return x.key === r.recommend; })[0];
          if (lv) facts.push('**推荐**：' + lv.label);
        }
        facts.push('**进度**：' + progressText(r));
        if (r.hours) facts.push('**投入**：' + fmtHours(r.hours) + ' 小时');
        if (r.startedAt) facts.push('**开始**：' + r.startedAt);
        if (r.finishedAt) facts.push('**完成**：' + r.finishedAt);
        if (r.releaseDate) facts.push('**发布**：' + r.releaseDate);
        out.push(facts.join('　·　'));
        out.push('');

        if (r.review) {
          out.push('**短评**');
          out.push('');
          out.push(mdEscape(r.review));
          out.push('');
        }

        SECTION_KEYS.forEach(function (sec) {
          var v = (r.sections || {})[sec.key];
          if (!v) return;
          out.push('**' + sec.label + '**');
          out.push('');
          out.push(mdEscape(v));
          out.push('');
        });

        (r.notesLog || []).forEach(function (n) {
          out.push('**笔记 · ' + n.date + '**');
          out.push('');
          out.push(mdEscape(n.text));
          out.push('');
        });

        if (r.quotes && r.quotes.length) {
          out.push('**摘抄**');
          out.push('');
          r.quotes.forEach(function (q) {
            out.push('> ' + mdEscape(q.text) + (q.page ? '　—— ' + mdEscape(q.page) : ''));
            out.push('>');
          });
          out.push('');
        }

        out.push('---');
        out.push('');
      });
    });

    return out.join('\n');
  }

  function exportMarkdown() {
    if (!state.records.length) { toast('还没有记录可以导出'); return; }
    var md = buildMarkdown();
    var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, 'jigenbo-' + todayISO() + '.md');
    state.prefs.lastExportAt = Date.now();
    savePrefs();
    toast('已导出 Markdown');
    if (state.route.name === 'settings') render({ keepScroll: true });
  }

  function exportCSV() {
    var csv = buildCSV();
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, 'iread-export-' + todayISO() + '.csv');
    toast('已导出 ' + state.records.length + ' 条 CSV');
  }

  function pickImportFile() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (file) handleImportFile(file);
      input.remove();
    });
    input.click();
  }

  var pendingExtras = null;

  function handleImportFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try {
        data = JSON.parse(String(reader.result));
      } catch (e) {
        openModal({
          title: '导入失败',
          desc: '这个文件不是有效的 JSON，请确认选择的是次元簿导出的备份文件。',
          actions: [{ label: '知道了', value: null, variant: 'primary' }]
        });
        return;
      }

      var list = Array.isArray(data) ? data : (data && data.records);
      if (!Array.isArray(list)) {
        openModal({
          title: '导入失败',
          desc: '文件里找不到 records 字段，可能不是次元簿的备份文件。',
          actions: [{ label: '知道了', value: null, variant: 'primary' }]
        });
        return;
      }

      pendingExtras = {
        lists: (data && Array.isArray(data.lists)) ? data.lists.map(normalizeList).filter(Boolean) : null,
        checkins: (data && Array.isArray(data.checkins)) ? data.checkins.map(normalizeCheckin).filter(Boolean) : null,
        categories: (data && Array.isArray(data.categories)) ? normalizeCategories(data.categories) : null
      };

      var ver = data && Number(data.schemaVersion);
      if (ver && ver > SCHEMA_VERSION) {
        openModal({
          title: '版本较新',
          desc: '文件的数据版本（v' + ver + '）高于当前应用（v' + SCHEMA_VERSION + '），导入后可能丢失部分字段。',
          actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '仍然导入', value: 'ok', variant: 'primary' }]
        }).then(function (v) {
          if (v === 'ok') askImportMode(list);
        });
        return;
      }
      askImportMode(list);
    };
    reader.readAsText(file);
  }

  function askImportMode(list) {
    var incoming = [];
    var seen = {};
    list.forEach(function (r) {
      var n = normalizeRecord(r);
      if (!n) return;
      if (seen[n.id]) {
        if (n.updatedAt > seen[n.id].updatedAt) {
          incoming[incoming.indexOf(seen[n.id])] = n;
          seen[n.id] = n;
        }
        return;
      }
      seen[n.id] = n;
      incoming.push(n);
    });

    if (!incoming.length) {
      openModal({
        title: '没有可导入的记录',
        desc: '文件格式正确，但其中没有有效的记录（每条记录至少需要标题）。',
        actions: [{ label: '知道了', value: null, variant: 'primary' }]
      });
      return;
    }

    openModal({
      title: '导入 ' + incoming.length + ' 条记录',
      desc: '选择导入方式。合并会保留现有记录，按 id 去重，updatedAt 较新的覆盖较旧的。',
      body: '<div class="modal-choice">' +
        '<button class="choice" data-choice="merge"><strong>合并</strong><span>保留现有记录，重复的按更新时间取新</span></button>' +
        '<button class="choice" data-choice="overwrite"><strong>覆盖</strong><span>清空当前全部记录，只保留文件中的内容</span></button>' +
        '</div>',
      actions: [{ label: '取消', value: null, variant: 'ghost' }]
    });

    var root = document.getElementById('modal-root');
    root.querySelectorAll('[data-choice]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.dataset.choice;
        var cancel = root.querySelector('[data-idx="0"]');
        if (cancel) cancel.click(); else closeModal();
        applyImport(incoming, mode);
      });
    });
  }

  function applyImport(incoming, mode) {
    var added = 0, updated = 0, skipped = 0;
    if (mode === 'overwrite') {
      added = incoming.length;
      state.records = incoming.slice();
      if (pendingExtras) {
        if (pendingExtras.lists) state.lists = pendingExtras.lists;
        if (pendingExtras.checkins) state.checkins = pendingExtras.checkins;
        if (pendingExtras.categories) state.categories = pendingExtras.categories;
      }
    } else {
      var map = {};
      state.records.forEach(function (r) { map[r.id] = r; });
      var order = state.records.map(function (r) { return r.id; });
      incoming.forEach(function (rec) {
        var cur = map[rec.id];
        if (!cur) {
          map[rec.id] = rec;
          order.push(rec.id);
          added++;
        } else if (rec.updatedAt > cur.updatedAt) {
          map[rec.id] = rec;
          updated++;
        } else {
          skipped++;
        }
      });
      state.records = order.map(function (id) { return map[id]; }).filter(Boolean);

      if (pendingExtras) {
        if (pendingExtras.lists) {
          var lid = {};
          state.lists.forEach(function (l) { lid[l.id] = true; });
          pendingExtras.lists.forEach(function (l) { if (!lid[l.id]) { state.lists.push(l); lid[l.id] = true; } });
        }
        if (pendingExtras.checkins) {
          var cdate = {};
          state.checkins.forEach(function (c) { cdate[c.date] = true; });
          pendingExtras.checkins.forEach(function (c) { if (!cdate[c.date]) { state.checkins.push(c); cdate[c.date] = true; } });
        }
        if (pendingExtras.categories) {
          pendingExtras.categories.forEach(function (c) { if (state.categories.indexOf(c) < 0) state.categories.push(c); });
        }
      }
    }
    pendingExtras = null;
    save();
    toast('新增 ' + added + ' 条，更新 ' + updated + ' 条，跳过 ' + skipped + ' 条');
    render({ keepScroll: true });
  }

  /* ---------------- 文本批量导入（豆瓣 / Bangumi） ---------------- */

  function isDuplicateTitle(title) {
    var t = String(title || '').trim().toLowerCase();
    if (!t) return false;
    return state.records.some(function (r) { return r.title.trim().toLowerCase() === t; });
  }

  function detectStatus(text) {
    if (/搁置|弃了|抛弃|弃番|看不下|不看了/.test(text)) return 'paused';
    if (/读过|看过|看完|已看完|已完成|听完|通关/.test(text)) return 'done';
    if (/在读|在看|进行中|追更|追番/.test(text)) return 'doing';
    if (/想读|想看|愿望|待看|待读/.test(text)) return 'wish';
    return '';
  }

  function mapJsonItem(o) {
    if (!o || typeof o !== 'object') return null;
    var title = o.title || o.name_cn || o.name || o.subject || o.nameCn || '';
    if (!title) return null;
    var rating = o.rating;
    if (rating && typeof rating === 'object') rating = rating.score;
    if (rating == null) rating = o.score || o.rate || 0;
    var typeMap = { 1: 'novel', 2: 'anime', 3: 'novel', 4: 'novel', 6: 'tv' };
    var t = typeof o.type === 'number' ? (typeMap[o.type] || 'novel')
      : (TYPE_KEYS.indexOf(o.type) >= 0 ? o.type : 'novel');
    var status = STATUS_KEYS.indexOf(o.status) >= 0 ? o.status : (Number(rating) > 0 ? 'done' : 'wish');
    return {
      title: String(title),
      creator: o.creator || o.author || o.director || '',
      year: o.year || (o.date ? String(o.date).slice(0, 4) : ''),
      rating: clampRating(rating),
      tags: Array.isArray(o.tags) ? o.tags.slice(0, 5) : [],
      type: t,
      status: status,
      review: o.review || o.comment || ''
    };
  }

  function parseMALXML(text) {
    var items = [];
    var blocks = String(text).match(/<anime>[\s\S]*?<\/anime>|<manga>[\s\S]*?<\/manga>/gi) || [];
    blocks.forEach(function (b) {
      function tag(t) {
        var m = b.match(new RegExp('<' + t + '>([\\s\\S]*?)</' + t + '>', 'i'));
        return m ? m[1].trim() : '';
      }
      var title = tag('series_title') || tag('title');
      if (!title) return;
      var score = parseFloat(tag('my_score')) || 0;
      var st = parseInt(tag('my_status'), 10);
      var status = st === 2 ? 'done' : st === 1 ? 'doing' : (st === 3 || st === 4) ? 'paused' : 'wish';
      items.push({
        title: title,
        creator: '',
        year: '',
        releaseDate: '',
        rating: clampRating(score),
        tags: [],
        type: /^<manga/i.test(b) ? 'comic' : 'anime',
        status: status,
        review: ''
      });
    });
    return items;
  }

  function parseBulkText(text) {
    var raw = String(text || '').trim();
    if (!raw) return [];

    if (raw.charAt(0) === '<' && /<anime|<manga/i.test(raw)) {
      var mal = parseMALXML(raw);
      if (mal.length) return mal;
    }

    if (raw.charAt(0) === '[' || raw.charAt(0) === '{') {
      try {
        var data = JSON.parse(raw);
        var arr = Array.isArray(data) ? data
          : (data && Array.isArray(data.records)) ? data.records
            : (data && Array.isArray(data.items)) ? data.items
              : (data && Array.isArray(data.data)) ? data.data : null;
        if (arr && arr.length) return arr.map(mapJsonItem).filter(Boolean);
      } catch (e) { /* 不是 JSON，按文本处理 */ }
    }

    var blocks = raw.split(/\n\s*\n+/).map(function (b) { return b.trim(); }).filter(Boolean);
    if (blocks.length === 1) {
      var lines = raw.split('\n');
      var chunks = [];
      var cur = [];
      lines.forEach(function (l) {
        if (/^\s*\d{1,3}[.、)．]\s*\S/.test(l) && !/^\s*\d+(?:\.\d+)?\s*$/.test(l) && cur.length) {
          chunks.push(cur.join('\n'));
          cur = [l];
        } else {
          cur.push(l);
        }
      });
      if (cur.length) chunks.push(cur.join('\n'));
      if (chunks.length > 1) blocks = chunks;
    }

    return blocks.map(function (b) {
      var p = parseText(b);
      if (!p.title) return null;
      return {
        title: p.title.replace(/^\s*\d{1,3}[.、)．]\s*/, '').trim(),
        creator: p.creator || '',
        year: p.year || '',
        rating: p.rating || 0,
        tags: p.tags || [],
        type: p.type || 'novel',
        status: detectStatus(b) || 'wish',
        review: '',
        magazine: p.type === 'magazine' ? (parseIssueText(b) || undefined) : undefined
      };
    }).filter(function (x) { return x && x.title; });
  }

  /* 把「国内版 · 2026 年 10 月 · A 刊 · 第 10 期」还原成结构化刊期 */
  function parseIssueText(text) {
    var t = String(text || '').trim();
    if (!t) return null;
    var m = {};
    var ed = t.match(/(国内版|港版|台版|日版|韩版|美版|欧版|其他)/);
    if (ed) m.edition = ed[1];

    var rest = t.replace(/总第\s*[0-9]+\s*期/g, ' ');
    var tn = t.match(/总第\s*([0-9]+)\s*期/);
    if (tn) m.totalNo = tn[1];

    var ym = rest.match(/(19|20)\d{2}\s*年(?:\s*(\d{1,2})\s*月)?/);
    if (ym) {
      m.year = ym[0].match(/(19|20)\d{2}/)[0];
      if (ym[2]) m.month = String(Number(ym[2]));
    }
    var pt = rest.match(/([ABC])\s*刊|(合刊|增刊|别册)/);
    if (pt) m.part = pt[1] || pt[2];
    var no = rest.match(/第\s*([0-9]{1,3}(?:-[0-9]{1,3})?)\s*期/);
    if (no) m.issueNo = no[1];

    return Object.keys(m).length ? m : null;
  }

  /* ---------------- CSV 解析（Letterboxd / Goodreads / Trakt / 本应用） ---------------- */

  function parseCSV(text) {
    var s = String(text || '').replace(/^\ufeff/, '');
    var rows = [], row = [], field = '', inQ = false;
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (inQ) {
        if (c === '"') {
          if (s.charAt(i + 1) === '"') { field += '"'; i++; }
          else inQ = false;
        } else field += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) {
      return r.length && r.some(function (x) { return String(x).trim(); });
    });
  }

  function csvToItems(rows) {
    if (!rows || rows.length < 2) return [];
    var header = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });

    function find() {
      for (var i = 0; i < arguments.length; i++) {
        var p = header.indexOf(String(arguments[i]).toLowerCase());
        if (p >= 0) return p;
      }
      return -1;
    }

    var iTitle = find('title', 'name', '标题', '名称', 'series_title');
    var iYear = find('year', '年份');
    var iRating = find('my rating', 'rating', '评分', 'score', 'my_score');
    var iAuthor = find('author', 'creator', 'director', '作者', '创作者', '主创');
    var iReview = find('review', 'comment', '短评', '备注');
    var iShelf = find('exclusive shelf', 'status', '状态', 'shelf');
    var iType = find('type', '类型', 'media_type');
    var iDate = find('发布日期', 'release date', 'released', 'date');
    var iOriginal = find('原名');
    var iCategory = find('分类');
    var iDouban = find('豆瓣评分', '豆瓣');
    var iRecommend = find('推荐指数');
    var iAliases = find('别名');
    var iQuote = find('金句');
    var iIssue = find('刊期');
    if (iTitle < 0) return [];

    var isOur = header.indexOf('id') >= 0 && (header.indexOf('收录时间') >= 0 || header.indexOf('类型') >= 0);
    var isLetterboxd = header.indexOf('letterboxd uri') >= 0 || header.indexOf('letterboxd') >= 0;
    var isGoodreads = header.indexOf('exclusive shelf') >= 0 || header.indexOf('my rating') >= 0;
    var isTrakt = header.indexOf('watched_at') >= 0;
    var scale5 = isGoodreads || isLetterboxd;

    var items = [];
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      var title = String(row[iTitle] || '').trim();
      if (!title) continue;

      var rating = 0;
      if (iRating >= 0) {
        var rv = parseFloat(String(row[iRating]).replace(',', '.'));
        if (isFinite(rv) && rv > 0) rating = clampRating(scale5 ? rv * 2 : rv);
      }

      var status = 'wish';
      if (iShelf >= 0) {
        var sh = String(row[iShelf]).toLowerCase();
        if (/currently|在读|在看|进行/.test(sh)) status = 'doing';
        else if (/to-read|想看|想读|wish|planned/.test(sh)) status = 'wish';
        else if (/paused|abandon|搁置|弃/.test(sh)) status = 'paused';
        else if (/read|watched|看过|读完|已完成|complete/.test(sh)) status = 'done';
      } else if (isLetterboxd || isTrakt) status = 'done';

      var type = 'novel';
      if (isLetterboxd) type = 'movie';
      else if (isTrakt) type = /show|tv/i.test(String(row[iType] || '')) ? 'tv' : 'movie';
      else if (isOur && iType >= 0) {
        var tv = String(row[iType]);
        if (/期刊|杂志/.test(tv)) type = 'magazine';
        else if (/电影/.test(tv)) type = 'movie';
        else if (/电视剧/.test(tv)) type = 'tv';
        else if (/动漫|动画|番剧/.test(tv)) type = 'anime';
        else if (/综艺/.test(tv)) type = 'variety';
        else if (/广播剧/.test(tv)) type = 'drama';
        else if (/舞台剧|话剧|音乐剧/.test(tv)) type = 'stage';
        else if (/游戏/.test(tv)) type = 'game';
        else if (/音乐|专辑/.test(tv)) type = 'music';
        else if (/漫画/.test(tv)) type = 'comic';
        else if (/小说/.test(tv)) type = 'novel';
      } else if (iType >= 0) {
        var t2 = String(row[iType]).toLowerCase();
        if (t2 === 'movie' || t2 === 'film') type = 'movie';
        else if (t2 === 'anime') type = 'anime';
        else if (t2 === 'drama' || t2 === 'audio') type = 'drama';
        else if (t2 === 'stage' || t2 === 'theatre' || t2 === 'musical') type = 'stage';
        else if (t2 === 'game') type = 'game';
        else if (t2 === 'music' || t2 === 'album') type = 'music';
        else if (t2 === 'magazine' || t2 === 'journal') type = 'magazine';
        else if (t2 === 'variety') type = 'variety';
        else if (t2 === 'tv' || t2 === 'show') type = 'tv';
        else if (t2 === 'comic' || t2 === 'manga') type = 'comic';
      }

      var year = iYear >= 0 ? String(row[iYear] || '').trim().slice(0, 10) : '';
      if (!year && iDate >= 0) {
        var ym = String(row[iDate]).match(/(19|20)\d{2}/);
        if (ym) year = ym[0];
      }
      var releaseDate = '';
      if (iDate >= 0) {
        var dm = String(row[iDate]).match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dm) releaseDate = dm[0];
      }

      var issueText = iIssue >= 0 ? String(row[iIssue] || '').trim() : '';
      var mag = issueText ? parseIssueText(issueText) : null;
      if (mag && mag.year && !year) year = mag.year;

      var recLabel = iRecommend >= 0 ? String(row[iRecommend] || '').trim() : '';
      var recKey = '';
      if (/推荐/.test(recLabel) && !/不推荐/.test(recLabel)) recKey = 'yes';
      else if (/一般/.test(recLabel)) recKey = 'meh';
      else if (/不推荐/.test(recLabel)) recKey = 'no';

      items.push({
        title: title,
        originalTitle: iOriginal >= 0 ? String(row[iOriginal] || '').trim() : '',
        category: iCategory >= 0 ? String(row[iCategory] || '').trim().slice(0, 16) : '',
        douban: iDouban >= 0 ? (Number(String(row[iDouban] || '').replace(/[^0-9.]/g, '')) || 0) : 0,
        recommend: recKey,
        aliases: iAliases >= 0 ? String(row[iAliases] || '').split(/[\/、,，]/).map(function (x) { return x.trim(); }).filter(Boolean) : [],
        creator: iAuthor >= 0 ? String(row[iAuthor] || '').trim() : '',
        year: year,
        releaseDate: releaseDate,
        rating: rating,
        tags: [],
        type: type,
        status: status,
        review: iReview >= 0 ? String(row[iReview] || '').trim() : '',
        quote: iQuote >= 0 ? String(row[iQuote] || '').trim() : '',
        magazine: mag || undefined
      });
    }
    return items;
  }

  function pickCSVFile() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv,text/plain';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (file) {
        var reader = new FileReader();
        reader.onload = function () {
          var items = csvToItems(parseCSV(String(reader.result)));
          if (!items.length) {
            openModal({
              title: '没能识别',
              desc: '这个 CSV 里没有找到可用的标题列，或者文件为空。',
              actions: [{ label: '知道了', value: null, variant: 'primary' }]
            });
            return;
          }
          openBulkImport(items);
        };
        reader.readAsText(file);
      }
      input.remove();
    });
    input.click();
  }

  function backfillDates() {
    var n = 0;
    var cy = new Date().getFullYear();
    state.records.forEach(function (r) {
      if (r.releaseDate) return;
      var y = recordYear(r);
      if (!y || Number(y) >= cy) return;
      r.releaseDate = y + '-01-01';
      n++;
    });
    if (!n) { toast('没有需要补全的记录'); return; }
    save();
    toast('已补全 ' + n + ' 条发布日期');
    render({ keepScroll: true });
  }

  function openBulkImport(preItems) {
    var root = document.getElementById('modal-root');
    var parsed = [];
    var picked = {};

    function close() {
      root.innerHTML = '';
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    function step1(err) {
      root.innerHTML = '<div class="modal-backdrop"><div class="modal modal-wide">' +
        '<h3 class="modal-title">从文本批量导入</h3>' +
        '<p class="modal-desc">粘贴豆瓣 / Bangumi 的条目文本，空行分隔多条；也支持 JSON 数组和 CSV 文件。</p>' +
        '<textarea id="bulk-input" class="input" rows="9" placeholder="三体&#10;刘慈欣 / 重庆出版社 / 2008-1&#10;读过&#10;9.0&#10;&#10;沙丘 2&#10;丹尼斯·维伦纽瓦 / 2024&#10;看过&#10;8.0"></textarea>' +
        (err ? '<p class="bulk-err">' + esc(err) + '</p>' : '') +
        '<div class="modal-actions"><button class="btn btn-ghost" data-bulk="file">选择文件</button>' +
        '<button class="btn btn-ghost" data-bulk="cancel">取消</button>' +
        '<button class="btn btn-primary" data-bulk="parse">解析</button></div>' +
        '</div></div>';

      root.querySelector('[data-bulk="cancel"]').addEventListener('click', close);
      root.querySelector('[data-bulk="file"]').addEventListener('click', function () {
        var inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = '.csv,.json,application/json,text/csv,text/plain';
        inp.addEventListener('change', function () {
          var f = inp.files && inp.files[0];
          if (!f) return;
          var rd = new FileReader();
          rd.onload = function () {
            var txt = String(rd.result);
            var items = [];
            if (/\.csv$/i.test(f.name)) items = csvToItems(parseCSV(txt));
            if (!items.length) items = parseBulkText(txt);
            if (!items.length) items = csvToItems(parseCSV(txt));
            if (!items.length) { toast('文件里没有识别到条目'); return; }
            parsed = items;
            picked = {};
            items.forEach(function (it, i) { picked[i] = !isDuplicateTitle(it.title); });
            step2();
          };
          rd.readAsText(f);
        });
        inp.click();
      });
      root.querySelector('[data-bulk="parse"]').addEventListener('click', function () {
        var items = parseBulkText(root.querySelector('#bulk-input').value);
        if (!items.length) {
          step1('没能识别出条目，试试每条形如「标题 / 作者 / 年份 / 评分」的文本。');
          return;
        }
        parsed = items;
        picked = {};
        items.forEach(function (it, i) { picked[i] = !isDuplicateTitle(it.title); });
        step2();
      });
      var ta = root.querySelector('#bulk-input');
      if (ta) ta.focus();
    }

    function step2() {
      var dupCount = parsed.filter(function (it) { return isDuplicateTitle(it.title); }).length;
      root.innerHTML = '<div class="modal-backdrop"><div class="modal modal-wide">' +
        '<h3 class="modal-title">识别到 ' + parsed.length + ' 条</h3>' +
        '<p class="modal-desc">勾选要导入的条目' + (dupCount ? '；其中 ' + dupCount + ' 条与现有记录同名，已默认取消' : '') + '。</p>' +
        '<div class="bulk-list">' + parsed.map(function (it, i) {
          var dup = isDuplicateTitle(it.title);
          return '<label class="bulk-item">' +
            '<input type="checkbox" data-bulk-idx="' + i + '"' + (picked[i] ? ' checked' : '') + '>' +
            '<span class="bulk-main"><strong>' + esc(it.title) + '</strong>' +
            '<em>' + esc([TYPES[it.type].label, it.creator, it.year, it.rating ? ratingText(it.rating) : '', STATUSES[it.status]].filter(Boolean).join(' · ')) + '</em></span>' +
            (dup ? '<span class="bulk-dup">已存在</span>' : '') +
            '</label>';
        }).join('') + '</div>' +
        '<div class="modal-actions"><button class="btn btn-ghost" data-bulk="back">返回</button>' +
        '<button class="btn btn-primary" data-bulk="import">导入选中</button></div>' +
        '</div></div>';

      root.querySelector('[data-bulk="back"]').addEventListener('click', function () { step1(); });
      root.querySelectorAll('[data-bulk-idx]').forEach(function (el) {
        el.addEventListener('change', function () { picked[el.dataset.bulkIdx] = el.checked; });
      });
      root.querySelector('[data-bulk="import"]').addEventListener('click', doImport);
    }

    function doImport() {
      var n = 0;
      var now = Date.now();
      parsed.forEach(function (it, i) {
        if (!picked[i]) return;
        var rec = normalizeRecord({
          type: it.type, title: it.title, creator: it.creator, year: it.year,
          originalTitle: it.originalTitle || '',
          aliases: it.aliases || [],
          releaseDate: it.releaseDate || '',
          tags: it.tags, rating: it.rating, status: it.status,
          review: it.review || '', quote: it.quote || '',
          category: it.category || '', douban: it.douban || 0, recommend: it.recommend || '',
          magazine: it.magazine || {},
          meta: it.meta || {},
          createdAt: now - n, updatedAt: now - n,
          logs: [{ action: 'add', at: now - n }]
        });
        if (!rec) return;
        state.records.unshift(rec);
        n++;
      });
      if (!n) { toast('没有选中任何条目'); return; }
      save();
      close();
      toast('已导入 ' + n + ' 条记录');
      render({ keepScroll: true });
    }

    if (preItems && preItems.length) {
      parsed = preItems;
      picked = {};
      parsed.forEach(function (it, i) { picked[i] = !isDuplicateTitle(it.title); });
      step2();
    } else {
      step1();
    }
  }

  /* ---------------- 标签维护 ---------------- */

  function renameTag(tag) {
    openModal({
      title: '重命名标签',
      desc: '把「' + tag + '」改为：',
      body: '<input class="input" id="modal-input" value="' + esc(tag) + '">',
      actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '保存', collect: true, variant: 'primary' }]
    }).then(function (val) {
      var next = String(val || '').trim().slice(0, 16);
      if (!next || next === tag) return;
      replaceTag(tag, next);
      toast('已重命名');
      render({ keepScroll: true });
    });
  }

  function addCategory() {
    openModal({
      title: '新建分类',
      desc: '比如：小说 / 散文 / 理财 / 教材。',
      body: '<input class="input" id="modal-input" placeholder="分类名">',
      actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '创建', collect: true, variant: 'primary' }]
    }).then(function (val) {
      var name = String(val || '').trim().slice(0, 16);
      if (!name) return;
      if (state.categories.indexOf(name) >= 0) { toast('已经有这个分类了'); return; }
      state.categories.push(name);
      save();
      toast('已新建分类');
      render({ keepScroll: true });
    });
  }

  function renameCategory(cat) {
    openModal({
      title: '重命名分类',
      desc: '把「' + cat + '」改为：',
      body: '<input class="input" id="modal-input" value="' + esc(cat) + '">',
      actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '保存', collect: true, variant: 'primary' }]
    }).then(function (val) {
      var next = String(val || '').trim().slice(0, 16);
      if (!next || next === cat) return;
      state.categories = state.categories.map(function (c) { return c === cat ? next : c; });
      state.categories = state.categories.filter(function (c, i, arr) { return arr.indexOf(c) === i; });
      state.records.forEach(function (r) {
        if (r.category === cat) { r.category = next; r.updatedAt = Date.now(); }
      });
      save();
      toast('已重命名');
      render({ keepScroll: true });
    });
  }

  function deleteCategory(cat) {
    var n = state.records.filter(function (r) { return r.category === cat; }).length;
    openModal({
      title: '删除分类「' + cat + '」',
      desc: n ? '有 ' + n + ' 条记录正在用这个分类，删除后它们会变成「不分类」。' : '这个分类还没有被用到。',
      actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '删除', value: 'yes', variant: 'danger' }]
    }).then(function (v) {
      if (v !== 'yes') return;
      state.categories = state.categories.filter(function (c) { return c !== cat; });
      state.records.forEach(function (r) { if (r.category === cat) r.category = ''; });
      save();
      toast('已删除分类');
      render({ keepScroll: true });
    });
  }

  function mergeTag(tag) {
    var others = tagCounts().map(function (t) { return t[0]; }).filter(function (t) { return t !== tag; });
    if (!others.length) {
      toast('没有其他标签可以合并');
      return;
    }
    openModal({
      title: '合并标签',
      desc: '把「' + tag + '」合并到：',
      body: '<select class="input" id="modal-input">' + others.map(function (t) {
        return '<option value="' + esc(t) + '">' + esc(t) + '</option>';
      }).join('') + '</select>',
      actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '合并', collect: true, variant: 'primary' }]
    }).then(function (val) {
      if (!val) return;
      replaceTag(tag, val);
      toast('已合并到「' + val + '」');
      render({ keepScroll: true });
    });
  }

  function replaceTag(from, to) {
    state.records.forEach(function (r) {
      if ((r.tags || []).indexOf(from) < 0) return;
      var next = [];
      r.tags.forEach(function (t) {
        var v = t === from ? to : t;
        if (next.indexOf(v) < 0) next.push(v);
      });
      r.tags = next;
      r.updatedAt = Date.now();
    });
    save();
  }

  function deleteTag(tag) {
    openModal({
      title: '删除标签',
      desc: '将把「' + tag + '」从所有记录中移除，记录本身不会被删除。',
      actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '删除', value: 'ok', variant: 'danger' }]
    }).then(function (v) {
      if (v !== 'ok') return;
      state.records.forEach(function (r) {
        var i = r.tags.indexOf(tag);
        if (i >= 0) {
          r.tags.splice(i, 1);
          r.updatedAt = Date.now();
        }
      });
      save();
      toast('已删除标签');
      render({ keepScroll: true });
    });
  }

  /* ---------------- 弹窗 / 提示 ---------------- */

  var toastTimer = null;

  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  }

  function openModal(opts) {
    return new Promise(function (resolve) {
      var root = document.getElementById('modal-root');
      var actions = opts.actions || [{ label: '取消', value: null, variant: 'ghost' }];
      root.innerHTML = '<div class="modal-backdrop">' +
        '<div class="modal" role="dialog" aria-modal="true">' +
        '<h3 class="modal-title">' + esc(opts.title || '') + '</h3>' +
        (opts.desc ? '<p class="modal-desc">' + esc(opts.desc) + '</p>' : '') +
        (opts.body || '') +
        '<div class="modal-actions">' +
        actions.map(function (a, i) {
          var cls = a.variant === 'primary' ? 'btn-primary' : a.variant === 'danger' ? 'btn-danger' : 'btn-ghost';
          return '<button class="btn ' + cls + '" data-idx="' + i + '">' + esc(a.label) + '</button>';
        }).join('') +
        '</div></div></div>';

      var done = false;
      function finish(v) {
        if (done) return;
        done = true;
        document.removeEventListener('keydown', onKey);
        root.innerHTML = '';
        resolve(v);
      }

      root.querySelectorAll('[data-idx]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var a = actions[Number(btn.dataset.idx)];
          if (a.collect) {
            var input = root.querySelector('#modal-input');
            finish(input ? String(input.value).trim() : null);
          } else {
            finish(a.value === undefined ? null : a.value);
          }
        });
      });

      var backdrop = root.querySelector('.modal-backdrop');
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) finish(null);
      });

      function onKey(e) {
        if (e.key === 'Escape') finish(null);
        if (e.key === 'Enter') {
          var input = root.querySelector('#modal-input');
          if (input && e.target === input) {
            e.preventDefault();
            finish(String(input.value).trim());
          }
        }
      }
      document.addEventListener('keydown', onKey);

      var input = root.querySelector('#modal-input');
      if (input) {
        setTimeout(function () {
          input.focus();
          if (input.select) input.select();
        }, 60);
      }
    });
  }

  /* ---------------- 示例数据 ---------------- */

  function seedDemo() {
    var now = Date.now();
    var D = DAY;
    var seq = 0;
    function rec(o) {
      var created = now - (o.days || 0) * D;
      seq++;
      var r = normalizeRecord({
        id: 'demo_' + seq + '_' + Math.random().toString(36).slice(2, 6),
        type: o.type,
        title: o.title,
        creator: o.creator || '',
        year: o.year || '',
        tags: o.tags || [],
        rating: o.rating || 0,
        status: o.status,
        review: o.review || '',
        hours: o.hours || 0,
        cover: '',
        updateDay: o.updateDay == null ? -1 : o.updateDay,
        meta: o.meta || {},
        magazine: o.magazine || {},
        quotes: o.quotes || [],
        douban: o.douban || 0,
        recommend: o.recommend || '',
        category: o.category || '',
        sections: o.sections || {},
        notesLog: o.notesLog || [],
        startedAt: o.startedAt || '',
        finishedAt: o.finishedAt || '',
        episodes: o.episodes || [],
        progress: o.progress || { current: 0, total: 0, season: 1 },
        rewatches: o.rewatches || [],
        logs: [{ action: 'add', at: created }].concat(o.logs || []),
        createdAt: created,
        updatedAt: created
      });
      return r;
    }

    var demo = [
      rec({
        type: 'novel', title: '三体', creator: '刘慈欣', year: '2008', status: 'done', rating: 9.5,
        tags: ['科幻', '悬疑'], hours: 26, days: 96,
        review: '黑暗森林法则让我在深夜合上书，发了很久的呆。',
        progress: { current: 30, total: 30 },
        startedAt: ymd(new Date(now - 96 * D)),
        finishedAt: ymd(new Date(now - 66 * D)),
        douban: 8.8,
        recommend: 'yes',
        category: '小说',
        meta: { publisher: '重庆出版社', source: '购买' },
        notesLog: [{
          date: ymd(new Date(now - 70 * D)),
          text: '读到叶文洁按下发射键那一段，忽然理解了「不要回答」这四个字有多重。\n\n整本书最厉害的地方不是设定，是它让人相信：一个文明的善意，也可能是另一个文明的灾难。'
        }],
        quotes: [
          { text: '弱小和无知不是生存的障碍，傲慢才是。', page: '第 302 页' },
          { text: '给岁月以文明，而不是给文明以岁月。', page: '' }
        ],
        rewatches: [{ id: 'w1', date: ymd(new Date(now - 30 * D)), rating: 9.5, review: '第二次读，注意到的全是大刘埋的伏笔。' }]
      }),
      rec({
        type: 'comic', title: '蓦然回首', creator: '藤本树', year: '2021', status: 'done', rating: 8.5,
        tags: ['治愈', '青春'], hours: 2, days: 34,
        review: '薄薄一本，最后一页翻过去之后安静了很久。',
        progress: { current: 1, total: 1 }
      }),
      rec({
        type: 'tv', title: '漫长的季节', creator: '辛爽', year: '2023', status: 'done', rating: 9,
        tags: ['悬疑', '剧情', '家庭'], hours: 12, days: 52,
        review: '往前看，别回头。',
        progress: { seasons: [{ n: 1, current: 12, total: 12, done: true }] }
      }),
      rec({
        type: 'movie', title: '沙丘 2', creator: '丹尼斯·维伦纽瓦', year: '2024', status: 'done', rating: 8,
        tags: ['科幻', '冒险'], hours: 3, days: 14,
        review: '沙虫那一场戏，值得把音量开到最大。'
      }),
      rec({
        type: 'novel', title: '地球尽头的温室', creator: '金草叶', year: '2022', status: 'doing', rating: 0,
        tags: ['科幻', '治愈'], hours: 6, days: 4, updateDay: 5,
        review: '读得很慢，但每一章都舍不得快进。',
        progress: { current: 120, total: 320 },
        logs: [{ action: 'start', at: now - 4 * D }]
      }),
      rec({
        type: 'comic', title: '咒术回战', creator: '芥见下下', year: '2018', status: 'doing', rating: 7.5,
        tags: ['奇幻', '冒险'], hours: 9, days: 8, updateDay: 3,
        review: '',
        progress: { current: 180, total: 250 },
        logs: [{ action: 'start', at: now - 8 * D }]
      }),
      rec({
        type: 'tv', title: '重启人生', creator: '笨蛋节奏', year: '2023', status: 'doing', rating: 8.5,
        tags: ['剧情', '治愈', '喜剧'], hours: 5, days: 2, updateDay: 0,
        review: '每一轮重来都在补一点点小遗憾。',
        progress: { seasons: [{ n: 1, current: 5, total: 10, done: false }] },
        logs: [{ action: 'start', at: now - 2 * D }]
      }),
      rec({
        type: 'tv', title: '怪奇物语', creator: '达菲兄弟', year: '2016', status: 'doing', rating: 8.5,
        tags: ['科幻', '恐怖', '冒险'], hours: 31, days: 26, updateDay: 4,
        review: '第四季开始补，八十年代的味道太对了。',
        progress: {
          seasons: [
            { n: 1, current: 8, total: 8, done: true },
            { n: 2, current: 9, total: 9, done: true },
            { n: 3, current: 8, total: 8, done: true },
            { n: 4, current: 3, total: 9, done: false }
          ]
        },
        douban: 9.0,
        recommend: 'yes',
        category: '剧集',
        sections: {
          plot: '第四季把四条线拆得很散，但收束的时候每一条都咬上了。',
          music: 'Running Up That Hill 那段是全季最好的一次「用歌救人」。',
          cast: 'Max 的表演撑起了整季后段。'
        },
        startedAt: ymd(new Date(now - 26 * D)),
        episodes: [
          { no: 1, date: ymd(new Date(now - 6 * D)), rating: 9, review: '开场就把人按回 1986 年。' },
          { no: 2, date: ymd(new Date(now - 3 * D)), rating: 8.5, review: '这条线终于接上了。' }
        ],
        logs: [{ action: 'start', at: now - 26 * D }]
      }),
      rec({
        type: 'movie', title: '奥本海默', creator: '克里斯托弗·诺兰', year: '2023', status: 'wish', rating: 0,
        tags: ['历史', '剧情'], hours: 0, days: 22
      }),
      rec({
        type: 'novel', title: '房思琪的初恋乐园', creator: '林奕含', year: '2017', status: 'paused', rating: 8,
        tags: ['纪实', '文艺'], hours: 4, days: 64,
        review: '读到一半需要停下来喘口气。',
        progress: { unit: 'page', page: { current: 80, total: 250 } },
        douban: 9.2,
        recommend: 'yes',
        category: '纪实',
        meta: { publisher: '游击文化', source: '借阅' },
        quotes: [{ text: '任何关于性的暴力，都是整个社会一起完成的。', page: '第 45 页' }]
      }),
      rec({
        type: 'movie', title: '蜘蛛侠：纵横宇宙', creator: '华金·多斯·桑托斯', year: '2023', status: 'done', rating: 8.5,
        tags: ['动画', '冒险'], hours: 2.5, days: 210,
        review: '每一帧都可以截图当壁纸。'
      }),
      rec({
        type: 'anime', title: '葬送的芙莉莲', creator: '斋藤圭一郎 / MADHOUSE', year: '2023', status: 'doing', rating: 9.5,
        tags: ['奇幻', '治愈', '冒险'], hours: 11, days: 5, updateDay: 4,
        review: '时间尺度拉得很长，反而把告别拍得很轻。',
        progress: { segments: [{ n: 1, current: 12, total: 28, done: false }] },
        douban: 9.4,
        recommend: 'yes',
        category: '动画',
        meta: { studio: 'MADHOUSE', platform: 'B 站' },
        logs: [{ action: 'start', at: now - 5 * D }]
      }),
      rec({
        type: 'comic', title: '迷宫饭', creator: '九井谅子', year: '2014', status: 'done', rating: 9,
        tags: ['奇幻', '冒险', '治愈'], hours: 14, days: 120,
        review: '把迷宫生态做成了一桌菜，设定控狂喜。',
        progress: { unit: 'volume', volume: { current: 14, total: 14 } },
        meta: { publisher: 'KADOKAWA', serialStatus: '已完结' }
      }),
      rec({
        type: 'novel', title: '第一律法', creator: '乔·阿克罗比', year: '2006', status: 'doing', rating: 9,
        tags: ['奇幻', '冒险'], hours: 38, days: 40,
        review: '第一部读完，灰白驼背的格洛塔太鲜活。',
        progress: {
          segments: [
            { n: 1, current: 42, total: 42, done: true },
            { n: 2, current: 18, total: 40, done: false }
          ]
        },
        meta: { publisher: '重庆出版社', translator: '屈畅' }
      }),
      rec({
        type: 'variety', title: '圆桌派', creator: '窦文涛', year: '2016', status: 'paused', rating: 8,
        tags: ['纪实', '都市'], hours: 20, days: 70,
        review: '吃饭的时候随便放一集，听着人说话就很安心。',
        progress: { segments: [{ n: 1, current: 8, total: 24, done: false }] },
        meta: { platform: '优酷' }
      }),
      rec({
        type: 'magazine', title: '科幻世界', creator: '科幻世界杂志社', year: '2026', status: 'done', rating: 8,
        tags: ['科幻'], hours: 3, days: 9,
        review: '这一期的短篇比主打更有意思。',
        magazine: {
          edition: '国内版', year: '2026', month: '10', part: 'A',
          issueNo: '10', totalNo: '500', frequency: '月刊', publisher: '科幻世界杂志社'
        }
      }),
      rec({
        type: 'drama', title: '魔道祖师 广播剧', creator: '光合积木', year: '2018', status: 'doing', rating: 9,
        tags: ['古风', '奇幻'], hours: 18, days: 12, updateDay: 5,
        review: '声音的层次感太强了，闭眼就是画面。',
        progress: { segments: [{ n: 1, current: 8, total: 12, done: false }] },
        meta: { platform: '猫耳 FM', cv: '路知行 / 刘明月' },
        logs: [{ action: 'start', at: now - 12 * D }]
      }),
      rec({
        type: 'stage', title: '悲惨世界 音乐剧', creator: '上海文化广场', year: '2024', status: 'done', rating: 9.5,
        tags: ['历史', '剧情'], hours: 3, days: 30,
        review: '最后一首 Do You Hear the People Sing，全场都在发抖。',
        meta: { venue: '上海文化广场', runtime: '170' }
      }),
      rec({
        type: 'game', title: '塞尔达传说：王国之泪', creator: '任天堂', year: '2023', status: 'doing', rating: 9.5,
        tags: ['冒险', '奇幻'], hours: 62, days: 88,
        review: '究极手一开，整个海拉鲁都变成了玩具箱。',
        progress: { percent: 65 },
        meta: { platform: 'Switch', gameType: '主机' },
        logs: [{ action: 'start', at: now - 88 * D }]
      }),
      rec({
        type: 'music', title: '星际牛仔 OST', creator: '菅野洋子', year: '1998', status: 'done', rating: 10,
        tags: ['爵士', '科幻'], hours: 2, days: 150,
        review: 'Tank! 一响，立刻回到那艘船上。',
        meta: { publisher: 'Victor', albumType: 'OST' }
      })
    ];

    state.records = demo.filter(Boolean).concat(state.records);

    ['小说', '纪实', '剧集', '动画', '音乐'].forEach(function (c) {
      if (state.categories.indexOf(c) < 0) state.categories.push(c);
    });

    var haveDate = {};
    state.checkins.forEach(function (c) { haveDate[c.date] = true; });
    var lead = demo[0] ? demo[0].id : '';
    for (var ci = 0; ci < 6; ci++) {
      var dstr = ymd(new Date(now - ci * D));
      if (haveDate[dstr]) continue;
      state.checkins.push({
        id: 'demo_ck_' + ci,
        date: dstr,
        recordId: lead,
        minutes: 25 + ci * 5,
        note: ci === 0 ? '读了三十页，顺手记了两句' : ''
      });
    }

    save();
    toast('已填充 ' + demo.length + ' 条示例记录');
    render({ keepScroll: true });
  }

  /* ---------------- 事件 ---------------- */

  function goBack() {
    state.draft = null;
    location.hash = state.returnTo || '#/library';
  }

  function handleAction(action, el) {
    switch (action) {
      case 'new':
        if (state.route.name !== 'new' && state.route.name !== 'edit') {
          state.returnTo = '#/' + state.route.name;
        }
        location.hash = '#/new';
        break;

      case 'open':
        if (state.route.name !== 'new' && state.route.name !== 'edit') {
          state.returnTo = '#/' + state.route.name;
        }
        location.hash = '#/edit/' + el.dataset.id;
        break;

      case 'settings':
        location.hash = '#/settings';
        break;

      case 'goto-settings':
        location.hash = '#/settings';
        break;

      case 'back':
        goBack();
        break;

      case 'clear-search':
        state.search = '';
        render();
        break;

      case 'filter-status':
        state.filters.status = el.dataset.value;
        render({ keepScroll: true });
        break;

      case 'filter-type':
        state.filters.type = el.dataset.value;
        render({ keepScroll: true });
        break;

      case 'toggle-view':
        state.ui.view = state.ui.view === 'wall' ? 'grid' : 'wall';
        render({ keepScroll: true });
        break;

      case 'quote-type':
        state.ui.quoteType = el.dataset.value;
        render({ keepScroll: true });
        break;

      case 'clear-quote-search':
        state.ui.quoteQ = '';
        render({ keepScroll: true });
        break;

      case 'author-toggle':
        state.authors.open = state.authors.open === el.dataset.name ? '' : el.dataset.name;
        render({ keepScroll: true });
        break;

      case 'archive-year':
        state.archive.year = el.dataset.value === 'all' ? 'all' : el.dataset.value;
        render({ keepScroll: true });
        break;

      case 'back-home':
        location.hash = '#/home';
        break;

      case 'clear-filters':
        state.filters.status = 'all';
        state.filters.type = 'all';
        state.filters.tag = 'all';
        state.filters.year = 'all';
        state.filters.release = 'all';
        state.filters.rating = 'all';
        render({ keepScroll: true });
        break;

      case 'select-mode':
        state.ui.selectMode = true;
        state.ui.selected = {};
        render({ keepScroll: true });
        break;

      case 'exit-select':
        exitSelect();
        render({ keepScroll: true });
        break;

      case 'toggle-select': {
        var sid = el.dataset.id;
        state.ui.selected[sid] = !state.ui.selected[sid];
        render({ keepScroll: true });
        break;
      }

      case 'select-all': {
        var visible = libraryRecords().map(function (r) { return r.id; });
        var allOn = visible.length > 0 && visible.every(function (id) { return state.ui.selected[id]; });
        visible.forEach(function (id) { state.ui.selected[id] = !allOn; });
        render({ keepScroll: true });
        break;
      }

      case 'bulk-status':
        bulkStatus();
        break;

      case 'bulk-tag':
        bulkTag();
        break;

      case 'bulk-delete':
        bulkDelete();
        break;

      case 'pick-list':
        state.ui.listId = el.dataset.id;
        state.ui.sortMode = false;
        state.ui.selectMode = false;
        state.ui.selected = {};
        render({ keepScroll: true });
        break;

      case 'new-list':
        openListEditor(null);
        break;

      case 'edit-list':
        openListEditor(el.dataset.id);
        break;

      case 'save-view':
        saveCurrentView();
        break;

      case 'list-pick':
        openListPicker();
        break;

      case 'toggle-sort':
        state.ui.sortMode = !state.ui.sortMode;
        render({ keepScroll: true });
        break;

      case 'set-type':
        if (state.draft && TYPES[el.dataset.value]) {
          state.draft.type = el.dataset.value;
          if (TYPES[el.dataset.value].mode === 'series') {
            var ss = state.draft.progress.segments || (state.draft.progress.segments = []);
            if (!ss.length) ss.push({ n: 1, current: 0, total: 0, done: false });
          }
          render({ keepScroll: true });
        }
        break;

      case 'set-unit':
        if (state.draft) {
          var uv = el.dataset.value;
          state.draft.progress.unit = (uv === 'volume' || uv === 'page') ? uv : 'chapter';
          render({ keepScroll: true });
        }
        break;

      case 'toggle-paste':
        state.pasteOpen = !state.pasteOpen;
        render({ keepScroll: true });
        break;

      case 'parse-paste':
        parsePaste();
        break;

      case 'toggle-tag': {
        var tag = el.dataset.tag;
        var d = state.draft;
        if (!d) break;
        var i = d.tags.indexOf(tag);
        if (i >= 0) d.tags.splice(i, 1);
        else d.tags.push(tag);
        render({ keepScroll: true });
        break;
      }

      case 'set-star': {
        if (!state.draft) break;
        var sv = Number(el.dataset.value) * 2;
        state.draft.rating = sv;
        var wrap = document.getElementById('star-input');
        if (wrap) {
          var fill = wrap.querySelector('.stars-fill');
          if (fill) fill.style.width = Math.round(sv) * 10 + '%';
        }
        var numEl = document.getElementById('rating-num');
        if (numEl) numEl.textContent = ratingText(sv);
        break;
      }

      case 'plus-one': {
        var pid = el.dataset.id;
        var prec = state.records.filter(function (r) { return r.id === pid; })[0];
        if (!prec) break;
        if (!bumpProgress(prec)) { toast('这条记录没有可增加的进度'); break; }
        prec.updatedAt = Date.now();
        save();
        toast('进度 +1');
        render({ keepScroll: true });
        break;
      }

      case 'add-rewatch':
        if (state.draft) {
          state.draft.rewatches.push({ id: uid(), date: todayISO(), rating: 0, review: '' });
          render({ keepScroll: true });
        }
        break;

      case 'del-rewatch':
        if (state.draft) {
          state.draft.rewatches = state.draft.rewatches.filter(function (w) { return w.id !== el.dataset.id; });
          render({ keepScroll: true });
        }
        break;

      case 'checkin-save': {
        var selDate = state.checkin.sel || todayISO();
        var rSel = document.querySelector('[data-checkin="record"]');
        var mEl = document.querySelector('[data-checkin="minutes"]');
        var nEl = document.querySelector('[data-checkin="note"]');
        var minutes = Math.max(0, Math.min(1440, Math.floor(Number(mEl && mEl.value) || 0)));
        var note = nEl ? String(nEl.value).trim().slice(0, 200) : '';
        var rid = rSel ? rSel.value : '';
        if (!minutes && !note) { toast('填个时长，或者写一句'); break; }
        var cur = checkinOf(selDate);
        if (cur) {
          cur.minutes = minutes;
          cur.note = note;
          cur.recordId = rid;
        } else {
          state.checkins.push({ id: uid(), date: selDate, recordId: rid, minutes: minutes, note: note });
        }
        save();
        toast(cur ? '已更新打卡' : '已打卡');
        render();
        break;
      }

      case 'checkin-del': {
        var delDate = state.checkin.sel || todayISO();
        state.checkins = state.checkins.filter(function (x) { return x.date !== delDate; });
        save();
        toast('已撤销这天的打卡');
        render();
        break;
      }

      case 'checkin-prev':
      case 'checkin-next': {
        var delta = action === 'checkin-prev' ? -1 : 1;
        var cy = state.checkin.y, cm = state.checkin.m + delta;
        if (cm < 0) { cm = 11; cy--; }
        if (cm > 11) { cm = 0; cy++; }
        state.checkin.y = cy;
        state.checkin.m = cm;
        state.checkin.sel = '';
        render({ keepScroll: true });
        break;
      }

      case 'checkin-day': {
        var ds = el.dataset.date;
        var dd = new Date(ds + 'T00:00:00');
        state.checkin.y = dd.getFullYear();
        state.checkin.m = dd.getMonth();
        state.checkin.sel = ds;
        render({ keepScroll: true });
        break;
      }

      case 'checkin-today': {
        var now2 = new Date();
        state.checkin.y = now2.getFullYear();
        state.checkin.m = now2.getMonth();
        state.checkin.sel = todayISO();
        render({ keepScroll: true });
        break;
      }

      case 'add-note':
        if (state.draft) {
          var nl = state.draft.notesLog || (state.draft.notesLog = []);
          nl.unshift({ id: uid(), date: todayISO(), text: '' });
          render({ keepScroll: true });
          setTimeout(function () {
            var ta = document.querySelector('[data-note="text"]');
            if (ta) { ta.focus(); ta.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
          }, 60);
        }
        break;

      case 'del-note':
        if (state.draft) {
          state.draft.notesLog = (state.draft.notesLog || []).filter(function (n) { return n.id !== el.dataset.id; });
          render({ keepScroll: true });
        }
        break;

      case 'fold':
        if (state.ui.fold) {
          state.ui.fold[el.dataset.key] = !state.ui.fold[el.dataset.key];
          render({ keepScroll: true });
        }
        break;

      case 'add-quote':
        if (state.draft) {
          var qs = state.draft.quotes || (state.draft.quotes = []);
          qs.push({ id: uid(), text: '', page: '' });
          render({ keepScroll: true });
        }
        break;

      case 'del-quote':
        if (state.draft) {
          state.draft.quotes = (state.draft.quotes || []).filter(function (q) { return q.id !== el.dataset.id; });
          render({ keepScroll: true });
        }
        break;

      case 'add-episode':
        if (state.draft) {
          var eps = state.draft.episodes || (state.draft.episodes = []);
          var maxEp = 0;
          eps.forEach(function (x) { maxEp = Math.max(maxEp, x.no || 0); });
          eps.push({ id: uid(), no: maxEp + 1, date: todayISO(), rating: 0, review: '' });
          render({ keepScroll: true });
        }
        break;

      case 'del-episode':
        if (state.draft) {
          state.draft.episodes = (state.draft.episodes || []).filter(function (x) { return x.id !== el.dataset.id; });
          render({ keepScroll: true });
        }
        break;

      case 'add-season':
        if (state.draft) {
          var dd = state.draft;
          var sList = dd.progress.segments || (dd.progress.segments = []);
          var maxN = 0;
          sList.forEach(function (x, i) { maxN = Math.max(maxN, x.n || (i + 1)); });
          var seed = { n: maxN + 1, current: 0, total: 0, done: false };
          if (!sList.length && TYPES[dd.type].mode === 'book') {
            var cb = dd.progress.chapter || {};
            seed.current = cb.current || 0;
            seed.total = cb.total || 0;
          }
          sList.push(seed);
          render({ keepScroll: true });
        }
        break;

      case 'del-season':
        if (state.draft) {
          var segs = state.draft.progress.segments || [];
          segs.splice(Number(el.dataset.index), 1);
          segs.forEach(function (x, i) { x.n = i + 1; });
          render({ keepScroll: true });
        }
        break;

      case 'history':
        openHistory(el.dataset.id);
        break;

      case 'save':
        saveDraft();
        break;

      case 'delete':
        if (state.draft && state.draft.id) {
          var rec = state.records.filter(function (r) { return r.id === state.draft.id; })[0];
          if (rec) {
            openModal({
              title: '删除这条记录？',
              desc: '「' + rec.title + '」将从本地数据中移除，无法撤销。',
              actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '删除', value: 'ok', variant: 'danger' }]
            }).then(function (v) {
              if (v !== 'ok') return;
              state.records = state.records.filter(function (r) { return r.id !== rec.id; });
              save();
              state.draft = null;
              toast('已删除');
              location.hash = state.returnTo || '#/library';
            });
          }
        }
        break;

      case 'tl-view':
        state.timeline.view = el.dataset.value;
        render({ keepScroll: true });
        break;

      case 'cal-prev':
        state.timeline.m--;
        if (state.timeline.m < 0) { state.timeline.m = 11; state.timeline.y--; }
        state.timeline.selected = null;
        render({ keepScroll: true });
        break;

      case 'cal-next':
        state.timeline.m++;
        if (state.timeline.m > 11) { state.timeline.m = 0; state.timeline.y++; }
        state.timeline.selected = null;
        render({ keepScroll: true });
        break;

      case 'cal-day':
        state.timeline.selected = el.dataset.date;
        render({ keepScroll: true });
        break;

      case 'cal-type':
        state.timeline.type = el.dataset.value;
        state.timeline.selected = null;
        render({ keepScroll: true });
        break;

      case 'cal-export':
        exportMonthICS();
        break;

      case 'gen-report': {
        var rs = state.report;
        rs.data = buildReport(rs.year, rs.month, rs.type);
        render({ keepScroll: true });
        setTimeout(function () {
          var card = document.getElementById('report-card');
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
        break;
      }

      case 'save-poster':
        savePoster();
        break;

      case 'share-poster':
        sharePoster();
        break;

      case 'theme':
        state.prefs.theme = el.dataset.value;
        savePrefs();
        applyTheme();
        render({ keepScroll: true });
        break;

      case 'rating-scale':
        state.prefs.ratingScale = el.dataset.value === '5' ? '5' : '10';
        savePrefs();
        render({ keepScroll: true });
        break;

      case 'import-csv':
        pickCSVFile();
        break;

      case 'backfill-date':
        backfillDates();
        break;

      case 'install':
        askInstall();
        break;

      case 'check-update':
        checkUpdate();
        break;

      case 'export':
        exportJSON();
        break;

      case 'export-csv':
        exportCSV();
        break;

      case 'export-md':
        exportMarkdown();
        break;

      case 'go':
        location.hash = '#/' + el.dataset.to;
        break;

      case 'cat-add':
        addCategory();
        break;

      case 'cat-rename':
        renameCategory(el.dataset.cat);
        break;

      case 'cat-delete':
        deleteCategory(el.dataset.cat);
        break;

      case 'bulk-import':
        openBulkImport();
        break;

      case 'ics':
        openIcsModal();
        break;

      case 'import':
        pickImportFile();
        break;

      case 'tag-rename':
        renameTag(el.dataset.tag);
        break;

      case 'tag-merge':
        mergeTag(el.dataset.tag);
        break;

      case 'tag-delete':
        deleteTag(el.dataset.tag);
        break;

      case 'seed-demo':
        seedDemo();
        break;

      case 'clear-all':
        openModal({
          title: '清空全部数据？',
          desc: '所有记录都会被删除，且无法恢复。建议先导出一份 JSON 备份。',
          actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '确认清空', value: 'ok', variant: 'danger' }]
        }).then(function (v) {
          if (v !== 'ok') return;
          state.records = [];
          state.lists = [];
          state.checkins = [];
          state.categories = [];
          state.ui.listId = 'all';
          state.ui.selectMode = false;
          state.ui.selected = {};
          state.prefs.lastExportAt = 0;
          savePrefs();
          save();
          dbClear();
          toast('已清空');
          render({ keepScroll: true });
        });
        break;
    }
  }

  function parsePaste() {
    var text = state.pasteText || '';
    if (!text.trim()) {
      toast('先粘贴一段文字');
      return;
    }
    var result = parseText(text);
    var d = state.draft;
    if (!d) return;
    var filled = [];
    if (result.title) { d.title = result.title; filled.push('标题'); }
    if (result.creator) { d.creator = result.creator; filled.push(d.type === 'novel' || d.type === 'comic' ? '作者' : '主创'); }
    if (result.year) { d.year = result.year; filled.push('年份'); }
    if (result.rating) { d.rating = result.rating; filled.push('评分'); }
    if (result.type) {
      d.type = result.type;
      if (result.type === 'magazine') {
        var im = parseIssueText(text);
        if (im) {
          d.magazine = normalizeMagazine(im, d.year);
          if (im.year) d.year = im.year;
          filled.push('刊期');
        }
      }
      filled.push('类型');
    }
    if (result.status) { d.status = result.status; filled.push('状态'); }
    if (result.tags && result.tags.length) {
      result.tags.forEach(function (t) {
        if (d.tags.indexOf(t) < 0) d.tags.push(t);
      });
      filled.push('标签');
    }
    if (!filled.length) {
      toast('没能识别出字段，手动填一下吧');
      return;
    }
    render({ keepScroll: true });
    toast('已识别：' + filled.join('、'));
  }

  function parseText(text) {
    var out = { tags: [] };
    var raw = String(text).replace(/\r/g, '');
    var lines = raw.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) return out;

    /* 评分 */
    var m = raw.match(/(?:豆瓣评分|评分|得分)\s*[:：]?\s*([0-9](?:\.[0-9])?)/);
    if (!m) m = raw.match(/([0-9](?:\.[0-9])?)\s*分/);
    if (!m) {
      for (var i = 0; i < lines.length; i++) {
        if (/^[0-9](?:\.[0-9])?$/.test(lines[i]) && parseFloat(lines[i]) <= 10) {
          m = [lines[i], lines[i]];
          break;
        }
      }
    }
    if (m) {
      var rv = parseFloat(m[1]);
      if (rv >= 0 && rv <= 10) out.rating = Math.round(rv * 2) / 2;
    }

    /* 年份 */
    var ym = raw.match(/(19|20)\d{2}/);
    if (ym) out.year = ym[0];

    /* 标题 */
    var first = lines[0].replace(/^《|》$/g, '').trim();
    if (/^[^：:]{1,6}[：:]/.test(first)) {
      first = '';
    }
    if (first && !/^\d+(\.\d+)?$/.test(first)) out.title = first.replace(/《|》/g, '').slice(0, 60);

    /* 主创 */
    var cm = raw.match(/(?:作者|导演|编剧|主演|著者|原作)\s*[:：]\s*([^\n/|]+)/);
    if (cm) {
      out.creator = cm[1].trim().slice(0, 40);
    } else {
      for (var j = 0; j < Math.min(lines.length, 4); j++) {
        if (lines[j].indexOf('/') > 0) {
          var seg = lines[j].split('/')[0].trim();
          if (seg && seg.length <= 24 && !/\d/.test(seg) && !/^《/.test(seg)) {
            out.creator = seg;
          }
          break;
        }
      }
    }

    /* 类型 */
    if (/期刊|杂志|月刊|周刊|半月刊|双月刊|季刊|期号|总第|[A-C]\s*刊/.test(raw)) out.type = 'magazine';
    else if (/电视剧|剧集|集数|追剧|第.{1,3}季/.test(raw)) out.type = 'tv';
    else if (/综艺|真人秀|脱口秀/.test(raw)) out.type = 'variety';
    else if (/动画电影|剧场版/.test(raw)) out.type = 'movie';
    else if (/动画|番剧|新番|声优|TV版/.test(raw)) out.type = 'anime';
    else if (/漫画|第.{1,3}话|卷数/.test(raw)) out.type = 'comic';
    else if (/电影|片长|上映|导演/.test(raw)) out.type = 'movie';
    else if (/小说|作者|出版社|字数/.test(raw)) out.type = 'novel';

    /* 状态 */
    var st = detectStatus(raw);
    if (st) out.status = st;

    /* 标签 */
    PRESET_TAGS.forEach(function (t) {
      if (raw.indexOf(t) >= 0) out.tags.push(t);
    });

    return out;
  }

  function filterQuoteCards(raw) {
    var q = String(raw || '').trim().toLowerCase();
    var cards = document.querySelectorAll('.qcard');
    var shown = 0;
    for (var i = 0; i < cards.length; i++) {
      var hay = cards[i].getAttribute('data-hay') || '';
      var ok = !q || hay.indexOf(q) >= 0;
      cards[i].classList.toggle('is-hidden', !ok);
      if (ok) shown++;
    }
    var count = document.getElementById('quote-count');
    if (count) count.textContent = shown + ' 条' + (q ? '（筛选自 ' + cards.length + '）' : '');
    var empty = document.getElementById('quote-empty');
    if (empty) empty.classList.toggle('hidden', shown > 0);
  }

  function bindEvents() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      if (el.tagName === 'A' && el.getAttribute('href')) return;
      handleAction(el.dataset.action, el);
    });

    document.addEventListener('input', function (e) {
      var el = e.target;

      if (el.id === 'global-search') {
        state.search = el.value;
        updateSearchPanel();
        return;
      }
      if (el.id === 'quote-search') {
        state.ui.quoteQ = el.value;
        filterQuoteCards(el.value);
        return;
      }
      if (el.id === 'paste-input') {
        state.pasteText = el.value;
        return;
      }
      if (el.id === 'tag-input') return;
      if (el.id === 'goal-count' || el.id === 'goal-hours') {
        var gv = Math.max(0, Math.floor(Number(el.value) || 0));
        if (el.id === 'goal-count') state.prefs.goalCount = gv;
        else state.prefs.goalHours = gv;
        savePrefs();
        return;
      }

      var f = el.dataset.field;
      if (f && state.draft) {
        if (f === 'rating') {
          state.draft.rating = parseFloat(el.value) || 0;
          var numEl = document.getElementById('rating-num');
          if (numEl) numEl.textContent = state.draft.rating ? state.draft.rating.toFixed(1) : '—';
          el.style.setProperty('--pct', (state.draft.rating * 10) + '%');
          return;
        }
        if (f === 'p.percent') {
          var pv = Math.max(0, Math.min(100, Math.round(Number(el.value) || 0)));
          state.draft.progress.percent = pv;
          var pn = document.getElementById('percent-num');
          if (pn) pn.textContent = pv + '%';
          el.style.setProperty('--pct', pv + '%');
          return;
        }
        setDraftField(f, el.value);
        return;
      }

      var rw = el.dataset.rw;
      if (rw && state.draft) {
        var w = state.draft.rewatches.filter(function (x) { return x.id === el.dataset.id; })[0];
        if (!w) return;
        if (rw === 'rating') w.rating = clampRating(el.value);
        else w[rw] = el.value;
        return;
      }

      if (el.dataset && el.dataset.sec && state.draft) {
        var secs = state.draft.sections || (state.draft.sections = {});
        secs[el.dataset.sec] = el.value;
        return;
      }

      if (el.dataset && el.dataset.note && state.draft) {
        var nt = (state.draft.notesLog || []).filter(function (x) { return x.id === el.dataset.id; })[0];
        if (!nt) return;
        nt[el.dataset.note] = el.value;
        return;
      }

      if (el.dataset && el.dataset.q && state.draft) {
        var qq = (state.draft.quotes || []).filter(function (x) { return x.id === el.dataset.id; })[0];
        if (!qq) return;
        qq[el.dataset.q] = el.value;
        return;
      }

      if (el.dataset && el.dataset.ep && state.draft) {
        var epId = el.dataset.id;
        var ep = (state.draft.episodes || []).filter(function (x) { return x.id === epId; })[0];
        if (!ep) return;
        var ek = el.dataset.ep;
        if (ek === 'no') ep.no = Math.max(0, Math.floor(Number(el.value) || 0));
        else if (ek === 'rating') ep.rating = clampRating(el.value);
        else ep[ek] = el.value;
        return;
      }

      if (el.dataset.season !== undefined && state.draft) {
        var sn = (state.draft.progress.segments || [])[Number(el.dataset.season)];
        if (!sn) return;
        if (el.dataset.sfield === 'current') sn.current = num(el.value);
        else if (el.dataset.sfield === 'total') sn.total = num(el.value);
      }
    });

    document.addEventListener('change', function (e) {
      var el = e.target;

      if (el.dataset && el.dataset.filter) {
        state.filters[el.dataset.filter] = el.value;
        render({ keepScroll: true });
        return;
      }
      if (el.dataset && el.dataset.report) {
        var k = el.dataset.report;
        state.report[k] = k === 'year' ? Number(el.value) : el.value;
        state.report.data = null;
        render({ keepScroll: true });
        return;
      }
      if (el.dataset && el.dataset.field && state.draft && el.tagName === 'SELECT') {
        setDraftField(el.dataset.field, el.value);
      }
      if (el.dataset && el.dataset.field === 'status' && state.draft) {
        state.draft.status = el.value;
        return;
      }
      if (el.dataset && el.dataset.seasonDone !== undefined && state.draft) {
        var sn = (state.draft.progress.segments || [])[Number(el.dataset.seasonDone)];
        if (!sn) return;
        sn.done = el.checked;
        if (sn.done && sn.total > 0) sn.current = sn.total;
        render({ keepScroll: true });
        return;
      }
      if (el.dataset && (el.dataset.field === 'startedAt' || el.dataset.field === 'finishedAt') && state.draft) {
        setDraftField(el.dataset.field, el.value);
        var hintEl = document.getElementById('date-hint');
        if (hintEl) hintEl.textContent = dateSpanHint(state.draft);
        return;
      }
      if (el.dataset && el.dataset.ep === 'date' && state.draft) {
        var ep2 = (state.draft.episodes || []).filter(function (x) { return x.id === el.dataset.id; })[0];
        if (ep2) ep2.date = el.value;
        return;
      }
      if (el.dataset && el.dataset.rw === 'date' && state.draft) {
        var w = state.draft.rewatches.filter(function (x) { return x.id === el.dataset.id; })[0];
        if (w) w.date = el.value;
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var el = e.target;
      if (el.id === 'tag-input') {
        e.preventDefault();
        var v = el.value.trim().slice(0, 16);
        if (!v || !state.draft) return;
        if (state.draft.tags.indexOf(v) < 0) state.draft.tags.push(v);
        el.value = '';
        render({ keepScroll: true });
        setTimeout(function () {
          var again = document.getElementById('tag-input');
          if (again) again.focus();
        }, 30);
      }
    });

    /* 卡片键盘可达 */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var el = e.target;
      if (el && el.getAttribute && el.getAttribute('role') === 'button' && el.dataset.action === 'open') {
        e.preventDefault();
        handleAction('open', el);
      }
    });

    /* 快捷键：/ 或 ⌘K 聚焦搜索，⌘↩ 保存 */
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

      if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K'))) {
        e.preventDefault();
        focusSearch();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (state.route.name === 'edit' || state.route.name === 'new') {
          e.preventDefault();
          saveDraft();
        }
        return;
      }
      if (e.key === 'Escape' && state.ui.selectMode) {
        exitSelect();
        render({ keepScroll: true });
      }
    });

    window.addEventListener('hashchange', onRouteChange);

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        if (state.prefs.theme === 'system') applyTheme();
      });
    }
  }

  /* ---------------- 启动 ---------------- */

  function init() {
    load();
    applyTheme();
    var now = new Date();
    state.timeline.y = now.getFullYear();
    state.timeline.m = now.getMonth();
    state.checkin.y = now.getFullYear();
    state.checkin.m = now.getMonth();

    var r = parseRoute();
    state.route = r;
    if (r.name === 'new') initDraft(null);
    else if (r.name === 'edit') initDraft(r.id);
    else state.draft = null;

    if (!state.route.name) state.route.name = 'home';

    render();
    bindEvents();
    registerSW();
    watchInstall();

    /* 切后台或关闭时，把缓存和数据库都强制落一次 */
    window.addEventListener('pagehide', function () { writeCacheNow(); flushWrite(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { writeCacheNow(); flushWrite(); }
    });
    readStorageInfo();
    initDB();

    /* 告诉 index.html 里的启动自检：已经正常跑起来了 */
    window.__BOOT_OK = true;
    var fix = document.getElementById('boot-fix');
    if (fix) fix.parentNode.removeChild(fix);
  }

  function probeServerVersion(force) {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') {
      return Promise.resolve('');
    }
    if (!force && state.serverSw) return Promise.resolve(state.serverSw);
    return fetch('sw.js?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        var m = txt.match(/VERSION\s*=\s*['"]([^'"]+)/);
        state.serverSw = m ? m[1] : '';
        return state.serverSw;
      })
      .catch(function () { return ''; });
  }

  function fmtBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }

  var storUsed = -1;   /* -1 表示还没读到 */
  var storQuota = 0;

  function fmtCount(n) {
    n = Math.floor(Number(n) || 0);
    if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + ' 亿';
    if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + ' 万';
    return String(n);
  }

  /* 抽样估算每条记录占多少字节（UTF-16，与存储计费口径一致） */
  function avgRecordBytes() {
    var list = state.records;
    if (!list || !list.length) return 2048;
    var n = Math.min(list.length, 100);
    var total = 0;
    for (var i = 0; i < n; i++) {
      try { total += JSON.stringify(list[i]).length * 2; } catch (e) { /* ignore */ }
    }
    var avg = total / n;
    return avg > 0 ? avg : 2048;
  }

  function readStorageInfo() {
    if (!navigator.storage || !navigator.storage.estimate) {
      storUsed = 0;
      storQuota = 0;
      return Promise.resolve();
    }
    try {
      return navigator.storage.estimate().then(function (e) {
        storUsed = (e && e.usage) ? e.usage : 0;
        storQuota = (e && e.quota) ? e.quota : 0;
      }).catch(function () { storUsed = 0; storQuota = 0; });
    } catch (err) {
      storUsed = 0;
      storQuota = 0;
      return Promise.resolve();
    }
  }

  /* 每次都按当前记录数现算，避免显示启动时的旧数字 */
  function storageTexts() {
    if (storUsed < 0) return ['读取中…', '读取中…'];
    if (!storQuota) return ['当前浏览器不支持读取', '—'];
    var pct = storUsed / storQuota * 100;
    var info = fmtBytes(storUsed) + ' / ' + fmtBytes(storQuota) +
      '（' + (pct < 0.1 ? '＜0.1' : pct.toFixed(1)) + '%）';
    var avg = avgRecordBytes();
    var maxRec = Math.floor(storQuota / avg);
    var cap = fmtCount(state.records.length) + ' 条 / 约 ' + fmtCount(maxRec) +
      ' 条（按每条约 ' + (avg / 1024).toFixed(1) + ' KB 估算）';
    return [info, cap];
  }

  function paintStorageInfo() {
    var el = document.getElementById('stor-info');
    var cap = document.getElementById('stor-cap');
    if (!el && !cap) return;
    var t = storageTexts();
    if (el) el.textContent = t[0];
    if (cap) cap.textContent = t[1];
    if (storUsed < 0) readStorageInfo().then(paintStorageInfo);
  }

  function paintServerVersion() {
    var el = document.getElementById('srv-ver');
    if (!el) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') {
      el.textContent = '本地文件';
      return;
    }
    probeServerVersion(false).then(function (v) {
      var box = document.getElementById('srv-ver');
      if (!box) return;
      if (!v) { box.textContent = '读取失败'; return; }
      box.textContent = v + (v === SW_VERSION ? '' : '（有新版）');
      box.style.color = v === SW_VERSION ? '' : 'var(--accent)';
    });
  }

  function checkUpdate() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
      toast('本地文件模式无法检查更新，请用网址打开');
      return;
    }
    toast('正在检查更新…');
    navigator.serviceWorker.getRegistration().then(function (reg) {
      var upd = reg ? reg.update() : Promise.resolve();
      return upd.then(function () { return probeServerVersion(true); }).then(function (v) {
        state.serverSw = v;
        paintServerVersion();
        if (reg && (reg.waiting || reg.installing)) {
          toast('发现新版本，正在切换…');
          if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          setTimeout(function () { location.reload(); }, 900);
          return;
        }
        if (v && v !== SW_VERSION) {
          toast('服务器已是 ' + v + '，正在刷新');
          setTimeout(function () { location.reload(); }, 700);
          return;
        }
        toast('已是最新版本 v' + APP_VERSION);
      });
    }).catch(function () {
      toast('检查失败，请确认网络');
    });
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

    /* 首次打开时没有 controller；之后新 SW 接管会自动刷新一次 */
    var hadController = !!navigator.serviceWorker.controller;
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || reloading) return;
      reloading = true;
      toast('已更新到新版本，正在刷新…');
      setTimeout(function () { location.reload(); }, 400);
    });

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        reg.addEventListener('updatefound', function () {
          var sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', function () {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              toast('新版本已就绪，正在切换…');
              if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
        /* 每次启动顺手检查一次，Safari 对后台更新不积极 */
        setTimeout(function () { reg.update().catch(function () {}); }, 2500);
      }).catch(function () { /* 忽略：可能被浏览器策略禁用 */ });
    });
  }

  var installPrompt = null;

  function isStandalone() {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    return window.navigator.standalone === true;
  }

  function watchInstall() {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      installPrompt = e;
      if (state.route.name === 'settings') render({ keepScroll: true });
    });
    window.addEventListener('appinstalled', function () {
      installPrompt = null;
      toast('已添加到桌面');
      if (state.route.name === 'settings') render({ keepScroll: true });
    });
  }

  function askInstall() {
    if (installPrompt) {
      installPrompt.prompt();
      var p = installPrompt;
      installPrompt = null;
      p.userChoice.then(function () { /* 用户选择后不打扰 */ });
      return;
    }
    openModal({
      title: '添加到主屏幕',
      desc: 'iPhone / iPad：用 Safari 打开本页，点底部的分享按钮，选择「添加到主屏幕」。Android Chrome：右上角菜单里选「安装应用」或「添加到主屏幕」。',
      actions: [{ label: '知道了', value: null, variant: 'primary' }]
    });
  }

  function focusSearch() {
    var el = document.getElementById('global-search');
    if (el) { el.focus(); el.select(); return; }
    location.hash = '#/home';
    setTimeout(function () {
      var again = document.getElementById('global-search');
      if (again) { again.focus(); again.select(); }
    }, 90);
  }

  init();

  /* 便于调试：控制台可用 */
  window.__shilu = { state: state, render: render, save: save };

})();
