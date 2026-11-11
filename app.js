/* ==========================================================
   次元簿 · 个人文娱记录
   纯前端 / localStorage / JSON 导入导出
   ========================================================== */
(function () {
  'use strict';

  /* ---------------- 常量 ---------------- */

  var SCHEMA_VERSION = 1;

  /* 每次发布改这里和 sw.js 的 VERSION（两者一起改） */
  var APP_VERSION = '1.58';
  var SW_VERSION = 'v59';
  var UI_KEY = 'shilu.ui.v1';              /* 只存主题/配色这类界面偏好 */
  var LEGACY_DB_KEY = 'shilu.db.v1';       /* v1.53 之前的记录缓存，仅用于迁移 */
  var LEGACY_PREF_KEY = 'shilu.prefs.v1';  /* v1.53 之前的偏好，仅用于迁移 */
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
      creator: '监督', creatorHint: '动画监督', color: '#45AFA0'
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
      creator: '主持人', creatorHint: '常驻主持', color: '#E8B33D'
    },
    drama: {
      label: '广播剧', mode: 'series', itemUnit: '集', segUnit: '季',
      creator: '出品方', creatorHint: '出品方或制作组', color: '#5C8BE8'
    },
    stage: {
      label: '舞台剧', mode: 'single',
      creator: '剧团 / 导演', creatorHint: '剧团或导演', color: '#D96A4A'
    },
    game: {
      label: '游戏', mode: 'percent',
      creator: '开发商', creatorHint: '开发工作室', color: '#5FB86B'
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

  /* 用户在设置里关掉的类型：不出现在类型栏、新增页、筛选项里，数据仍保留 */
  function typesOn() {
    var off = state.prefs.offTypes || {};
    var out = TYPE_KEYS.filter(function (k) { return !off[k]; });
    return out.length ? out : TYPE_KEYS.slice();
  }

  var MAG_EDITIONS = ['国内版', '港版', '台版', '日版', '韩版', '美版', '欧版', '其他'];
  var MAG_PARTS = ['A', 'B', 'C', '合刊', '增刊', '别册'];
  var MAG_FREQ = ['周刊', '旬刊', '半月刊', '月刊', '双月刊', '季刊', '不定期'];
  var META_KEYS = ['publisher', 'translator', 'platform', 'runtime', 'serialStatus', 'studio', 'country',
    'cv', 'venue', 'albumType', 'gameType', 'source', 'cast',
    'pages', 'words', 'isbn', 'volumes', 'screenwriter', 'watchPlace', 'playTime', 'completion', 'tracks',
    'binding', 'firstPlatform', 'magazineName', 'originalWork', 'artist', 'epCount', 'colorPages',
    'seriesComp', 'charDesign', 'season', 'channel', 'seasons', 'language', 'host', 'shows', 'seat',
    'achievements', 'genre', 'medium', 'cinema',
    'link', 'subtitle', 'series', 'price', 'format', 'composer', 'ageRating', 'imdb', 'discs',
    /* 各类型的细化字段 */
    'imprint', 'company', 'producer', 'themeSong', 'artDirector', 'musicProd', 'airWeekday',
    'chiefDirector', 'airTime', 'quarter', 'planner', 'postProd', 'updateCycle', 'lyricist',
    'arranger', 'ticketPrice', 'mcScore', 'engine', 'languages', 'chineseSupport', 'franchise',
    'buyPrice', 'buyDate', 'dlcCount', 'onlinePlayers', 'issn', 'organizer', 'bookSize',
    'postalCode', 'subscribeFrom', 'editionNo', 'printNo', 'script', 'awards', 'boxoffice',
    /* 第二轮细化 */
    'editor', 'adaptation', 'boxSet', 'readingDevice', 'serialFrom', 'serialTo', 'purchaseChannel',
    'special', 'colorDesign', 'storyboard', 'episodeDirector', 'soundDirector', 'officialSite',
    'production', 'airPeriod', 'broadcastEnd', 'basedOn', 'location', 'budget', 'premiere', 'aspect',
    'color', 'distributor', 'sequel', 'sponsor', 'recordPlace', 'seasonNo', 'segment', 'updateWeekday',
    'voiceDirector', 'soundEffect', 'posterDesign', 'stageManager', 'lighting', 'costume', 'tour',
    'achievementsTotal', 'controller', 'cloudSave', 'lastPlayed', 'releasePrice', 'historicLow',
    'version', 'releaseCountry', 'mvDirector', 'recordingStudio', 'mastering', 'trackList',
    'issueCount', 'columns', 'subscribeStart', 'subscribeEnd', 'gift',
    /* 第三轮细化 */
    'firstEdition', 'sheets', 'seriesNo', 'outOfPrint', 'firstPrint', 'limited',
    'animationDirector', 'mechaDesign', 'photoDirector', 'editing', 'airStart', 'airEnd',
    'themeArtist', 'shootYear', 'wrapDate', 'basedOnAuthor', 'postCredit', 'dubbing',
    'showFormat', 'insertSong', 'intermission', 'caption', 'merch', 'completionistHours',
    'modSupport', 'vrSupport', 'leadSingle', 'mvCount', 'copyright', 'subPrice',
    /* 第四轮细化 */
    'pubPlace', 'paper', 'illustrated', 'ebookPlatform', 'firstBonus', 'appendix',
    'planning', 'productionManager', 'keyAnimation', 'backgroundArt', 'webPlatform',
    'ratingShare', 'renewal', 'releaseRegion', 'languageVersion', 'screeningFormat',
    'productionCompany', 'exclusive', 'coverArtist', 'licensePlatform', 'playType',
    'presenter', 'dubLanguage', 'difficulty', 'albumLanguage', 'signed',
    'editorInChief', 'copies'];

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
  /* 每种类型的专属字段，按「作品 / 制作 / 我的」三组排 */
  /* 每种类型的专属字段，按「作品 / 制作 / 我的」三组排。
     与 creator（作者 / 导演 / 主持人…）重复的项不再单列，避免同一个信息填两遍。 */
  var EXTRA_FIELDS = {
    novel: [
      { key: 'publisher', label: '出版社', g: 'pub', placeholder: '重庆出版社' },
      { key: 'imprint', label: '出品方', g: 'pub', placeholder: '选填' },
      { key: 'subtitle', label: '副标题', g: 'pub', placeholder: '选填' },
      { key: 'series', label: '丛书 / 系列', g: 'pub', placeholder: '选填' },
      { key: 'editionNo', label: '版次', g: 'pub', placeholder: '第 1 版' },
      { key: 'printNo', label: '印次', g: 'pub', placeholder: '第 3 次印刷' },
      { key: 'pubPlace', label: '出版地', g: 'pub', placeholder: '北京' },
      { key: 'paper', label: '用纸', g: 'pub', placeholder: '轻型纸 / 胶版纸' },
      { key: 'illustrated', label: '插图', g: 'pub', options: ['有', '无', '少量'] },
      { key: 'firstEdition', label: '首版年份', g: 'pub', placeholder: '2008' },
      { key: 'sheets', label: '印张', g: 'pub', numeric: true, placeholder: '12.5' },
      { key: 'seriesNo', label: '丛书序号', g: 'pub', placeholder: '07' },
      { key: 'pages', label: '页数', g: 'pub', numeric: true, placeholder: '320' },
      { key: 'words', label: '字数（万）', g: 'pub', numeric: true, placeholder: '45' },
      { key: 'binding', label: '装帧', g: 'pub', options: ['平装', '精装', '线装', '电子版', '其他'] },
      { key: 'bookSize', label: '开本', g: 'pub', options: ['32 开', '大 32 开', '16 开', 'A5', 'B5', '其他'] },
      { key: 'price', label: '定价（元）', g: 'pub', numeric: true, placeholder: '59' },
      { key: 'isbn', label: 'ISBN', g: 'pub', placeholder: '978…', wide: true },
      { key: 'translator', label: '译者', g: 'prod', placeholder: '选填' },
      { key: 'editor', label: '责编', g: 'prod', placeholder: '选填' },
      { key: 'language', label: '原作语言', g: 'prod', placeholder: '汉语 / 日语' },
      { key: 'serialStatus', label: '连载状态', g: 'mine', options: ['已完结', '连载中', '暂停'] },
      { key: 'format', label: '阅读格式', g: 'mine', options: ['纸质', '电子书', '有声书', '混合'] },
      { key: 'source', label: '书籍来源', g: 'mine', options: ['购买', '借阅', '赠书', '图书馆', '电子书', '其他'] },
      { key: 'firstPlatform', label: '首发平台', g: 'mine', placeholder: '起点 / 晋江 / 实体书' },
      { key: 'ebookPlatform', label: '电子书平台', g: 'mine', placeholder: '微信读书 / Kindle' },
      { key: 'adaptation', label: '影视改编', g: 'mine', options: ['已改编', '改编中', '暂无'] },
      { key: 'outOfPrint', label: '在售情况', g: 'mine', options: ['在售', '绝版', '再版'] },
      { key: 'boxSet', label: '套装册数', g: 'mine', numeric: true, placeholder: '3' },
      { key: 'readingDevice', label: '阅读设备', g: 'mine', placeholder: 'Kindle / iPad / 纸质' },
      { key: 'awards', label: '获奖', g: 'mine', placeholder: '选填', wide: true }
    ],
    comic: [
      { key: 'magazineName', label: '连载杂志 / 平台', g: 'pub', placeholder: '少年 Jump / 哔哩哔哩漫画' },
      { key: 'publisher', label: '出版社', g: 'pub', placeholder: '选填' },
      { key: 'series', label: '丛书 / 系列', g: 'pub', placeholder: '选填' },
      { key: 'binding', label: '装帧', g: 'pub', options: ['平装', '精装', '其他'] },
      { key: 'firstPrint', label: '首刷年份', g: 'pub', placeholder: '2012' },
      { key: 'pages', label: '页数', g: 'pub', numeric: true, placeholder: '192' },
      { key: 'firstBonus', label: '首刷赠品', g: 'pub', placeholder: '明信片 / 书签' },
      { key: 'volumes', label: '总卷数', g: 'pub', numeric: true, placeholder: '24' },
      { key: 'epCount', label: '总话数', g: 'pub', numeric: true, placeholder: '260' },
      { key: 'colorPages', label: '彩页', g: 'pub', options: ['全彩', '部分彩页', '黑白'] },
      { key: 'bookSize', label: '开本', g: 'pub', options: ['32 开', '大 32 开', '16 开', 'A5', 'B5', '其他'] },
      { key: 'price', label: '定价（元）', g: 'pub', numeric: true, placeholder: '25' },
      { key: 'isbn', label: 'ISBN', g: 'pub', placeholder: '978…', wide: true },
      { key: 'originalWork', label: '原作', g: 'prod', placeholder: '选填' },
      { key: 'translator', label: '译者', g: 'prod', placeholder: '选填' },
      { key: 'language', label: '原作语言', g: 'prod', placeholder: '日语 / 汉语' },
      { key: 'serialStatus', label: '连载状态', g: 'mine', options: ['连载中', '已完结', '休载'] },
      { key: 'limited', label: '限定版', g: 'mine', options: ['有', '无'] },
      { key: 'appendix', label: '卷末附录', g: 'mine', placeholder: '选填' },
      { key: 'serialFrom', label: '连载开始', g: 'mine', date: true },
      { key: 'serialTo', label: '连载结束', g: 'mine', date: true },
      { key: 'source', label: '书籍来源', g: 'mine', options: ['购买', '借阅', '赠书', '图书馆', '电子书', '其他'] },
      { key: 'purchaseChannel', label: '购买渠道', g: 'mine', placeholder: '淘宝 / 漫展 / 日亚' },
      { key: 'adaptation', label: '动画化', g: 'mine', options: ['已动画化', '动画中', '暂无'] },
      { key: 'special', label: '特典', g: 'mine', placeholder: '选填' },
      { key: 'awards', label: '获奖', g: 'mine', placeholder: '选填', wide: true }
    ],
    anime: [
      { key: 'studio', label: '动画制作', g: 'prod', placeholder: 'MADHOUSE / 京都动画' },
      { key: 'seriesComp', label: '系列构成', g: 'prod', placeholder: '选填' },
      { key: 'script', label: '脚本', g: 'prod', placeholder: '选填' },
      { key: 'charDesign', label: '角色设计', g: 'prod', placeholder: '选填' },
      { key: 'artDirector', label: '美术监督', g: 'prod', placeholder: '选填' },
      { key: 'colorDesign', label: '色彩设计', g: 'prod', placeholder: '选填' },
      { key: 'storyboard', label: '分镜', g: 'prod', placeholder: '选填' },
      { key: 'episodeDirector', label: '演出', g: 'prod', placeholder: '选填' },
      { key: 'soundDirector', label: '音响监督', g: 'prod', placeholder: '选填' },
      { key: 'animationDirector', label: '总作画监督', g: 'prod', placeholder: '选填' },
      { key: 'mechaDesign', label: '机械设定', g: 'prod', placeholder: '选填' },
      { key: 'photoDirector', label: '摄影监督', g: 'prod', placeholder: '选填' },
      { key: 'editing', label: '剪辑', g: 'prod', placeholder: '选填' },
      { key: 'planning', label: '企划', g: 'prod', placeholder: '选填' },
      { key: 'productionManager', label: '制作管理', g: 'prod', placeholder: '选填' },
      { key: 'keyAnimation', label: '原画', g: 'prod', placeholder: '选填' },
      { key: 'backgroundArt', label: '背景美术', g: 'prod', placeholder: '选填' },
      { key: 'composer', label: '配乐', g: 'prod', placeholder: '选填' },
      { key: 'musicProd', label: '音乐制作', g: 'prod', placeholder: '选填' },
      { key: 'originalWork', label: '原作', g: 'prod', placeholder: '选填' },
      { key: 'season', label: '放送季度', g: 'pub', placeholder: '2024 春 / 2024 秋' },
      { key: 'airWeekday', label: '放送星期', g: 'pub', options: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
      { key: 'airStart', label: '放送开始', g: 'pub', date: true },
      { key: 'airEnd', label: '放送结束', g: 'pub', date: true },
      { key: 'epCount', label: '总话数', g: 'pub', numeric: true, placeholder: '12' },
      { key: 'runtime', label: '单集时长（分钟）', g: 'pub', numeric: true, placeholder: '24' },
      { key: 'ageRating', label: '分级', g: 'pub', options: ['全年龄', '12+', '15+', '17+', '18+'] },
      { key: 'officialSite', label: '官方网站', g: 'pub', placeholder: 'https://…', wide: true },
      { key: 'themeArtist', label: '主题歌演唱', g: 'mine', placeholder: '选填' },
      { key: 'platform', label: '放送平台', g: 'mine', placeholder: 'B 站 / Netflix …' },
      { key: 'themeSong', label: '主题曲', g: 'mine', placeholder: '选填' },
      { key: 'production', label: '制作协力', g: 'mine', placeholder: '选填' },
      { key: 'cast', label: '主役声优', g: 'prod', placeholder: '用顿号分隔', wide: true }
    ],
    tv: [
      { key: 'channel', label: '电视台 / 出品方', g: 'pub', placeholder: 'HBO / 正午阳光' },
      { key: 'seasons', label: '季数', g: 'pub', numeric: true, placeholder: '3' },
      { key: 'epCount', label: '总集数', g: 'pub', numeric: true, placeholder: '24' },
      { key: 'runtime', label: '单集时长（分钟）', g: 'pub', numeric: true, placeholder: '45' },
      { key: 'country', label: '国家 / 地区', g: 'pub', placeholder: '中国大陆' },
      { key: 'language', label: '语言', g: 'pub', placeholder: '汉语普通话' },
      { key: 'ageRating', label: '分级', g: 'pub', options: ['全年龄', '12+', '15+', '17+', '18+'] },
      { key: 'airPeriod', label: '播出时段', g: 'pub', placeholder: '黄金档 / 深夜档' },
      { key: 'broadcastEnd', label: '播毕日期', g: 'pub', date: true },
      { key: 'shootYear', label: '拍摄年份', g: 'pub', placeholder: '2023' },
      { key: 'wrapDate', label: '杀青日期', g: 'pub', date: true },
      { key: 'webPlatform', label: '网络平台', g: 'pub', placeholder: '爱奇艺 / 腾讯视频' },
      { key: 'ratingShare', label: '收视率', g: 'pub', placeholder: '2.4%' },
      { key: 'renewal', label: '续订情况', g: 'pub', options: ['已续订', '待定', '已完结'] },
      { key: 'company', label: '出品公司', g: 'prod', placeholder: '选填' },
      { key: 'screenwriter', label: '编剧', g: 'prod', placeholder: '选填' },
      { key: 'producer', label: '制片人', g: 'prod', placeholder: '选填' },
      { key: 'composer', label: '配乐', g: 'prod', placeholder: '选填' },
      { key: 'themeSong', label: '主题曲', g: 'prod', placeholder: '选填' },
      { key: 'basedOn', label: '原著', g: 'prod', placeholder: '选填' },
      { key: 'basedOnAuthor', label: '原著作者', g: 'prod', placeholder: '选填' },
      { key: 'platform', label: '观看平台', g: 'mine', placeholder: '爱奇艺 / Netflix …' },
      { key: 'location', label: '拍摄地', g: 'mine', placeholder: '选填' },
      { key: 'awards', label: '获奖', g: 'mine', placeholder: '选填', wide: true },
      { key: 'cast', label: '主演', g: 'prod', placeholder: '用顿号分隔', wide: true }
    ],
    movie: [
      { key: 'runtime', label: '片长（分钟）', g: 'pub', numeric: true, placeholder: '120' },
      { key: 'country', label: '制片国家 / 地区', g: 'pub', placeholder: '中国大陆 / 日本' },
      { key: 'language', label: '语言', g: 'pub', placeholder: '汉语普通话' },
      { key: 'ageRating', label: '分级', g: 'pub', options: ['全年龄', '12+', '15+', '17+', '18+'] },
      { key: 'imdb', label: 'IMDb', g: 'pub', placeholder: 'tt0111161' },
      { key: 'boxoffice', label: '票房', g: 'pub', placeholder: '全球 6.7 亿美元' },
      { key: 'budget', label: '制作成本', g: 'pub', placeholder: '1.65 亿美元' },
      { key: 'premiere', label: '首映日期', g: 'pub', date: true },
      { key: 'aspect', label: '画幅', g: 'pub', placeholder: '2.39:1' },
      { key: 'color', label: '色彩', g: 'pub', options: ['彩色', '黑白', '部分黑白'] },
      { key: 'postCredit', label: '片尾彩蛋', g: 'pub', options: ['有', '无'] },
      { key: 'releaseRegion', label: '上映地区', g: 'pub', placeholder: '中国大陆 / 北美' },
      { key: 'languageVersion', label: '语言版本', g: 'pub', placeholder: '原声 / 国语配音' },
      { key: 'screeningFormat', label: '放映格式', g: 'pub', options: ['2D', '3D', 'IMAX', '杜比影院', '其他'] },
      { key: 'screenwriter', label: '编剧', g: 'prod', placeholder: '选填' },
      { key: 'producer', label: '制片人', g: 'prod', placeholder: '选填' },
      { key: 'company', label: '出品公司', g: 'prod', placeholder: '选填' },
      { key: 'composer', label: '配乐', g: 'prod', placeholder: '选填' },
      { key: 'themeSong', label: '主题曲', g: 'prod', placeholder: '选填' },
      { key: 'distributor', label: '发行公司', g: 'prod', placeholder: '选填' },
      { key: 'basedOn', label: '原著', g: 'prod', placeholder: '选填' },
      { key: 'franchise', label: '系列', g: 'prod', placeholder: '选填' },
      { key: 'dubbing', label: '配音', g: 'prod', placeholder: '选填' },
      { key: 'location', label: '拍摄地', g: 'prod', placeholder: '选填' },
      { key: 'watchPlace', label: '观看方式', g: 'mine', options: ['影院', '流媒体', '下载', '电视', '飞机', '其他'] },
      { key: 'cinema', label: '影院 / 平台', g: 'mine', placeholder: '万达影城 / Netflix' },
      { key: 'sequel', label: '续集', g: 'mine', placeholder: '选填' },
      { key: 'awards', label: '获奖', g: 'mine', placeholder: '选填', wide: true },
      { key: 'cast', label: '主演', g: 'prod', placeholder: '用顿号分隔', wide: true }
    ],
    variety: [
      { key: 'channel', label: '电视台 / 平台', g: 'pub', placeholder: '湖南卫视 / 芒果 TV' },
      { key: 'epCount', label: '总期数', g: 'pub', numeric: true, placeholder: '12' },
      { key: 'runtime', label: '单期时长（分钟）', g: 'pub', numeric: true, placeholder: '90' },
      { key: 'quarter', label: '季度', g: 'pub', options: ['第 1 季度', '第 2 季度', '第 3 季度', '第 4 季度'] },
      { key: 'seasonNo', label: '第几季', g: 'pub', numeric: true, placeholder: '3' },
      { key: 'airTime', label: '播出时间', g: 'pub', placeholder: '每周五 20:00' },
      { key: 'showFormat', label: '节目形式', g: 'pub', placeholder: '棚内 / 户外 / 竞演' },
      { key: 'productionCompany', label: '制作公司', g: 'prod', placeholder: '选填' },
      { key: 'exclusive', label: '播出方式', g: 'pub', options: ['独播', '联播'] },
      { key: 'chiefDirector', label: '总导演', g: 'prod', placeholder: '选填' },
      { key: 'screenwriter', label: '编剧', g: 'prod', placeholder: '选填' },
      { key: 'studio', label: '制作团队', g: 'prod', placeholder: '选填' },
      { key: 'sponsor', label: '冠名商', g: 'mine', placeholder: '选填' },
      { key: 'recordPlace', label: '录制地', g: 'mine', placeholder: '选填' },
      { key: 'segment', label: '常驻环节', g: 'mine', placeholder: '选填' },
      { key: 'awards', label: '获奖', g: 'mine', placeholder: '选填' },
      { key: 'cast', label: '常驻嘉宾', g: 'prod', placeholder: '用顿号分隔', wide: true }
    ],
    drama: [
      { key: 'epCount', label: '总集数', g: 'pub', numeric: true, placeholder: '12' },
      { key: 'runtime', label: '单集时长（分钟）', g: 'pub', numeric: true, placeholder: '30' },
      { key: 'updateCycle', label: '更新周期', g: 'pub', options: ['每周', '双周', '不定期', '已完结'] },
      { key: 'originalWork', label: '原作', g: 'prod', placeholder: '选填' },
      { key: 'studio', label: '制作组', g: 'prod', placeholder: '选填' },
      { key: 'screenwriter', label: '编剧', g: 'prod', placeholder: '选填' },
      { key: 'planner', label: '策划', g: 'prod', placeholder: '选填' },
      { key: 'voiceDirector', label: '配音导演', g: 'prod', placeholder: '选填' },
      { key: 'postProd', label: '后期', g: 'prod', placeholder: '选填' },
      { key: 'soundEffect', label: '音效', g: 'prod', placeholder: '选填' },
      { key: 'themeSong', label: '主题曲', g: 'prod', placeholder: '选填' },
      { key: 'insertSong', label: '插曲', g: 'prod', placeholder: '选填' },
      { key: 'coverArtist', label: '封面绘制', g: 'prod', placeholder: '选填' },
      { key: 'licensePlatform', label: '授权平台', g: 'mine', placeholder: '猫耳 / 漫播' },
      { key: 'composer', label: '配乐', g: 'prod', placeholder: '选填' },
      { key: 'platform', label: '收听平台', g: 'mine', placeholder: '猫耳 FM / M 站' },
      { key: 'posterDesign', label: '海报设计', g: 'mine', placeholder: '选填' },
      { key: 'awards', label: '获奖', g: 'mine', placeholder: '选填' },
      { key: 'cv', label: '主役声优', g: 'prod', placeholder: '用顿号分隔', wide: true }
    ],
    stage: [
      { key: 'venue', label: '剧场 / 城市', g: 'pub', placeholder: '上海文化广场' },
      { key: 'shows', label: '场次', g: 'pub', numeric: true, placeholder: '第 3 场' },
      { key: 'runtime', label: '时长（分钟）', g: 'pub', numeric: true, placeholder: '150' },
      { key: 'tour', label: '巡演城市', g: 'pub', placeholder: '北京 / 上海 / 广州' },
      { key: 'screenwriter', label: '编剧', g: 'prod', placeholder: '选填' },
      { key: 'composer', label: '作曲', g: 'prod', placeholder: '选填' },
      { key: 'stageManager', label: '舞台监督', g: 'prod', placeholder: '选填' },
      { key: 'lighting', label: '灯光', g: 'prod', placeholder: '选填' },
      { key: 'costume', label: '服装', g: 'prod', placeholder: '选填' },
      { key: 'intermission', label: '中场休息', g: 'pub', options: ['有', '无'] },
      { key: 'caption', label: '字幕', g: 'pub', options: ['有', '无'] },
      { key: 'playType', label: '剧目类型', g: 'pub', options: ['话剧', '音乐剧', '舞剧', '儿童剧', '戏曲', '其他'] },
      { key: 'presenter', label: '主办方', g: 'pub', placeholder: '选填' },
      { key: 'merch', label: '周边', g: 'mine', placeholder: '场刊 / 立牌 / 徽章' },
      { key: 'seat', label: '座位', g: 'mine', placeholder: '池座 5 排 12 号' },
      { key: 'ticketPrice', label: '票价（元）', g: 'mine', numeric: true, placeholder: '380' },
      { key: 'awards', label: '获奖', g: 'mine', placeholder: '选填' },
      { key: 'cast', label: '主演', g: 'prod', placeholder: '用顿号分隔', wide: true }
    ],
    game: [
      { key: 'platform', label: '平台', g: 'pub', placeholder: 'PC / PS5 / Switch' },
      { key: 'gameType', label: '类型', g: 'pub', options: ['单机', '手游', '主机', '网页', '独立', '其他'] },
      { key: 'franchise', label: '所属系列', g: 'pub', placeholder: '选填' },
      { key: 'mcScore', label: 'MC 媒体评分', g: 'pub', numeric: true, placeholder: '92' },
      { key: 'dlcCount', label: 'DLC 数', g: 'pub', numeric: true, placeholder: '0' },
      { key: 'onlinePlayers', label: '联机人数', g: 'pub', numeric: true, placeholder: '1' },
      { key: 'ageRating', label: '分级', g: 'pub', options: ['全年龄', '12+', '15+', '17+', '18+'] },
      { key: 'chineseSupport', label: '中文支持', g: 'pub', options: ['简体中文', '繁体中文', '简繁都有', '无中文'] },
      { key: 'publisher', label: '发行商', g: 'prod', placeholder: '选填' },
      { key: 'engine', label: '游戏引擎', g: 'prod', placeholder: 'Unity / Unreal' },
      { key: 'languages', label: '支持语言', g: 'pub', placeholder: '中 / 英 / 日', wide: true },
      { key: 'playTime', label: '通关时长（小时）', g: 'mine', numeric: true, placeholder: '35' },
      { key: 'completionistHours', label: '全成就时长（小时）', g: 'mine', numeric: true, placeholder: '80' },
      { key: 'completion', label: '通关情况', g: 'mine', options: ['主线通关', '全成就', '未通关', '云通关'] },
      { key: 'achievements', label: '成就 / 奖杯', g: 'mine', placeholder: '42/50' },
      { key: 'achievementsTotal', label: '成就总数', g: 'mine', numeric: true, placeholder: '50' },
      { key: 'controller', label: '手柄支持', g: 'mine', options: ['完整支持', '部分支持', '不支持'] },
      { key: 'cloudSave', label: '云存档', g: 'mine', options: ['支持', '不支持'] },
      { key: 'modSupport', label: 'Mod 支持', g: 'mine', options: ['支持', '不支持', '部分'] },
      { key: 'vrSupport', label: 'VR 支持', g: 'mine', options: ['支持', '不支持'] },
      { key: 'dubLanguage', label: '配音语言', g: 'mine', placeholder: '中配 / 日配' },
      { key: 'difficulty', label: '难度', g: 'mine', options: ['休闲', '普通', '困难', '地狱'] },
      { key: 'lastPlayed', label: '最后游玩', g: 'mine', date: true },
      { key: 'buyPrice', label: '购入价格（元）', g: 'mine', numeric: true, placeholder: '298' },
      { key: 'releasePrice', label: '发售价（元）', g: 'mine', numeric: true, placeholder: '298' },
      { key: 'historicLow', label: '史低价格（元）', g: 'mine', numeric: true, placeholder: '99' },
      { key: 'buyDate', label: '购买日期', g: 'mine', date: true }
    ],
    music: [
      { key: 'albumType', label: '类型', g: 'pub', options: ['专辑', '单曲', 'EP', 'OST', 'Live', '合集'] },
      { key: 'genre', label: '流派', g: 'pub', placeholder: '流行 / 摇滚 / 电子' },
      { key: 'tracks', label: '曲目数', g: 'pub', numeric: true, placeholder: '12' },
      { key: 'discs', label: '唱片数', g: 'pub', numeric: true, placeholder: '1' },
      { key: 'runtime', label: '总时长（分钟）', g: 'pub', numeric: true, placeholder: '48' },
      { key: 'medium', label: '介质', g: 'pub', options: ['数字', 'CD', '黑胶', '磁带'] },
      { key: 'publisher', label: '发行厂牌', g: 'pub', placeholder: '选填' },
      { key: 'version', label: '版本', g: 'pub', options: ['首版', '再版', '纪念版', '引进版'] },
      { key: 'releaseCountry', label: '发行地区', g: 'pub', placeholder: '中国 / 日本' },
      { key: 'lyricist', label: '作词', g: 'prod', placeholder: '选填' },
      { key: 'composer', label: '作曲', g: 'prod', placeholder: '选填' },
      { key: 'arranger', label: '编曲', g: 'prod', placeholder: '选填' },
      { key: 'producer', label: '制作人', g: 'prod', placeholder: '选填' },
      { key: 'mvDirector', label: 'MV 导演', g: 'prod', placeholder: '选填' },
      { key: 'recordingStudio', label: '录音室', g: 'prod', placeholder: '选填' },
      { key: 'mastering', label: '母带', g: 'prod', placeholder: '选填' },
      { key: 'leadSingle', label: '首支单曲', g: 'prod', placeholder: '选填' },
      { key: 'albumLanguage', label: '专辑语种', g: 'pub', placeholder: '国语 / 日语 / 英语' },
      { key: 'signed', label: '签名版', g: 'mine', options: ['有', '无'] },
      { key: 'mvCount', label: 'MV 数', g: 'mine', numeric: true, placeholder: '3' },
      { key: 'copyright', label: '版权方', g: 'mine', placeholder: '选填' },
      { key: 'price', label: '定价（元）', g: 'mine', numeric: true, placeholder: '128' },
      { key: 'platform', label: '收听平台', g: 'mine', placeholder: '网易云 / Spotify' },
      { key: 'awards', label: '获奖', g: 'mine', placeholder: '选填' },
      { key: 'trackList', label: '曲目列表', g: 'mine', placeholder: '每行一首，或用顿号分隔', wide: true }
    ],
    magazine: [
      { key: 'serialStatus', label: '刊期状态', g: 'pub', options: ['在刊', '休刊', '停刊'] },
      { key: 'issn', label: 'ISSN', g: 'pub', placeholder: '1000-0000' },
      { key: 'organizer', label: '主办单位', g: 'pub', placeholder: '选填' },
      { key: 'pages', label: '页数', g: 'pub', numeric: true, placeholder: '128' },
      { key: 'bookSize', label: '开本', g: 'pub', options: ['16 开', '大 16 开', 'A4', 'A5', '其他'] },
      { key: 'language', label: '语言', g: 'pub', placeholder: '汉语' },
      { key: 'postalCode', label: '邮发代号', g: 'pub', placeholder: '2-123' },
      { key: 'issueCount', label: '已收期数', g: 'pub', numeric: true, placeholder: '36' },
      { key: 'columns', label: '常看栏目', g: 'pub', placeholder: '选填' },
      { key: 'editorInChief', label: '主编', g: 'pub', placeholder: '选填' },
      { key: 'copies', label: '订阅份数', g: 'mine', numeric: true, placeholder: '1' },
      { key: 'subPrice', label: '订阅价（元/年）', g: 'mine', numeric: true, placeholder: '240' },
      { key: 'price', label: '定价（元）', g: 'mine', numeric: true, placeholder: '20' },
      { key: 'subscribeFrom', label: '订阅渠道', g: 'mine', options: ['邮局', '报刊亭', '官网', '电商', '电子版', '其他'] },
      { key: 'subscribeStart', label: '订阅起始', g: 'mine', date: true },
      { key: 'subscribeEnd', label: '订阅到期', g: 'mine', date: true },
      { key: 'gift', label: '赠品', g: 'mine', placeholder: '选填' }
    ]
  };

  var STATUSES = { wish: '愿望单', doing: '进行中', done: '已完成', paused: '搁置' };
  var STATUS_KEYS = ['wish', 'doing', 'done', 'paused'];

  /* 每种类型的四个状态各有各的叫法：内部仍是 wish/doing/done/paused，
     只是换一套贴切的词，筛选、看板、卡片、导出统一走这套 */
  var TYPE_STATUS = {
    novel: { wish: '想读', doing: '在读', done: '读完', paused: '弃读' },
    comic: { wish: '想读', doing: '在读', done: '读完', paused: '弃读' },
    anime: { wish: '想看', doing: '在追', done: '看完', paused: '弃番' },
    tv: { wish: '想看', doing: '在追', done: '看完', paused: '弃剧' },
    movie: { wish: '想看', doing: '在看', done: '看过', paused: '弃看' },
    variety: { wish: '想看', doing: '在追', done: '看完', paused: '弃追' },
    drama: { wish: '想听', doing: '在听', done: '听完', paused: '弃听' },
    stage: { wish: '想看', doing: '在看', done: '看过', paused: '弃看' },
    game: { wish: '想玩', doing: '在玩', done: '已通关', paused: '弃坑' },
    music: { wish: '想听', doing: '在听', done: '听过', paused: '弃听' },
    magazine: { wish: '想订', doing: '在追', done: '已收齐', paused: '弃订' }
  };

  function statusLabel(type, key) {
    var m = TYPE_STATUS[type];
    if (m && m[key]) return m[key];
    return STATUSES[key] || key;
  }

  /* 单条记录用：游戏打完且全成就时显示「全成就」，比「已通关」更准 */
  function statusLabelFor(r) {
    if (!r) return '';
    if (r.type === 'game' && r.status === 'done' && r.meta && r.meta.completion === '全成就') return '全成就';
    return statusLabel(r.type, r.status);
  }

  /* 新增 / 编辑表单的字段叫法：每种类型一套，不再共用一个模板 */
  var TYPE_FORM = {
    novel: { release: '出版日期', verb: '出版', score: '豆瓣评分', start: '开始读', finish: '读完', hours: '阅读时长（小时）', run: '遍', again: '重读' },
    comic: { release: '出版日期', verb: '出版', score: '豆瓣评分', start: '开始看', finish: '看完', hours: '阅读时长（小时）', run: '遍', again: '重读' },
    anime: { release: '首播日期', verb: '首播', score: '豆瓣评分', start: '开始看', finish: '看完', hours: '观看时长（小时）', run: '刷', again: '重看' },
    tv: { release: '首播日期', verb: '首播', score: '豆瓣评分', start: '开始看', finish: '看完', hours: '观看时长（小时）', run: '刷', again: '重看' },
    movie: { release: '上映日期', verb: '上映', score: '豆瓣评分', start: '', finish: '观看日期', hours: '观影时长（小时）', run: '刷', again: '重看', single: true },
    variety: { release: '首播日期', verb: '首播', score: '豆瓣评分', start: '开始看', finish: '看完', hours: '观看时长（小时）', run: '刷', again: '重看' },
    drama: { release: '上线日期', verb: '上线', score: '豆瓣评分', start: '开始听', finish: '听完', hours: '收听时长（小时）', run: '遍', again: '重听' },
    stage: { release: '首演日期', verb: '首演', score: '豆瓣评分', start: '', finish: '观演日期', hours: '观演时长（小时）', run: '刷', again: '重看', single: true },
    game: { release: '发行日期', verb: '发行', score: '媒体评分', start: '开始玩', finish: '通关日期', hours: '游玩时长（小时）', run: '周目', again: '重玩' },
    music: { release: '发行日期', verb: '发行', score: '豆瓣评分', start: '', finish: '收听日期', hours: '收听时长（小时）', run: '遍', again: '重听', single: true },
    magazine: { release: '出版日期', verb: '出版', score: '', start: '开始收', finish: '收齐日期', hours: '翻阅时长（小时）', run: '遍', again: '重翻' }
  };

  function formOf(type) {
    return TYPE_FORM[type] || TYPE_FORM.novel;
  }

  var TYPE_TIMES = {
    novel: '阅读次数', comic: '阅读次数', anime: '观看次数', tv: '观看次数',
    movie: '观看次数', variety: '观看次数', drama: '收听次数', stage: '观看次数',
    game: '游玩周目', music: '收听次数', magazine: '翻阅次数'
  };
  for (var _tk in TYPE_FORM) {
    if (TYPE_FORM.hasOwnProperty(_tk)) TYPE_FORM[_tk].times = TYPE_TIMES[_tk] || '观看次数';
  }

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
    board: '<rect x="3" y="4" width="5" height="16" rx="2"/><rect x="9.5" y="4" width="5" height="11" rx="2"/><rect x="16" y="4" width="5" height="16" rx="2"/>',
    image: '<rect x="3.4" y="4.4" width="17.2" height="15.2" rx="3"/><circle cx="8.7" cy="9.7" r="1.6"/><path d="m4.4 17.6 4.9-4.9 3.3 3.3 2.6-2.6 4.4 4.4"/>',
    trophy: '<path d="M8 4h8v3.6a4 4 0 0 1-8 0z"/><path d="M8 5.2H5.4v1.4A3 3 0 0 0 8 9.6M16 5.2h2.6v1.4A3 3 0 0 1 16 9.6"/><path d="M12 11.6v4.2M9 20h6M9.8 15.8h4.4l.6 4.2H9.2z"/>',
    flame: '<path d="M12 3s5 4.3 5 8.7A5 5 0 0 1 7 11.7C7 7.3 12 3 12 3z"/><path d="M12 20.6a2.9 2.9 0 0 0 2.9-2.9c0-2-2.9-4.3-2.9-4.3s-2.9 2.3-2.9 4.3a2.9 2.9 0 0 0 2.9 2.9z"/>',
    clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.2 2"/>',
    star: '<path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9L3.5 9.8l5.9-.8z"/>',
    layers: '<path d="M12 3.6 3.6 8l8.4 4.4L20.4 8z"/><path d="m3.6 12.6 8.4 4.4 8.4-4.4"/><path d="m3.6 16.9 8.4 4.4 8.4-4.4"/>',
    crown: '<path d="M3.4 8.2 7 12l5-7.4 5 7.4 3.6-3.8v9.4a1.4 1.4 0 0 1-1.4 1.4H4.8a1.4 1.4 0 0 1-1.4-1.4z"/><path d="M3.4 17.4h17.2"/>',
    diamond: '<path d="M12 3.4 20.6 9 12 20.6 3.4 9z"/><path d="M3.4 9h17.2M12 3.4 8.4 9l3.6 11.6L15.6 9z"/>',
    medal: '<path d="M7.4 3h3.2l1.4 5M16.6 3h-3.2l-1.4 5"/><circle cx="12" cy="15.2" r="5.4"/><path d="m12 12.6.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>',
    feather: '<path d="M20 4.4c-4.4-.6-8.4.8-10.6 3S6 13 6.4 15.6l4.2-4.2"/><path d="M4 20.2c1-3.4 3-6.2 6-8"/><path d="M13.6 10.6h3.8M12.4 13.4h3"/>',
    book: '<path d="M4 4.6h6.2a2 2 0 0 1 1.8 1.1 2 2 0 0 1 1.8-1.1H20v13.2h-6.2a2 2 0 0 0-1.8 1.1 2 2 0 0 0-1.8-1.1H4z"/><path d="M12 5.7v13.2"/>',
    ticket: '<path d="M3.5 8.4a1.9 1.9 0 0 0 0 3.8v3.9a1.4 1.4 0 0 0 1.4 1.4h14.2a1.4 1.4 0 0 0 1.4-1.4v-3.9a1.9 1.9 0 0 1 0-3.8V5.9a1.4 1.4 0 0 0-1.4-1.4H4.9a1.4 1.4 0 0 0-1.4 1.4z"/><path d="M14.6 6.2v2M14.6 10.6v2M14.6 15v2"/>',
    stamp: '<path d="M6.2 3.6h11.6v5.2a2.4 2.4 0 0 0 0 4.8v4.8H6.2v-4.8a2.4 2.4 0 0 0 0-4.8z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    sound: '<path d="M4 9.4h3.2L12 5.6v12.8L7.2 14.6H4z"/><path d="M15.4 9a4 4 0 0 1 0 6M17.8 6.6a7.4 7.4 0 0 1 0 10.8"/>',
    mute: '<path d="M4 9.4h3.2L12 5.6v12.8L7.2 14.6H4z"/><path d="m15.6 9.6 4.4 4.4M20 9.6l-4.4 4.4"/>',
    'chevron-left': '<path d="m14.6 5.6-6.4 6.4 6.4 6.4"/>',
    'chevron-right': '<path d="m9.4 5.6 6.4 6.4-6.4 6.4"/>',
    pen: '<path d="M4 20.2 8 19l10.6-10.6a2.2 2.2 0 0 0-3.1-3.1L4.9 16z"/><path d="m14.4 7.6 2.9 2.9"/>',
    moon: '<path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.6 8.6 0 1 0 20 14.4z"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6"/>',

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
    var v = String(url || '');
    if (/^https?:\/\//i.test(v)) return v;
    if (/^data:image\//i.test(v)) return v;
    if (/^img:[A-Za-z0-9_]+$/.test(v)) return v;
    return '';
  }

  /* ---------------- 本地图片库 ---------------- */
  /* 图片单独存在 IndexedDB 的 images 表里，记录里只存 img:<id>，
     这样记录本身很小，导出/缓存都不会被图片撑爆。 */

  var IMG = {};             /* id -> Blob（兼容旧的 dataURL 字符串） */
  var IMG_URL = {};         /* id -> objectURL，按需生成 */
  var IMG_MISSING = {};     /* 已知取不到的 id，避免反复查库 */

  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      try {
        var fr = new FileReader();
        fr.onload = function () { resolve(String(fr.result || '')); };
        fr.onerror = function () { reject(fr.error || new Error('read')); };
        fr.readAsDataURL(blob);
      } catch (e) { reject(e); }
    });
  }

  function dataURLToBlob(dataURL) {
    try {
      var parts = String(dataURL).split(',');
      var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
      var bin = atob(parts[1] || '');
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } catch (e) { return null; }
  }

  /* 导出时统一转回 dataURL；ZIP 备份直接用 Blob，不转 */
  function imageDataURL(id) {
    var v = IMG[id];
    if (!v) return Promise.resolve('');
    if (typeof v === 'string') return Promise.resolve(v);
    return blobToDataURL(v);
  }

  function coverSrc(cover) {
    if (!cover) return '';
    if (cover.indexOf('img:') !== 0) return cover;
    var id = cover.slice(4);
    var v = IMG[id];
    if (!v) return '';
    if (typeof v === 'string') return v;   /* 旧数据还没升级成 Blob */
    if (IMG_URL[id]) return IMG_URL[id];
    try {
      IMG_URL[id] = URL.createObjectURL(v);
      return IMG_URL[id];
    } catch (e) { return ''; }
  }

  function loadImages() {
    return AppStorage.getAllImages().then(function (rows) {
      var n = 0;
      (rows || []).forEach(function (row) {
        if (!row || !row.id || !row.data) return;
        IMG[row.id] = row.data;
        n++;
        /* 旧版存的是 dataURL，顺手升级成 Blob，减少 33% 体积 */
        if (typeof row.data === 'string' && row.data.indexOf('data:') === 0) {
          var blob = dataURLToBlob(row.data);
          if (blob) {
            IMG[row.id] = blob;
            AppStorage.putImage(row.id, blob);
          }
        }
      });
      return n;
    }).catch(function () { return 0; });
  }

  function imgPut(id, data) { return AppStorage.putImage(id, data); }

  /* 图片可能被多条记录/书脊共用：只回收不再被引用的候选图片。 */
  function imageRefs(value, out) {
    out = out || Object.create(null);
    if (typeof value === 'string') {
      if (value.indexOf('img:') === 0) out[value.slice(4)] = true;
    } else if (Array.isArray(value)) {
      value.forEach(function (v) { imageRefs(v, out); });
    } else if (value && typeof value === 'object') {
      Object.keys(value).forEach(function (k) { imageRefs(value[k], out); });
    }
    return out;
  }

  function liveImageRefs() {
    var refs = imageRefs([state.records, state.trash, state.draft, state.prefs.spineArt]);
    try {
      if (draftStash && draftStash.json) imageRefs(JSON.parse(draftStash.json), refs);
    } catch (e) { /* ignore damaged stash */ }
    return refs;
  }

  function purgeImages(values) {
    var candidates = imageRefs(values);
    var used = liveImageRefs();
    Object.keys(candidates).forEach(function (id) { if (!used[id]) imgDelete(id); });
  }

  function imgDelete(id) {
    if (!id) return;
    if (IMG_URL[id]) { try { URL.revokeObjectURL(IMG_URL[id]); } catch (e) { /* ignore */ } delete IMG_URL[id]; }
    delete IMG[id];
    AppStorage.deleteImage(id);
  }

  /* 压缩：最长边不超过 max，转 JPEG，通常 20–50KB */
  function shrinkImage(file, max, quality) {
    max = max || 560;
    quality = quality || 0.82;
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () {
        try {
          var w = im.naturalWidth || im.width;
          var h = im.naturalHeight || im.height;
          if (!w || !h) { URL.revokeObjectURL(url); reject(new Error('bad')); return; }
          var scale = Math.min(1, max / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var cv = document.createElement('canvas');
          cv.width = cw; cv.height = ch;
          var ctx = cv.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, cw, ch);
          ctx.drawImage(im, 0, 0, cw, ch);
          URL.revokeObjectURL(url);
          if (cv.toBlob) {
            cv.toBlob(function (blob) {
              if (blob) resolve(blob);
              else reject(new Error('encode'));
            }, 'image/jpeg', quality);
          } else {
            resolve(dataURLToBlob(cv.toDataURL('image/jpeg', quality)));
          }
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      im.src = url;
    });
  }

  /* 存一张图，返回可直接放进 cover / images 的引用 */
  function saveImageFile(file, max) {
    return shrinkImage(file, max).then(function (data) {
      var id = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      IMG[id] = data;
      return imgPut(id, data).then(function (ok) {
        /* 数据库不可用时退化成内联 dataURL，至少当下能看 */
        return ok ? ('img:' + id) : blobToDataURL(data);
      });
    });
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

  function maxRating() {
    /* 评分统一按 10 分制存储，5 星制只在显示时换算 */
    return 10;
  }

  /* 从第一条记录算起，今天是记录的第几天（含当天） */
  function recordDayCount() {
    var min = 0;
    state.records.forEach(function (r) {
      if (!min || r.createdAt < min) min = r.createdAt;
    });
    if (!min) return 0;
    var a = new Date(min); a.setHours(0, 0, 0, 0);
    var b = new Date(); b.setHours(0, 0, 0, 0);
    return Math.max(1, Math.round((b.getTime() - a.getTime()) / DAY) + 1);
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
    prefs: { theme: 'system', accent: 'rose', lastExportAt: 0, ratingScale: '10', goalCount: 0, goalHours: 0,
      seenStandaloneTip: 0, vocab: {}, vocabHidden: {}, offTypes: {}, cardFields: {}, backups: [],
      _at: 0, book: {}, bookOrder: [], spineArt: {}, ybStamp: {}, accounts: [], platforms: [] },
    route: { name: 'home', id: null },
    returnTo: '#/home',
    filters: { status: 'all', type: 'all', tag: 'all', year: 'all', release: 'all', rating: 'all', sort: 'updated', meta: {} },
    ui: {
      listId: 'all', selectMode: false, selected: {}, sortMode: false, view: 'grid', fold: {},
      ybMonth: 0, acctQuick: '', acctFold: {},
      quoteType: 'all', quoteQ: ''
    },
    archive: { year: 0, type: '' },
    book: { type: '', page: 0 },
    serverSw: '',
    authors: { open: '' },
    categories: [],
    timeline: { view: 'axis', y: 0, m: 0, selected: null, type: 'all' },
    checkins: [],
    trash: [],
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
      if (m[k] != null && String(m[k]).trim()) o[k] = String(m[k]).trim().slice(0, 200);
    });
    return o;
  }

  function normalizeCustom(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (x) {
      return x && typeof x === 'object' && String(x.k || '').trim();
    }).slice(0, 30).map(function (x) {
      return { k: String(x.k).trim().slice(0, 20), v: String(x.v == null ? '' : x.v).trim().slice(0, 120) };
    });
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
      images: Array.isArray(r.images) ? r.images.map(function (x) { return safeCover(x); })
        .filter(Boolean).slice(0, 12) : [],
      updateDay: updateDay,
      meta: normalizeMeta(r.meta),
      custom: normalizeCustom(r.custom),
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

  /* ---------------- 回收站 ---------------- */
  /* 删除只是挪进回收站，可以恢复；30 天后才在清理时彻底移除 */

  var TRASH_DAYS = 30;

  function normalizeTrash(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function (x) {
      var rec = normalizeRecord(x && x.r ? x.r : x);
      if (!rec) return null;
      var at = Number(x && x.at) || Date.now();
      return { at: at, r: rec };
    }).filter(Boolean).slice(0, 500);
  }

  function trashAdd(records) {
    records.forEach(function (r) {
      state.trash.unshift({ at: Date.now(), r: r });
    });
    state.trash = state.trash.slice(0, 500);
  }

  function trashRestore(id) {
    var hit = null;
    state.trash = state.trash.filter(function (x) {
      if (!hit && x.r.id === id) { hit = x.r; return false; }
      return true;
    });
    if (!hit) return null;
    var present = state.records.filter(function (r) { return r.id === hit.id; })[0];
    if (present) return present;
    hit.updatedAt = Date.now();
    state.records.push(hit);
    return hit;
  }

  /* ---------------- 游戏账号库 ---------------- */

  var DEFAULT_PLATFORMS = [
    'Nintendo Switch', 'Nintendo Switch 2', 'Nintendo 3DS', 'Wii U',
    'PlayStation 5', 'PlayStation 4', 'PlayStation 3', 'PS Vita',
    'Xbox Series X|S', 'Xbox One', 'Xbox 360',
    'Steam', 'Steam Deck', 'Epic Games', 'GOG', 'Ubisoft Connect',
    'EA App', 'Battle.net', 'Amazon Games', 'itch.io',
    'App Store', 'Google Play', 'TapTap', 'WeGame', '米哈游', '网易', '腾讯'
  ];

  var CURRENCIES = [
    { code: 'CNY', symbol: '¥', label: '人民币' },
    { code: 'HKD', symbol: 'HK$', label: '港币' },
    { code: 'TWD', symbol: 'NT$', label: '新台币' },
    { code: 'JPY', symbol: '¥', label: '日元' },
    { code: 'KRW', symbol: '₩', label: '韩元' },
    { code: 'USD', symbol: '$', label: '美元' },
    { code: 'CAD', symbol: 'C$', label: '加元' },
    { code: 'AUD', symbol: 'A$', label: '澳元' },
    { code: 'NZD', symbol: 'NZ$', label: '新西兰元' },
    { code: 'SGD', symbol: 'S$', label: '新加坡元' },
    { code: 'EUR', symbol: '€', label: '欧元' },
    { code: 'GBP', symbol: '£', label: '英镑' },
    { code: 'CHF', symbol: 'CHF', label: '瑞士法郎' },
    { code: 'SEK', symbol: 'kr', label: '瑞典克朗' },
    { code: 'NOK', symbol: 'kr', label: '挪威克朗' },
    { code: 'DKK', symbol: 'kr', label: '丹麦克朗' },
    { code: 'PLN', symbol: 'zł', label: '波兰兹罗提' },
    { code: 'CZK', symbol: 'Kč', label: '捷克克朗' },
    { code: 'HUF', symbol: 'Ft', label: '匈牙利福林' },
    { code: 'RUB', symbol: '₽', label: '卢布' },
    { code: 'TRY', symbol: '₺', label: '土耳其里拉' },
    { code: 'INR', symbol: '₹', label: '印度卢比' },
    { code: 'THB', symbol: '฿', label: '泰铢' },
    { code: 'MYR', symbol: 'RM', label: '马来西亚林吉特' },
    { code: 'IDR', symbol: 'Rp', label: '印尼盾' },
    { code: 'PHP', symbol: '₱', label: '菲律宾比索' },
    { code: 'VND', symbol: '₫', label: '越南盾' },
    { code: 'BRL', symbol: 'R$', label: '巴西雷亚尔' },
    { code: 'MXN', symbol: 'MX$', label: '墨西哥比索' },
    { code: 'ARS', symbol: 'AR$', label: '阿根廷比索' },
    { code: 'CLP', symbol: 'CL$', label: '智利比索' },
    { code: 'COP', symbol: 'CO$', label: '哥伦比亚比索' },
    { code: 'PEN', symbol: 'S/', label: '秘鲁索尔' },
    { code: 'AED', symbol: 'د.إ', label: '阿联酋迪拉姆' },
    { code: 'SAR', symbol: '﷼', label: '沙特里亚尔' },
    { code: 'ZAR', symbol: 'R', label: '南非兰特' },
    { code: 'ILS', symbol: '₪', label: '以色列谢克尔' },
    { code: 'UAH', symbol: '₴', label: '乌克兰格里夫纳' }
  ];

  /* 这些货币通常不带小数 */
  var ZERO_DECIMAL = { JPY: 1, KRW: 1, VND: 1, IDR: 1, CLP: 1, COP: 1, HUF: 1 };

  var REGIONS = [
    { label: '国区', currency: 'CNY' }, { label: '港区', currency: 'HKD' },
    { label: '台区', currency: 'TWD' }, { label: '日区', currency: 'JPY' },
    { label: '韩区', currency: 'KRW' }, { label: '美区', currency: 'USD' },
    { label: '加区', currency: 'CAD' }, { label: '澳区', currency: 'AUD' },
    { label: '新区', currency: 'NZD' }, { label: '新加坡', currency: 'SGD' },
    { label: '欧区', currency: 'EUR' }, { label: '英区', currency: 'GBP' },
    { label: '瑞区', currency: 'CHF' }, { label: '瑞典', currency: 'SEK' },
    { label: '挪威', currency: 'NOK' }, { label: '丹麦', currency: 'DKK' },
    { label: '波兰', currency: 'PLN' }, { label: '捷克', currency: 'CZK' },
    { label: '匈牙利', currency: 'HUF' }, { label: '俄区', currency: 'RUB' },
    { label: '土区', currency: 'TRY' }, { label: '印区', currency: 'INR' },
    { label: '泰区', currency: 'THB' }, { label: '马区', currency: 'MYR' },
    { label: '印尼', currency: 'IDR' }, { label: '菲区', currency: 'PHP' },
    { label: '越区', currency: 'VND' }, { label: '巴西', currency: 'BRL' },
    { label: '墨区', currency: 'MXN' }, { label: '阿区', currency: 'ARS' },
    { label: '智利', currency: 'CLP' }, { label: '哥伦比亚', currency: 'COP' },
    { label: '秘鲁', currency: 'PEN' }, { label: '阿联酋', currency: 'AED' },
    { label: '沙特', currency: 'SAR' }, { label: '南非', currency: 'ZAR' },
    { label: '以色列', currency: 'ILS' }, { label: '乌克兰', currency: 'UAH' }
  ];

  var MEMBERSHIPS = [
    { key: '', label: '无 / 不记' },
    { key: 'nso', label: 'Nintendo Switch Online' },
    { key: 'psplus', label: 'PlayStation Plus' },
    { key: 'xgp', label: 'Xbox Game Pass' },
    { key: 'ubisoft', label: 'Ubisoft+' },
    { key: 'ea', label: 'EA Play' },
    { key: 'other', label: '其他会员' }
  ];

  var GAME_STATUS = [
    { key: 'owned', label: '已购' },
    { key: 'playing', label: '在玩' },
    { key: 'done', label: '通关' },
    { key: 'idle', label: '吃灰' },
    { key: 'wish', label: '愿望单' }
  ];

  function currencyInfo(code) {
    var hit = CURRENCIES.filter(function (c) { return c.code === code; })[0];
    return hit || CURRENCIES[0];
  }

  function moneyText(n, code) {
    var c = currencyInfo(code);
    var v = Number(n) || 0;
    var num = ZERO_DECIMAL[code] ? String(Math.round(v)) : v.toFixed(2);
    /* 外币统一带代码，避免 ¥ / $ / kr 这些符号混淆 */
    return c.symbol + num + (code && code !== 'CNY' ? ' ' + code : '');
  }

  function membershipLabel(key) {
    var hit = MEMBERSHIPS.filter(function (m) { return m.key === key; })[0];
    return hit ? hit.label : '';
  }

  function gameStatusLabel(key) {
    var hit = GAME_STATUS.filter(function (g) { return g.key === key; })[0];
    return hit ? hit.label : '已购';
  }

  function platformOptions() {
    var out = DEFAULT_PLATFORMS.slice();
    (state.prefs.platforms || []).forEach(function (p) {
      var v = String(p || '').trim();
      if (v && out.indexOf(v) < 0) out.push(v);
    });
    return out;
  }

  function normalizePlatforms(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (p) {
      var v = String(p || '').trim().slice(0, 40);
      if (v && DEFAULT_PLATFORMS.indexOf(v) < 0 && out.indexOf(v) < 0) out.push(v);
    });
    return out.slice(0, 60);
  }

  /* 游戏清单：换行 / 逗号 / 顿号 / 分号 / 竖线 / 制表符都能拆，顺手去掉序号和书名号 */
  function parseGameList(text) {
    if (Array.isArray(text)) {
      var flat = [];
      text.forEach(function (x) { flat = flat.concat(parseGameList(x)); });
      return flat;
    }
    var raw = String(text || '').split(/[\n\r,，、;；|｜\t]+/);
    var out = [];
    raw.forEach(function (s) {
      var v = String(s || '')
        .replace(/^\s*(?:\d+\s*[.、)．]|[-•*·])\s*/, '')
        .replace(/^[《「『"'“”]+/, '')
        .replace(/[》」』"'“”]+$/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60);
      if (v && out.indexOf(v) < 0) out.push(v);
    });
    return out;
  }

  function normalizeGame(g) {
    if (typeof g === 'string') {
      var nm = String(g).trim().slice(0, 60);
      return nm ? { name: nm, status: 'owned', price: 0, buyDate: '' } : null;
    }
    if (!g || typeof g !== 'object') return null;
    var name = String(g.name || g.n || '').trim().slice(0, 60);
    if (!name) return null;
    var st = GAME_STATUS.filter(function (x) { return x.key === g.status; }).length ? g.status : 'owned';
    return {
      name: name,
      status: st,
      price: Math.max(0, Math.round((Number(g.price) || 0) * 100) / 100),
      buyDate: /^\d{4}-\d{2}-\d{2}$/.test(String(g.buyDate || '')) ? String(g.buyDate) : ''
    };
  }

  function normalizeGames(list) {
    var raw = Array.isArray(list) ? list : parseGameList(list);
    var out = [];
    raw.forEach(function (g) {
      var ng = normalizeGame(g);
      if (!ng) return;
      if (out.some(function (x) { return x.name === ng.name; })) return;
      out.push(ng);
    });
    return out.slice(0, 120);
  }

  function normalizeAccount(a) {
    if (!a || typeof a !== 'object') return null;
    var name = String(a.name || '').trim().slice(0, 40);
    if (!name) return null;
    var region = String(a.region || '').trim().slice(0, 40);
    var currency = String(a.currency || '').toUpperCase();
    if (!CURRENCIES.filter(function (c) { return c.code === currency; }).length) {
      var rg = REGIONS.filter(function (x) { return x.label === region; })[0];
      currency = rg ? rg.currency : 'CNY';
    }
    var twoFA = ['off', 'email', 'phone', 'app'].indexOf(a.twoFA) >= 0 ? a.twoFA : '';
    var membership = MEMBERSHIPS.filter(function (m) { return m.key && m.key === a.membership; }).length ? a.membership : '';
    var membershipEnd = /^\d{4}-\d{2}-\d{2}$/.test(String(a.membershipEnd || '')) ? String(a.membershipEnd) : '';
    var registeredAt = /^\d{4}-\d{2}-\d{2}$/.test(String(a.registeredAt || '')) ? String(a.registeredAt) : '';
    var status = ['normal', 'limited', 'banned'].indexOf(a.status) >= 0 ? a.status : 'normal';
    return {
      id: String(a.id || uid()).slice(0, 40),
      name: name,
      nickname: String(a.nickname || '').trim().slice(0, 40),
      email: String(a.email || '').trim().slice(0, 80),
      twoFA: twoFA,
      platform: String(a.platform || '').trim().slice(0, 40),
      region: region,
      currency: currency,
      friendCode: String(a.friendCode || '').trim().slice(0, 40),
      membership: membership,
      membershipEnd: membershipEnd,
      registeredAt: registeredAt,
      status: status,
      games: normalizeGames(a.games),
      balance: Math.max(0, Math.round((Number(a.balance) || 0) * 100) / 100),
      note: String(a.note || '').trim().slice(0, 200),
      updatedAt: Number(a.updatedAt) || Date.now()
    };
  }

  function normalizeAccounts(list) {
    if (!Array.isArray(list)) return [];
    return list.map(normalizeAccount).filter(Boolean).slice(0, 60);
  }

  function accounts() {
    if (!Array.isArray(state.prefs.accounts)) state.prefs.accounts = [];
    return state.prefs.accounts;
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

  /* 偏好可能来自 localStorage 或数据库镜像，统一校验后再落地 */
  function applyPrefsObject(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return;
      if (p.theme) state.prefs.theme = p.theme;
      if (p.lastExportAt) state.prefs.lastExportAt = Number(p.lastExportAt) || 0;
      if (p.ratingScale === '5') state.prefs.ratingScale = '5';
      if (p.goalCount) state.prefs.goalCount = Math.max(0, Math.floor(Number(p.goalCount) || 0));
      if (p.goalHours) state.prefs.goalHours = Math.max(0, Number(p.goalHours) || 0);
      if (p.seenStandaloneTip) state.prefs.seenStandaloneTip = 1;
      if (p.vocab && typeof p.vocab === 'object') state.prefs.vocab = p.vocab;
      if (p.vocabHidden && typeof p.vocabHidden === 'object') state.prefs.vocabHidden = p.vocabHidden;
      if (p.accent) state.prefs.accent = p.accent;
      if (p.offTypes && typeof p.offTypes === 'object') state.prefs.offTypes = p.offTypes;
      if (p.cardFields && typeof p.cardFields === 'object') state.prefs.cardFields = p.cardFields;
      if (Array.isArray(p.backups)) state.prefs.backups = p.backups.slice(0, 10);
      if (p.book && typeof p.book === 'object') state.prefs.book = p.book;
      if (Array.isArray(p.bookOrder)) {
        state.prefs.bookOrder = p.bookOrder.filter(function (k) { return TYPE_KEYS.indexOf(k) >= 0; }).slice(0, 20);
      }
      if (p.spineArt && typeof p.spineArt === 'object') {
        var sa = {};
        TYPE_KEYS.forEach(function (k) {
          if (typeof p.spineArt[k] === 'string' && p.spineArt[k]) sa[k] = p.spineArt[k];
        });
        state.prefs.spineArt = sa;
      }
      if (p.ybStamp && typeof p.ybStamp === 'object') state.prefs.ybStamp = p.ybStamp;
      if (Array.isArray(p.accounts)) state.prefs.accounts = normalizeAccounts(p.accounts);
      if (Array.isArray(p.platforms)) state.prefs.platforms = normalizePlatforms(p.platforms);
    if (p._at) state.prefs._at = Number(p._at) || 0;
  }

  /* ---------------- 业务存储封装 ---------------- */
  /* 数据库的打开/读写/迁移在 storage.js；这里只保留增量写入、启动加载和偏好。 */

  var written = {};        /* id -> 上次写入数据库时的 JSON，用于算增量 */
  var writeTimer = null;

  function dbGetAllRecords() { return AppStorage.getAllRecords(); }
  function dbGetMeta(k) { return AppStorage.getMeta(k); }
  function dbGetSetting(k) { return AppStorage.getSetting(k); }
  function dbPutMeta(k, row) { return AppStorage.putMeta(k, row); }
  function dbPutSetting(k, row) { return AppStorage.putSetting(k, row); }
  function dbClear() { return AppStorage.clearAll(); }

  function seedWritten(list) {
    written = {};
    for (var i = 0; i < list.length; i++) {
      try { written[list[i].id] = JSON.stringify(list[i]); } catch (e) { /* ignore */ }
    }
  }

  /* 旧 shilu-db 优先；没有再用旧 localStorage 缓存。迁移成功才删旧 localStorage 键。 */
  function migrateFromLegacy() {
    return AppStorage.readLegacy().then(function (old) {
      var out = old;
      var empty = !out || (!out.records.length && !out.lists.length && !out.checkins.length && !out.prefs);
      if (empty) {
        out = { records: [], lists: [], checkins: [], categories: [], trash: [], prefs: null, images: [] };
        try {
          var raw = localStorage.getItem(LEGACY_DB_KEY);
          if (raw) {
            var d = JSON.parse(raw);
            out.records = d.records || []; out.lists = d.lists || []; out.checkins = d.checkins || [];
            out.categories = d.categories || []; out.trash = d.trash || [];
          }
        } catch (e) { /* ignore */ }
        try {
          var lp = JSON.parse(localStorage.getItem(LEGACY_PREF_KEY) || 'null');
          if (lp) out.prefs = lp;
        } catch (e) { /* ignore */ }
      }
      if (!out.records.length && !out.lists.length && !out.checkins.length && !out.prefs) return false;
      out.images = (out.images || []).map(function (im) {
        if (im && typeof im.data === 'string' && im.data.indexOf('data:') === 0) {
          var blob = dataURLToBlob(im.data);
          if (blob) im.data = blob;
        }
        return im;
      });
      return AppStorage.writeMigration(out).then(function (ok) {
        if (ok) {
          try {
            localStorage.removeItem(LEGACY_DB_KEY);
            localStorage.removeItem(LEGACY_PREF_KEY);
          } catch (e) { /* ignore */ }
        }
        return ok;
      });
    });
  }

  /* 启动读取：数据库是唯一真源，读完才允许渲染页面 */
  function bootStore() {
    return AppStorage.open().then(function (db) {
      if (!db) return false;
      return Promise.all([
        AppStorage.getAllRecords(),
        AppStorage.getMeta('migrated'),
        AppStorage.getMeta('collections')
      ]).then(function (init) {
        var recs = init[0], migrated = init[1], cols = init[2];
        var need = !migrated && !cols && (!recs || !recs.length);
        return (need ? migrateFromLegacy() : Promise.resolve(false)).then(function () {
          return Promise.all([
            AppStorage.getAllRecords(),
            AppStorage.getMeta('collections'),
            AppStorage.getSetting('prefs'),
            AppStorage.getSetting('draft')
          ]);
        });
      }).then(function (res) {
        state.records = (res[0] || []).map(normalizeRecord).filter(Boolean);
        applyCollections(res[1]);
        if (res[2] && res[2].data) applyPrefsObject(res[2].data);
        draftStash = (res[3] && res[3].data && res[3].data.json) ? res[3].data : null;
        /* 旧版草稿在 localStorage，迁移到 settings 后清掉 */
        try {
          var legacyDraft = localStorage.getItem('shilu.draft.v1');
          if (legacyDraft) {
            if (!draftStash) {
              draftStash = JSON.parse(legacyDraft);
              AppStorage.putSetting('draft', { data: draftStash, savedAt: Date.now() });
            }
            localStorage.removeItem('shilu.draft.v1');
          }
        } catch (e) { /* ignore damaged legacy draft */ }
        seedWritten(state.records);
        AppStorage.putMeta('migrated', { at: Date.now(), version: 1 });
        if (res[1] && typeof res[1].recordCount === 'number' && res[1].recordCount !== state.records.length) {
          toast('数据条数与上次记录不一致（' + state.records.length + ' / ' + res[1].recordCount + '），建议检查并导出备份');
        }
        currentSavedAt = new Date().toISOString();
        AppStorage.putMeta('schema', {
          dbVersion: AppStorage.DB_VER, schemaVersion: SCHEMA_VERSION, updatedAt: currentSavedAt
        });
        return true;
      });
    }).catch(function () { return false; });
  }

  function dbImport(records, lists, checkins, categories) {
    return AppStorage.replaceRecords(records, {
      lists: lists, checkins: checkins, categories: categories, trash: state.trash
    }, currentSavedAt).then(function (ok) {
      if (ok) seedWritten(records);
      return ok;
    });
  }

  /* 增量写入：只 put 新增/改动的，delete 已删除的 */
  function flushWrite() {
    writeTimer = null;
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
    return AppStorage.putRecords(puts, dels, {
      lists: state.lists, checkins: state.checkins,
      categories: state.categories, trash: state.trash,
      recordCount: state.records.length
    }, currentSavedAt).then(function (ok) {
      if (ok) { written = next; broadcastSync('records'); }
      return noteWriteResult(ok);
    }).catch(function () { return noteWriteResult(false); });
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
    state.trash = normalizeTrash(meta.trash);
  }

  var writeFailed = false, quotaWarned = false, storagePersisted = null;
  var remoteChanged = false;
  var TAB_ID = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  var syncChannel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') syncChannel = new BroadcastChannel('cimengbu-sync');
  } catch (e) { syncChannel = null; }

  function broadcastSync(kind) {
    if (!syncChannel) return;
    try { syncChannel.postMessage({ from: TAB_ID, kind: kind, at: Date.now() }); } catch (e) { /* ignore */ }
  }

  /* 另一个标签页改了数据：没在编辑就重新读库；正在编辑只提示，不覆盖草稿 */
  function onRemoteChange(msg) {
    if (!msg || msg.from === TAB_ID || !booted) return;
    if ((state.route.name === 'edit' || state.route.name === 'new') && state.draft) {
      remoteChanged = true;
      render({ keepScroll: true });
      return;
    }
    bootStore().then(function (ok) {
      if (!ok) return;
      applyTheme();
      render({ keepScroll: true });
      loadImages().then(function (n2) { if (n2) render({ keepScroll: true }); });
    });
  }

  if (syncChannel) syncChannel.onmessage = function (e) { onRemoteChange(e.data); };

  window.addEventListener('appdb-versionchange', function () {
    toast('数据库已升级，正在刷新…');
    setTimeout(function () { location.reload(); }, 600);
  });

  /* 记录写入数据库失败时必须让人看见，不能弹「已保存」后静默回退 */
  function noteWriteResult(ok) {
    if (ok) {
      if (writeFailed) { writeFailed = false; render({ keepScroll: true }); }
      return ok;
    }
    if (!writeFailed) {
      writeFailed = true;
      toast('保存失败：本机数据库没写入，请重试或导出备份');
      render({ keepScroll: true });
    }
    return ok;
  }

  function save() {
    currentSavedAt = new Date().toISOString();
    /* 不少流程改完偏好只调 save()，这里统一补一次，避免设置漏存 */
    savePrefs();
    queueWrite();
  }

  var prefTimer = null, prefDbWarned = false;

  /* localStorage 只保存界面偏好，业务设置全部写 settings 表 */
  function saveUiPrefs() {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({
        theme: state.prefs.theme, accent: state.prefs.accent
      }));
    } catch (e) { /* 界面偏好写不进去不影响业务数据 */ }
  }

  function loadUiPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem(UI_KEY) || 'null');
      if (!p) {
        var old = JSON.parse(localStorage.getItem(LEGACY_PREF_KEY) || 'null');
        if (old) {
          if (old.theme) state.prefs.theme = old.theme;
          if (old.accent) state.prefs.accent = old.accent;
        }
        return;
      }
      if (p.theme) state.prefs.theme = p.theme;
      if (p.accent) state.prefs.accent = p.accent;
    } catch (e) { /* ignore */ }
  }

  function savePrefs() {
    state.prefs._at = Date.now();
    saveUiPrefs();
    if (prefTimer) return;
    prefTimer = setTimeout(function () { prefTimer = null; flushPrefsDB(); }, 400);
  }

  function flushPrefsDB() {
    if (prefTimer) { clearTimeout(prefTimer); prefTimer = null; }
    var snap = null;
    try { snap = JSON.parse(JSON.stringify(state.prefs)); } catch (e) { return Promise.resolve(false); }
    return AppStorage.putSetting('prefs', { data: snap, savedAt: snap._at || Date.now() }).then(function (ok) {
      if (!ok && !prefDbWarned && !writeFailed) {
        prefDbWarned = true;
        toast('设置没能写入本机数据库，请先导出备份');
      }
      if (ok) { prefDbWarned = false; broadcastSync('prefs'); }
      return ok;
    });
  }

  /* ---------------- 主题 ---------------- */

  function applyTheme() {
    var t = state.prefs.theme;
    var dark = t === 'dark' || (t === 'system' && window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.accent = state.prefs.accent || 'rose';
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
    if (name === 'person' && parts[1]) return { name: 'person', id: decodeURIComponent(parts.slice(1).join('/')) };
    if (name === 'book' || name === 'library') return { name: 'book', id: name === 'book' ? (parts[1] || null) : null };
    if (name === 'archive') return { name: 'archive', id: parts[1] || null };
    if (name === 'accounts') return { name: 'accounts', id: parts[1] || null };
    if (['home', 'timeline', 'stats', 'settings', 'new',
      'quotes', 'authors', 'badges', 'options',
      'week', 'tags', 'trash'].indexOf(name) >= 0) {
      return { name: name, id: null };
    }
    return { name: 'home', id: null };
  }

  var view = document.getElementById('view');

  function render(opts) {
    if (!booted) { if (!bootFailed) renderBoot(); return; }
    opts = opts || {};
    var y = window.scrollY;
    var r = state.route;
    document.body.classList.toggle('is-editing', r.name === 'new' || r.name === 'edit');
    if (r.name !== 'edit' && state.readonly) {
      /* 离开详情页就把只读状态清掉，否则会泄漏到别的页面，把保存/新建等动作静默拦掉 */
      state.readonly = false;
      try { sessionStorage.removeItem('shilu.ro.v1'); } catch (e) { /* ignore */ }
    }
    view.classList.toggle('is-readonly', !!state.readonly && r.name === 'edit');
    document.body.classList.toggle('is-selecting', !!state.ui.selectMode && r.name === 'library');

    var html = '';
    if (r.name === 'home') html = homeView();
    else if (r.name === 'new' || r.name === 'edit') html = editView();
    else if (r.name === 'timeline') html = timelineView();
    else if (r.name === 'stats') html = statsView();
    else if (r.name === 'quotes') html = quotesView();
    else if (r.name === 'authors') html = authorsView();
    else if (r.name === 'archive') html = yearbookView(r.id);
    else if (r.name === 'book') html = r.id ? bookView(r.id) : bookOverviewView();
    else if (r.name === 'badges') html = badgesView();
    else if (r.name === 'options') html = optionsView();
    else if (r.name === 'week') html = weekView();
    else if (r.name === 'tags') html = tagsView();
    else if (r.name === 'trash') html = trashView();
    else if (r.name === 'accounts') html = r.id === 'stats' ? acctStatsView() : accountsView();
    else if (r.name === 'person') html = personView(r.id || '');
    else if (r.name === 'settings') html = settingsView();

    var saveWarn = writeFailed
      ? '<div class="save-warn">上次保存没能写入本机数据库。先别继续录入，点重试；仍失败就导出 JSON 备份。' +
        '<button class="btn btn-ghost btn-sm" data-action="retry-write">重试保存</button></div>'
      : '';
    var syncWarn = remoteChanged
      ? '<div class="sync-warn">另一个标签页刚改了数据。当前草稿不会被覆盖；保存后点刷新可看到最新内容。' +
        '<button class="btn btn-ghost btn-sm" data-action="sync-reload">刷新</button></div>'
      : '';
    view.innerHTML = '<div class="page">' + saveWarn + syncWarn + html + '</div>';
    updateTabbar();
    if (opts.keepScroll) window.scrollTo(0, y);
    else window.scrollTo(0, 0);
    afterRender();
  }

  function afterRender() {
    paintIconTips();
    if (state.ui.sortMode) enableDragSort();
    if (state.route.name === 'quotes' && state.ui.quoteQ) filterQuoteCards(state.ui.quoteQ);
    if (state.route.name === 'settings') { paintServerVersion(); paintStorageInfo(); }
    if (state.route.name === 'stats') {
      var hw = document.querySelector('.heat-wrap');
      if (hw) hw.scrollLeft = hw.scrollWidth;
    }
    if (state.route.name === 'book' && state.route.id) bookMaybeInsert();
    if (state.readonly && state.route.name === 'edit') {
      /* 只读详情：输入框加 readonly，下拉禁用，键盘也改不了 */
      var roInputs = view.querySelectorAll('input, textarea');
      for (var ri2 = 0; ri2 < roInputs.length; ri2++) roInputs[ri2].readOnly = true;
      var roSelects = view.querySelectorAll('select');
      for (var ri3 = 0; ri3 < roSelects.length; ri3++) roSelects[ri3].disabled = true;
    }
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
    if (r.name === 'timeline') {
      /* 每次进时间线，打卡默认回到今天，避免沿用上次选的日期误记 */
      state.checkin.sel = '';
      if (!state.timeline.y) {
        var now = new Date();
        state.timeline.y = now.getFullYear();
        state.timeline.m = now.getMonth();
        state.checkin.y = now.getFullYear();
        state.checkin.m = now.getMonth();
      }
    }
    render();
  }

  /* ---------------- 通用片段 ---------------- */

  function pageHead(eyebrow, title, mode) {
    var acts;
    if (mode === false) acts = '';
    else if (mode === 'home') {
      acts = '<div class="head-actions">' +
        '<button class="icon-btn" data-action="go" data-to="badges" aria-label="徽章">' + icon('trophy', 19) + '</button>' +
        '<button class="icon-btn" data-action="go" data-to="tags" aria-label="题材云">' + icon('list', 19) + '</button>' +
        '<button class="icon-btn" data-action="settings" aria-label="设置">' + icon('gear', 20) + '</button>' +
        '</div>';
    } else {
      acts = '<button class="icon-btn" data-action="settings" aria-label="设置">' + icon('gear', 20) + '</button>';
    }
    return '<header class="page-head">' +
      '<div><p class="eyebrow">' + esc(eyebrow) + '</p><h1 class="page-title">' + esc(title) + '</h1></div>' +
      acts + '</header>';
  }

  function coverInner(r, cls) {
    var html = '<span class="pcard-initial">' + esc(firstChar(r.title)) + '</span>';
    var src = coverSrc(r.cover);
    if (src) {
      html += '<img class="pcard-img" src="' + esc(src) + '" alt="" loading="lazy" decoding="async" ' +
        'referrerpolicy="no-referrer" ' +
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
    return bits.length ? bits.join(' · ') : statusLabel(r.type, r.status);
  }

  function progressText(r) {
    var t = TYPES[r.type];
    var p = r.progress || {};
    if (r.type === 'magazine') return magazineIssueText(r);
    if (t.mode === 'percent') {
      var pc = Math.max(0, Math.min(100, p.percent || 0));
      if (r.status === 'done' || pc >= 100) return '已通关';
      if (!pc) return statusLabel(r.type, r.status);
      return '进度 ' + pc + '%';
    }
    if (t.mode === 'single') return statusLabel(r.type, r.status);

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
      if (r.status === 'done') return '已' + segmentDoneWord(r);
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

  /* ---------------- 本周追更 / 记录月历 / 标签云 / 回收站 / 人物 ---------------- */

  var WEEK_FULL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  /* 取这条记录的更新日：优先用记录里的「更新日」，其次读专属字段里的放送/更新星期 */
  function updateDayOf(r) {
    if (typeof r.updateDay === 'number' && r.updateDay >= 0) return r.updateDay;
    var m = r.meta || {};
    var txt = m.airWeekday || m.updateWeekday || '';
    var i = WEEK_FULL.indexOf(txt);
    if (i >= 0) return i;
    var m2 = String(txt).match(/[1-7]/);
    if (m2) return Number(m2[1]) % 7;
    return -1;
  }

  function weekSchedule() {
    var out = [[], [], [], [], [], [], []];
    state.records.forEach(function (r) {
      if (r.status !== 'doing') return;
      var d = updateDayOf(r);
      if (d < 0) return;
      out[d].push(r);
    });
    out.forEach(function (list) {
      list.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    });
    return out;
  }

  function weekItem(r) {
    return '<button class="wk-item" data-action="open" data-id="' + r.id + '">' +
      '<span class="wk-cover" style="--cc:' + coverColor(r.title) + '">' + coverInner(r) + '</span>' +
      '<span class="wk-main"><span class="wk-title">' + esc(r.title) + '</span>' +
      '<span class="wk-sub">' + TYPES[r.type].label + ' · ' + esc(progressText(r)) + '</span></span>' +
      '</button>';
  }

  function weekView() {
    var sched = weekSchedule();
    var today = new Date().getDay();
    var total = sched.reduce(function (a, l) { return a + l.length; }, 0);

    var html = '<header class="page-head">' +
      '<div class="head-left"><button class="icon-btn" data-action="back" aria-label="返回">' + icon('back', 20) + '</button>' +
      '<div><p class="eyebrow">' + total + ' 部在追</p><h1 class="page-title">本周追更</h1></div></div>' +
      '<button class="icon-btn" data-action="settings" aria-label="设置">' + icon('gear', 20) + '</button>' +
      '</header>';

    if (!total) {
      return html + '<div class="empty"><div class="empty-mark">·</div>' +
        '<p class="empty-title">还没有设置更新日</p>' +
        '<p class="empty-text">在「进行中」的记录里填上放送星期或更新日，这里就会按周排出来。</p></div>';
    }

    html += '<p class="fan-hint">按更新日排的一周表，今天那行会高亮。</p>';
    html += '<div class="week">' + sched.map(function (list, d) {
      return '<section class="wk-day' + (d === today ? ' is-today' : '') + '">' +
        '<header class="wk-head"><span class="wk-name">' + WEEK_FULL[d] + '</span>' +
        (d === today ? '<span class="wk-now">今天</span>' : '') +
        '<span class="wk-n">' + (list.length ? list.length + ' 部' : '') + '</span></header>' +
        (list.length ? list.map(weekItem).join('') : '<p class="wk-empty">没有更新</p>') +
        '</section>';
    }).join('') + '</div>';
    return html;
  }

  /* ---- 标签云 ---- */
  function tagsView() {
    var tags = tagCounts();
    var max = tags.length ? tags[0][1] : 1;
    var html = '<header class="page-head">' +
      '<div class="head-left"><button class="icon-btn" data-action="back" aria-label="返回">' + icon('back', 20) + '</button>' +
      '<div><p class="eyebrow">' + tags.length + ' 个题材</p><h1 class="page-title">题材云</h1></div></div>' +
      '<button class="icon-btn" data-action="settings" aria-label="设置">' + icon('gear', 20) + '</button>' +
      '</header>';

    if (!tags.length) {
      return html + '<div class="empty"><div class="empty-mark">·</div>' +
        '<p class="empty-title">还没有题材标签</p>' +
        '<p class="empty-text">记录时加几个标签，这里会按用得多少排出大小。</p></div>';
    }

    html += '<div class="cloud">' + tags.map(function (t) {
      var ratio = t[1] / max;
      var size = 13 + Math.round(ratio * 13);
      var op = 0.55 + ratio * 0.45;
      return '<button class="cloud-tag" data-action="tag-open" data-tag="' + esc(t[0]) + '" ' +
        'style="font-size:' + size + 'px;opacity:' + op.toFixed(2) + '">' + esc(t[0]) +
        '<i>' + t[1] + '</i></button>';
    }).join('') + '</div>';
    html += '<p class="fan-hint" style="text-align:center;margin-top:18px">点任意题材，直接筛出对应的作品。</p>';
    return html;
  }

  /* ---- 回收站 ---- */
  function trashView() {
    var list = state.trash.slice().sort(function (a, b) { return b.at - a.at; });
    var html = '<header class="page-head">' +
      '<div class="head-left"><button class="icon-btn" data-action="back" aria-label="返回">' + icon('back', 20) + '</button>' +
      '<div><p class="eyebrow">' + list.length + ' 条待清理</p><h1 class="page-title">回收站</h1></div></div>' +
      (list.length ? '<button class="link-btn" data-action="trash-clear">清空</button>' : '') +
      '</header>';

    if (!list.length) {
      return html + '<div class="empty"><div class="empty-mark">·</div>' +
        '<p class="empty-title">回收站是空的</p>' +
        '<p class="empty-text">删掉的记录会先放到这里，30 天内都能恢复。</p></div>';
    }

    html += '<p class="fan-hint">恢复后回到原来的收藏里，标签和进度都还在。</p>';
    html += '<div class="trash-list">' + list.map(function (x) {
      var days = Math.max(0, TRASH_DAYS - Math.floor((Date.now() - x.at) / DAY));
      return '<div class="trash-row">' +
        '<span class="trash-cover" style="--cc:' + coverColor(x.r.title) + '">' + coverInner(x.r) + '</span>' +
        '<span class="trash-main"><span class="trash-title">' + esc(x.r.title) + '</span>' +
        '<span class="trash-sub">' + TYPES[x.r.type].label + ' · 删除于 ' + ymd(new Date(x.at)) +
        ' · 还剩 ' + days + ' 天</span></span>' +
        '<span class="trash-ops">' +
        '<button class="mini-btn" data-action="trash-restore" data-id="' + x.r.id + '">恢复</button>' +
        '<button class="mini-btn danger" data-action="trash-purge" data-id="' + x.r.id + '">彻底删除</button>' +
        '</span></div>';
    }).join('') + '</div>';
    return html;
  }

  /* ---- 人物页 ---- */
  function personRecords(name) {
    return state.records.filter(function (r) { return String(r.creator || '').trim() === name; });
  }

  function personView(name) {
    var list = personRecords(name).sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    var rated = list.filter(function (r) { return r.rating > 0; });
    var avg = rated.length ? rated.reduce(function (s, r) { return s + r.rating; }, 0) / rated.length : 0;
    var hours = list.reduce(function (s, r) { return s + (r.hours || 0); }, 0);
    var doneN = list.filter(function (r) { return r.status === 'done'; }).length;
    var types = {};
    list.forEach(function (r) { types[r.type] = (types[r.type] || 0) + 1; });
    var years = {};
    list.forEach(function (r) {
      var y = recordYear(r) || new Date(r.createdAt).getFullYear();
      years[y] = (years[y] || 0) + 1;
    });
    var top = list.filter(function (r) { return r.rating > 0; })
      .sort(function (a, b) { return b.rating - a.rating; })[0];

    var html = '<header class="page-head">' +
      '<div class="head-left"><button class="icon-btn" data-action="back" aria-label="返回">' + icon('back', 20) + '</button>' +
      '<div><p class="eyebrow">' + list.length + ' 部作品</p><h1 class="page-title">' + esc(name) + '</h1></div></div>' +
      '<button class="icon-btn" data-action="settings" aria-label="设置">' + icon('gear', 20) + '</button>' +
      '</header>';

    html += '<div class="person-card">' +
      '<span class="person-avatar" style="--cc:' + coverColor(name) + '">' + esc(firstChar(name)) + '</span>' +
      '<div class="person-stats">' +
      '<div class="person-stat"><b>' + list.length + '</b><span>作品</span></div>' +
      '<div class="person-stat"><b>' + doneN + '</b><span>完成</span></div>' +
      '<div class="person-stat"><b>' + (avg ? ratingText(avg) : '—') + '</b><span>均分</span></div>' +
      '<div class="person-stat"><b>' + (hours ? fmtHours(hours) : '—') + '</b><span>小时</span></div>' +
      '</div></div>';

    html += '<div class="person-meta">' + Object.keys(types).sort(function (a, b) { return types[b] - types[a]; })
      .map(function (k) {
        return '<span class="person-tag">' + TYPES[k].label + ' ' + types[k] + '</span>';
      }).join('') +
      Object.keys(years).sort().map(function (y) {
        return '<span class="person-tag is-year">' + y + '</span>';
      }).join('') + '</div>';

    if (top) {
      html += '<p class="person-top">最高分：<b>' + esc(top.title) + '</b> ' + ratingText(top.rating) + '</p>';
    }

    html += '<div class="auth-list" style="margin-top:6px">' + list.map(function (r) {
      return '<div class="auth-item" data-action="open" data-id="' + r.id + '" role="button" tabindex="0">' +
        '<span class="auth-item-title">' + esc(r.title) + '</span>' +
        '<span class="auth-item-meta">' + TYPES[r.type].label + ' · ' + statusLabelFor(r) +
        (r.rating ? ' · ' + ratingText(r.rating) : '') + (recordYear(r) ? ' · ' + recordYear(r) : '') + '</span>' +
        '</div>';
    }).join('') + '</div>';
    return html;
  }

  /* ---- 一键跳转搜索 ---- */
  var SEARCH_SITES = {
    doubanBook: { label: '豆瓣读书', url: 'https://search.douban.com/book/subject_search?search_text=' },
    doubanMovie: { label: '豆瓣电影', url: 'https://search.douban.com/movie/subject_search?search_text=' },
    doubanMusic: { label: '豆瓣音乐', url: 'https://search.douban.com/music/subject_search?search_text=' },
    doubanAll: { label: '豆瓣', url: 'https://www.douban.com/search?q=' },
    bangumi: { label: 'Bangumi', url: 'https://bgm.tv/subject_search/' },
    steam: { label: 'Steam', url: 'https://store.steampowered.com/search/?term=' },
    bili: { label: 'B 站', url: 'https://search.bilibili.com/all?keyword=' },
    netease: { label: '网易云', url: 'https://music.163.com/#/search/m/?s=' },
    qqmusic: { label: 'QQ 音乐', url: 'https://y.qq.com/n/ryqq/search?w=' },
    weread: { label: '微信读书', url: 'https://weread.qq.com/web/search/books?keyword=' },
    jd: { label: '京东', url: 'https://search.jd.com/Search?keyword=' },
    kongfz: { label: '孔夫子', url: 'https://search.kongfz.com/product/?keyword=' },
    wiki: { label: '维基', url: 'https://zh.wikipedia.org/w/index.php?search=' }
  };

  var SEARCH_BY_TYPE = {
    novel: ['doubanBook', 'weread', 'jd', 'kongfz', 'wiki'],
    comic: ['doubanBook', 'bangumi', 'jd', 'kongfz'],
    magazine: ['doubanAll', 'kongfz', 'jd'],
    anime: ['bangumi', 'doubanMovie', 'bili', 'wiki'],
    tv: ['doubanMovie', 'bili', 'wiki'],
    movie: ['doubanMovie', 'wiki', 'bili'],
    variety: ['doubanMovie', 'bili', 'wiki'],
    drama: ['doubanAll', 'netease', 'bili'],
    stage: ['doubanAll', 'bili', 'wiki'],
    game: ['steam', 'bangumi', 'doubanAll', 'bili'],
    music: ['netease', 'qqmusic', 'doubanMusic', 'wiki']
  };

  function searchLinksHTML(r) {
    var keys = SEARCH_BY_TYPE[r.type] || ['doubanAll', 'wiki'];
    var q = encodeURIComponent(r.title);
    return '<div class="slinks">' + keys.map(function (k) {
      var site = SEARCH_SITES[k];
      if (!site) return '';
      return '<a class="slink" href="' + site.url + q + '" target="_blank" rel="noopener noreferrer">' +
        esc(site.label) + '</a>';
    }).join('') + '</div>';
  }

  /* ---- ISBN 查询（Google Books，失败再试 Open Library） ---- */


  /* ---- 紧凑列表视图 ---- */

  /* ---- 相册 ---- */
  function galleryHTML(r, editable) {
    var list = r.images || [];
    if (!list.length && !editable) return '';
    return '<div class="gal' + (editable ? ' is-edit' : '') + '">' + list.map(function (src, i) {
      return '<span class="gal-item" style="--cc:' + coverColor(r.title) + '">' +
        '<img src="' + esc(coverSrc(src)) + '" alt="" loading="lazy">' +
        (editable
          ? '<button class="gal-del" data-action="del-image" data-idx="' + i + '" aria-label="移除这张">' + icon('close', 12) + '</button>'
          : '') +
        '</span>';
    }).join('') +
      (editable
        ? '<label class="gal-add">' + icon('plus', 16) + '<span>加图</span>' +
        '<input type="file" accept="image/*" class="file-input" data-image="1" hidden></label>'
        : '') +
      '</div>';
  }

  function viewImage(src) {
    if (!src) return;
    openModal({
      title: '',
      cls: 'img-modal',
      body: '<img class="img-full" src="' + esc(src) + '" alt="">',
      actions: [{ label: '关闭', value: null, variant: 'ghost' }]
    });
  }

  /* ================= 收藏册 / 票根 / 年度档案 ================= */

  var TICKET_TYPES = ['movie', 'stage'];

  function bookCfg() {
    var b = state.prefs.book || {};
    return {
      per: (b.per === 2 || b.per === 4) ? b.per : 1,
      order: b.order === 'new' ? 'new' : 'seq',
      sound: b.sound !== false,
      ticket: {
        movie: (b.ticket && b.ticket.movie) || 'stub',
        stage: (b.ticket && b.ticket.stage) || 'stub'
      },
      album: b.album || 'grid',
      seen: b.seen || {}
    };
  }

  function saveBookCfg(patch) {
    var cur = bookCfg();
    var prev = state.prefs.book || {};
    state.prefs.book = {
      per: patch.per != null ? patch.per : cur.per,
      order: patch.order || cur.order,
      sound: patch.sound != null ? patch.sound : cur.sound,
      ticket: patch.ticket || cur.ticket,
      album: patch.album || cur.album,
      seen: patch.seen || cur.seen,
      pos: patch.pos || prev.pos || {},
      baseline: patch.baseline != null ? patch.baseline : (prev.baseline || 0)
    };
    savePrefs();
  }

  /* 完成日期：有就用手填的，标记完成但没填的按最后更新算 */
  function doneISO(r) {
    if (r.finishedAt) return r.finishedAt;
    if (r.status === 'done') return ymd(new Date(r.updatedAt));
    return '';
  }

  function yearOf(r) {
    var d = doneISO(r);
    return d ? d.slice(0, 4) : 'earlier';
  }

  function isTicketType(t) { return TICKET_TYPES.indexOf(t) >= 0; }

  function bookList(type) {
    var cfg = bookCfg();
    return state.records.filter(function (r) { return r.type === type; }).slice()
      .sort(function (a, b) {
        var da = doneISO(a), db = doneISO(b);
        if (da !== db) {
          if (!da) return cfg.order === 'new' ? 1 : -1;
          if (!db) return cfg.order === 'new' ? -1 : 1;
          return cfg.order === 'new' ? (da < db ? 1 : -1) : (da > db ? 1 : -1);
        }
        return cfg.order === 'new' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt;
      });
  }

  function bookPending() {
    var b = state.prefs.book || {};
    if (!Number(b.baseline)) {
      /* 第一次打开：把现有记录全部当作旧卡，不播动画 */
      var seen0 = b.seen || {};
      state.records.forEach(function (r) { seen0[r.id] = Date.now(); });
      saveBookCfg({ seen: seen0, baseline: Date.now() });
      return null;
    }
    var base = Number(b.baseline);
    var seenMap = bookCfg().seen;
    var list = state.records.filter(function (r) { return r.createdAt > base; })
      .sort(function (x, y) { return y.createdAt - x.createdAt; });
    for (var i = 0; i < list.length; i++) {
      if (!seenMap[list[i].id]) return list[i];
    }
    return null;
  }

  function markBookSeen(id) {
    var cfg = bookCfg();
    var seen = cfg.seen;
    seen[id] = Date.now();
    /* 只留最近 400 条，避免无限膨胀 */
    var keys = Object.keys(seen);
    if (keys.length > 400) {
      keys.sort(function (a, b) { return seen[a] - seen[b]; })
        .slice(0, keys.length - 400)
        .forEach(function (k) { delete seen[k]; });
    }
    saveBookCfg({ seen: seen });
  }

  /* ---------------- 纪念票根（9:16 瑞士国际主义） ---------------- */

  function tkSerial(r) {
    var str = String(r.id || r.title || '');
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100000;
    return ('00000' + h).slice(-5);
  }

  function ticketStill(r) {
    var src = coverSrc(r.cover);
    if (!src && (r.images || []).length) src = coverSrc(r.images[0]);
    return src;
  }

  function tkBars() {
    var out = '';
    for (var i = 0; i < 84; i++) {
      var w = 1 + ((i * 7 + (i % 5) * 3) % 3);
      var gap = (i % 4 === 0) ? 2 : 1;
      out += '<i style="width:' + w + 'px;margin-right:' + gap + 'px"></i>';
    }
    return out;
  }

  function ticketHTML(r, cls) {
    var isStage = r.type === 'stage';
    var m = r.meta || {};
    var d = doneISO(r) || ymd(new Date(r.createdAt));
    var parts = d.split('-');
    var dateTxt = parts.length === 3 ? parts[0] + '.' + parts[1] + '.' + parts[2] : d;
    var timeBits = [];
    if (m.runtime) timeBits.push(m.runtime + ' MIN');
    if (isStage && m.shows) timeBits.push('第 ' + m.shows + ' 场');
    var venue = isStage ? (m.venue || '') : (m.cinema || m.watchPlace || '');
    var seat = isStage ? (m.seat || '') : (m.watchPlace || '');
    var still = ticketStill(r);
    var review = (r.review || '').replace(/\s+/g, ' ').trim();

    return '<div class="tk' + (cls ? ' ' + cls : '') + '" data-tid="' + r.id + '">' +
      '<div class="tk-top">' +
      '<span class="tk-brand">' + (isStage ? 'PERFORMANCE · 观演纪念' : 'CINEMA · 观影纪念') + '</span>' +
      '<span class="tk-serial">NO. ' + tkSerial(r) + '</span>' +
      '</div>' +
      '<div class="tk-still' + (still ? '' : ' is-pat') + '">' +
      (still ? '<img src="' + esc(still) + '" alt="" crossorigin="anonymous">' : '<i></i><i></i><i></i>') +
      '<span class="tk-still-tag">' + (isStage ? 'STAGE' : 'STILL') + '</span>' +
      '</div>' +
      '<div class="tk-main">' +
      '<h3 class="tk-title">' + esc(r.title) + '</h3>' +
      (r.originalTitle ? '<p class="tk-orig">' + esc(r.originalTitle) + '</p>' : '') +
      '<p class="tk-by">' + esc([r.creator, r.year].filter(Boolean).join(' / ') || '—') + '</p>' +
      '</div>' +
      '<div class="tk-grid">' +
      '<div class="tk-cell"><span>DATE</span><b>' + dateTxt + '</b></div>' +
      '<div class="tk-cell"><span>TIME</span><b>' + (timeBits.join(' · ') || '—') + '</b></div>' +
      '<div class="tk-cell"><span>' + (isStage ? 'THEATRE' : 'VENUE') + '</span><b>' + esc(venue || '—') + '</b></div>' +
      '<div class="tk-cell"><span>' + (isStage ? 'SEAT' : 'FORMAT') + '</span><b>' + esc(seat || '—') + '</b></div>' +
      (m.ticketPrice ? '<div class="tk-cell"><span>PRICE</span><b>¥' + esc(m.ticketPrice) + '</b></div>' : '') +
      '</div>' +
      (review ? '<p class="tk-note">' + esc(review.slice(0, 60)) + (review.length > 60 ? '…' : '') + '</p>' : '') +
      '<div class="tk-big" aria-hidden="true">' + esc(String(r.year || d.slice(0, 4) || '')) + '</div>' +
      '<div class="tk-tear"><i></i><i></i></div>' +
      '<div class="tk-foot">' +
      '<span class="tk-bars">' + tkBars() + '</span>' +
      '<span class="tk-admit">ADMIT ONE</span>' +
      '<b class="tk-rate">' + (r.rating ? ratingText(r.rating) : '—') + '</b>' +
      '</div>' +
      '</div>';
  }

  function openTicket(id) {
    var r = state.records.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    openModal({
      title: '',
      cls: 'ticket-modal',
      body: '<div class="tk-stage">' + ticketHTML(r) + '</div>',
      actions: [
        { label: '关闭', value: null, variant: 'ghost' },
        { label: '保存图片', value: 'save', variant: 'primary' }
      ]
    }).then(function (v) {
      if (v === 'save') saveTicket(r);
    });
  }

  function saveTicket(r) {
    var node = document.querySelector('.tk-stage .tk');
    if (!node) return;
    toast('正在生成图片…');
    var rect = node.getBoundingClientRect();
    var sc = Math.min(4, Math.max(2, 1536 / Math.max(1, rect.width)));
    loadHtml2Canvas().then(function (h2c) {
      return h2c(node, { backgroundColor: '#ffffff', scale: sc, useCORS: true, logging: false });
    }).then(function (cv) {
      cv.toBlob(function (blob) {
        if (!blob) { toast('生成失败'); return; }
        downloadBlob(blob, 'ticket-' + (r.title || 'stub') + '-' + (doneISO(r) || todayISO()) + '.png');
        toast('票根已保存');
      }, 'image/png');
    }).catch(function () {
      toast('生成失败：封面来自外站时可能受限，可直接截图保存');
    });
  }

  /* ---------------- 示例数据（每个类型三条） ---------------- */

  function posterURI(title, color, sub) {
    var ch = firstChar(title || '·');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + color + '"/><stop offset="1" stop-color="#1B1730"/></linearGradient></defs>' +
      '<rect width="360" height="480" fill="url(#g)"/>' +
      '<circle cx="296" cy="86" r="72" fill="rgba(255,255,255,.10)"/>' +
      '<circle cx="296" cy="86" r="46" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1"/>' +
      '<rect x="28" y="318" width="64" height="3" fill="rgba(255,255,255,.8)"/>' +
      '<text x="26" y="308" font-size="132" font-family="serif" fill="rgba(255,255,255,.94)">' + ch + '</text>' +
      '<text x="28" y="454" font-size="13" font-family="sans-serif" letter-spacing="2" fill="rgba(255,255,255,.68)">' +
      esc(String(sub || '').slice(0, 22)) + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  var EXAMPLE_SEED = {
    novel: [
      ['三体', '刘慈欣', '2008', 9.5, 'done', '2026-02-18', '读完最后一页愣了很久。宇宙社会学的两条公理，把整个人类史重新解释了一遍。', { publisher: '重庆出版社', pages: '302', binding: '平装' }],
      ['活着', '余华', '1993', 9, 'done', '2025-11-06', '福贵的一生像被反复揉皱又摊开的纸。余华写苦难写得很轻，轻得让人难受。', { publisher: '作家出版社', pages: '191' }],
      ['百年孤独', '加西亚·马尔克斯', '1967', 8.5, 'doing', '', '读到第三代，人名已经要靠笔记本来记。魔幻的部分反而最真实。', { publisher: '南海出版公司', translator: '范晔', pages: '360' }]
    ],
    comic: [
      ['灌篮高手', '井上雄彦', '1990', 9.5, 'done', '2026-04-12', '全国大赛那一册翻了三遍。最后一页没有台词，只有空白和心跳。', { volumes: '31', publisher: '长春出版社' }],
      ['虫师', '漆原友纪', '1999', 9, 'done', '2025-08-21', '每一话都像一篇短篇小说。安静，克制，后劲很大。', { volumes: '10' }],
      ['蓝色时期', '山口飞翔', '2017', 8.5, 'doing', '', '把"画画的人怎么面对自己不够好"画得很准。', { volumes: '14' }]
    ],
    anime: [
      ['葬送的芙莉莲', 'MADHOUSE', '2023', 9.5, 'done', '2026-01-30', '时间尺度一拉开，告别就有了重量。第 12 集的分镜值得反复看。', { airWeekday: '周五', epCount: '28', studio: 'MADHOUSE', season: '2023 秋' }],
      ['进击的巨人', 'WIT STUDIO', '2013', 9, 'doing', '', '看到第三季，才明白第一集那句"海的那边是敌人"是什么意思。', { airWeekday: '周日', epCount: '87', studio: 'WIT / MAPPA' }],
      ['迷宫饭', 'TRIGGER', '2024', 8.5, 'done', '2025-06-14', '把做饭这件事认真对待，反而成了最温柔的世界观。', { airWeekday: '周四', epCount: '24', studio: 'TRIGGER' }]
    ],
    tv: [
      ['漫长的季节', '辛爽', '2023', 9.5, 'done', '2026-03-09', '一桩旧案，三个老人，一整个下岗的东北。结尾那场雪下得很慢。', { epCount: '12', runtime: '45', country: '中国大陆' }],
      ['请回答1988', '申源浩', '2015', 9.5, 'done', '2025-02-17', '每一集都在讲小事，攒起来却是一整个青春。', { epCount: '20', runtime: '90', country: '韩国' }],
      ['黑镜', '查理·布鲁克', '2011', 8.5, 'doing', '', '看到第六季，越来越像纪录片。', { epCount: '27', country: '英国' }]
    ],
    movie: [
      ['星际穿越', '克里斯托弗·诺兰', '2014', 9.5, 'done', '2026-06-02', '重看 IMAX。书架那场戏，声音先于画面到达，眼泪先于理解到达。', { runtime: '169', country: '美国', cinema: '万达影城 IMAX', watchPlace: '影院', screeningFormat: 'IMAX', composer: 'Hans Zimmer' }],
      ['千与千寻', '宫崎骏', '2001', 9.5, 'done', '2025-12-24', '小时候看热闹，长大看离别。海上列车那一段什么都没说。', { runtime: '125', country: '日本', watchPlace: '流媒体', composer: '久石让' }],
      ['奥本海默', '克里斯托弗·诺兰', '2023', 8.5, 'done', '2025-09-13', '三小时的对白戏，靠脸和眼睛撑住。爆炸那一段的静音处理很狠。', { runtime: '180', country: '美国', cinema: 'CGV 影城', watchPlace: '影院' }]
    ],
    variety: [
      ['向往的生活', '湖南卫视', '2017', 8, 'done', '2025-07-19', '看他们做饭、聊天、发呆，比很多剧都解压。', { epCount: '100', host: '黄磊 / 何炅', channel: '湖南卫视' }],
      ['脱口秀大会', '腾讯视频', '2017', 8.5, 'done', '2026-05-22', '第五季有几段文本真的很硬。', { epCount: '60', host: '李诞', channel: '腾讯视频' }],
      ['国家宝藏', '央视', '2017', 9, 'doing', '', '每件文物都配一个故事，编排很讲究。', { epCount: '30', host: '张国立', channel: 'CCTV' }]
    ],
    drama: [
      ['三体广播剧', '729 声工场', '2019', 9, 'done', '2026-02-02', '配音把"古筝行动"那一段撑起来了，听的时候手心出汗。', { epCount: '36', platform: '猫耳 FM', cv: '宝木中阳 / 图特哈蒙' }],
      ['魔道祖师', '北斗企鹅', '2018', 9, 'done', '2025-10-05', '配乐和音效都在线，几场夜戏氛围极好。', { epCount: '30', platform: '猫耳 FM', cv: '路知行 / 边江' }],
      ['将进酒', '光合积木', '2021', 8.5, 'doing', '', '权谋线清楚，就是人名太多。', { epCount: '24', platform: '猫耳 FM' }]
    ],
    stage: [
      ['汉密尔顿', '林-曼努尔·米兰达', '2015', 9.5, 'done', '2026-05-30', '现场看和录音完全两回事。下半场开场那首歌一响，全场起立。', { venue: '上海文化广场', seat: '池座 5 排 12 号', shows: '3', runtime: '165', ticketPrice: '880', playType: '音乐剧' }],
      ['巴黎圣母院', '吕克·普拉蒙东', '1998', 9, 'done', '2025-11-22', '《大教堂时代》前奏一起，鸡皮疙瘩。', { venue: '北京天桥艺术中心', seat: '楼座 2 排 8 号', shows: '1', runtime: '150', playType: '音乐剧' }],
      ['不眠之夜', 'Punchdrunk', '2011', 8.5, 'done', '2025-04-18', '跟着一个演员跑了三层楼，最后也没搞清剧情，但很好玩。', { venue: '上海麦金侬酒店', shows: '2', runtime: '180', playType: '沉浸式戏剧' }]
    ],
    game: [
      ['空洞骑士', 'Team Cherry', '2017', 9.5, 'done', '2026-09-28', '地图设计是教科书级别。打到辐光的时候手心全是汗。', { platform: 'PC / Switch', mcScore: '90', completion: '全成就', engine: 'Unity', playTime: '62' }],
      ['艾尔登法环', 'FromSoftware', '2022', 9, 'doing', '', '死了很多次，但每次都想再来一次。', { platform: 'PS5', mcScore: '96', engine: 'Unreal', playTime: '40' }],
      ['星露谷物语', 'ConcernedApe', '2016', 9, 'done', '2025-03-11', '种地、钓鱼、送礼，时间不知不觉就没了。', { platform: 'PC', mcScore: '89', completion: '主线通关', playTime: '88' }]
    ],
    music: [
      ['范特西', '周杰伦', '2001', 9.5, 'done', '2025-08-08', '二十多年后再听，编曲依然不过时。', { albumType: '专辑', tracks: '10', medium: 'CD', publisher: '阿尔发' }],
      ['Random Access Memories', 'Daft Punk', '2013', 9, 'done', '2026-07-15', '把 disco 录成了纪录片。Giorgio by Moroder 那段独白百听不厌。', { albumType: '专辑', tracks: '13', genre: '电子 / Disco' }],
      ['冀西南林路行', '万能青年旅店', '2020', 9.5, 'done', '2025-05-20', '一张专辑听出一个县城。', { albumType: '专辑', tracks: '10', genre: '摇滚' }]
    ],
    magazine: [
      ['读库', '张立宪', '2006', 9, 'doing', '', '每期都能读到一两篇意外的好文章。', { issueCount: '12', subscribeFrom: '官网', price: '45' }],
      ['三联生活周刊', '三联书店', '1995', 8.5, 'doing', '', '封面专题做得扎实，适合通勤看。', { issueCount: '24', subscribeFrom: '邮局' }],
      ['国家地理中文版', '国家地理', '1888', 8.5, 'paused', '', '图太好，纸太沉。', { issueCount: '6', subscribeFrom: '电商' }]
    ]
  };

  function seedExamples() {
    var now = Date.now();
    var added = 0;
    var seq = 0;
    TYPE_KEYS.forEach(function (k) {
      (EXAMPLE_SEED[k] || []).forEach(function (row, i) {
        var id = 'ex_' + k + '_' + i;
        if (state.records.some(function (r) { return r.id === id; })) return;
        seq++;
        var title = row[0];
        var rec = normalizeRecord({
          id: id,
          type: k,
          title: title,
          creator: row[1],
          year: row[2],
          rating: row[3],
          status: row[4],
          finishedAt: row[5] || '',
          startedAt: row[5] ? row[5] : '',
          review: row[6] || '',
          tags: [TYPES[k].label, '示例'].slice(0, 2),
          cover: posterURI(title, TYPES[k].color, row[2]),
          meta: row[7] || {},
          hours: k === 'game' ? 30 + i * 20 : (k === 'anime' || k === 'tv' ? 10 + i * 6 : 6 + i * 3),
          progress: {
            percent: row[4] === 'done' ? 100 : (i === 1 ? 45 : 20),
            chapter: { current: row[4] === 'done' ? 20 : 6, total: 20 },
            volume: { current: row[4] === 'done' ? 3 : 1, total: 3 },
            segments: (k === 'anime' || k === 'tv' || k === 'drama')
              ? [{ n: 1, current: row[4] === 'done' ? 12 : 4, total: 12, done: row[4] === 'done' }] : []
          },
          quotes: i === 0 ? [{ id: 'q_' + k + '_0', text: (row[6] || '').slice(0, 30), page: '' }] : [],
          createdAt: now - (30 + seq * 9) * DAY,
          updatedAt: row[5] ? new Date(row[5] + 'T20:00:00').getTime() : now - seq * DAY
        });
        if (rec) { state.records.push(rec); added++; }
      });
    });
    save();
    toast(added ? '已加入 ' + added + ' 条示例' : '示例已经在库里了');
    render({ keepScroll: true });
  }

  /* ---------------- 收藏册：总览 ---------------- */

  function bookOrderKeys() {
    var all = typesOn();
    var saved = Array.isArray(state.prefs.bookOrder) ? state.prefs.bookOrder : [];
    var out = [];
    saved.forEach(function (k) {
      if (all.indexOf(k) >= 0 && out.indexOf(k) < 0) out.push(k);
    });
    all.forEach(function (k) { if (out.indexOf(k) < 0) out.push(k); });
    return out;
  }

  /* 书架排版：按可用宽度算每层几本、每本多宽，手机/平板/电脑各自成行 */
  function shelfLayout(n) {
    var vw = Math.min(window.innerWidth || 390, 980) - ((window.innerWidth || 390) <= 520 ? 32 : 40);
    var avail = Math.max(220, Math.min(vw, 780) - 30);
    var gap = avail < 400 ? 8 : 11;
    var maxPer = Math.max(2, Math.min(8, Math.floor((avail + gap) / (72 + gap))));
    var rows = Math.max(1, Math.ceil(n / maxPer));
    var per = Math.max(1, Math.ceil(n / rows));
    var bw = Math.floor((avail - gap * (per - 1)) / per);
    bw = Math.max(50, Math.min(104, bw));
    return { per: per, bw: bw, gap: gap };
  }

  function spineArtSrc(type) {
    var m = state.prefs.spineArt || {};
    return coverSrc(m[type] || '');
  }

  function modalScrollTop() {
    var m = document.querySelector('#modal-root .modal');
    return m ? m.scrollTop : 0;
  }

  function restoreModalScroll(y) {
    var m = document.querySelector('#modal-root .modal');
    if (m && y) m.scrollTop = y;
  }

  function openSpineArtPicker() {
    var types = bookOrderKeys();
    var rows = types.map(function (k) {
      var src = spineArtSrc(k);
      return '<div class="sa-row">' +
        '<span class="sa-prev" style="--tc:' + TYPES[k].color + '">' +
        (src ? '<img src="' + esc(src) + '" alt="">' : '<i>' + esc(TYPES[k].label.slice(0, 1)) + '</i>') +
        '</span>' +
        '<span class="sa-name">' + esc(TYPES[k].label) + '</span>' +
        '<label class="btn btn-ghost btn-sm sa-pick">' + (src ? '换图' : '选图') +
        '<input type="file" accept="image/*" data-spine="' + k + '" hidden></label>' +
        (src ? '<button class="btn btn-ghost btn-sm" data-action="spine-art-clear" data-value="' + k + '">移除</button>' : '') +
        '</div>';
    }).join('');
    openModal({
      title: '书脊背景',
      desc: '给每本册子的书脊换一张图，竖图效果最好；不选就用类型色。图片只存在这台设备。',
      cls: 'sa-modal',
      body: '<div class="sa-list">' + rows + '</div>',
      actions: [{ label: '完成', value: null, variant: 'primary' }]
    });
  }

  function handleSpineArtPick(input) {
    var type = input.dataset ? input.dataset.spine : '';
    var file = input.files && input.files[0];
    input.value = '';
    if (!type || !file) return;
    if (!/^image\//.test(file.type || '')) { toast('请选择图片文件'); return; }
    toast('处理中…');
    var keepY = modalScrollTop();
    saveImageFile(file, 560).then(function (ref) {
      state.prefs.spineArt = state.prefs.spineArt || {};
      var oldRef = state.prefs.spineArt[type];
      state.prefs.spineArt[type] = ref;
      purgeImages([oldRef]);
      savePrefs();
      save();
      render({ keepScroll: true });
      openSpineArtPicker();
      restoreModalScroll(keepY);
      toast('书脊背景已更新');
    }).catch(function () {
      toast('图片读取失败，换一张试试');
    });
  }

  function bookOverviewView() {
    var types = bookOrderKeys();
    var html = '<header class="page-head">' +
      '<div><p class="eyebrow">按类型装订</p><h1 class="page-title">收藏册</h1></div>' +
      '<div class="head-actions">' +
      '<button class="icon-btn" data-action="spine-art" aria-label="书脊背景">' + icon('image', 19) + '</button>' +
      '<button class="icon-btn" data-action="settings" aria-label="设置">' + icon('gear', 20) + '</button>' +
      '</div></header>';

    html += '<p class="fan-hint">每类是一本册子，点开左右翻；<b>长按册子可拖动排序</b>，右上角可换书脊背景。</p>';

    var lay = shelfLayout(types.length);
    var tiers = [];
    for (var ti = 0; ti < types.length; ti += lay.per) tiers.push(types.slice(ti, ti + lay.per));

    html += '<div class="shelf" style="--gap:' + lay.gap + 'px">' + tiers.map(function (tier) {
      return '<div class="shelf-tier">' + tier.map(function (k) {
        var list = bookList(k);
        var years = {};
        list.forEach(function (r) { var y = yearOf(r); if (y !== 'earlier') years[y] = 1; });
        var yk = Object.keys(years).sort();
        var span = yk.length ? yk[0] + (yk.length > 1 ? '–' + yk[yk.length - 1] : '') : '';
        var cnt = list.length;
        var bh = Math.round(lay.bw * 2.12 * (0.93 + Math.min(cnt, 10) * 0.007));
        var art = spineArtSrc(k);
        return '<button class="shelf-book" data-action="book-open" data-value="' + k + '"' +
          ' aria-label="' + esc(TYPES[k].label) + '，长按拖动排序"' +
          ' style="--tc:' + TYPES[k].color + ';--bw:' + lay.bw + 'px;--bh:' + bh + 'px">' +
          '<span class="spine' + (art ? ' has-art' : '') + '">' +
          (art ? '<span class="spine-art"><img src="' + esc(art) + '" alt="" loading="lazy"></span>' : '') +
          '<span class="spine-cap"></span>' +
          '<span class="spine-icon">' + icon(k, 14) + '</span>' +
          '<span class="spine-title">' + esc(TYPES[k].label) + '</span>' +
          '<span class="spine-foot">' +
          '<span class="spine-count">' + (cnt ? cnt + ' 张' : '空') + '</span>' +
          (span ? '<span class="spine-years">' + esc(span) + '</span>' : '') +
          '</span>' +
          '</span></button>';
      }).join('') + '</div>';
    }).join('') + '</div>';

    return html;
  }

  /* ---------------- 收藏册：长按拖动排序 ---------------- */
  var shelfDrag = { timer: 0, active: false, el: null, ghost: null, sx: 0, sy: 0, suppress: 0, moved: false, mouse: false };

  function shelfCancelTimer() {
    if (shelfDrag.timer) { clearTimeout(shelfDrag.timer); shelfDrag.timer = 0; }
  }

  function shelfStartDrag() {
    var el = shelfDrag.el;
    if (!el || !el.isConnected || shelfDrag.active) return;
    shelfDrag.active = true;
    shelfDrag.moved = false;
    shelfDrag.suppress = Date.now() + 700;
    var r = el.getBoundingClientRect();
    var g = el.cloneNode(true);
    g.className = 'shelf-ghost';
    g.removeAttribute('data-action');
    g.style.left = r.left + 'px';
    g.style.top = r.top + 'px';
    g.style.width = r.width + 'px';
    g.style.height = r.height + 'px';
    document.body.appendChild(g);
    shelfDrag.ghost = g;
    el.classList.add('is-placeholder');
    var shelf = el.closest('.shelf');
    if (shelf) shelf.classList.add('is-dragging');
    if (navigator.vibrate) { try { navigator.vibrate(9); } catch (e) { /* ignore */ } }
  }

  function shelfMoveTo(x, y) {
    var g = shelfDrag.ghost, el = shelfDrag.el;
    if (!g || !el) return;
    g.style.transform = 'translate3d(' + (x - shelfDrag.sx) + 'px,' + (y - shelfDrag.sy) + 'px,0) scale(1.045) rotate(-1.2deg)';
    var under = document.elementFromPoint(x, y);
    var target = under && under.closest ? under.closest('.shelf-book') : null;
    if (target && target !== el) {
      var tr = target.getBoundingClientRect();
      var after = x > tr.left + tr.width / 2;
      if (after) target.parentNode.insertBefore(el, target.nextSibling);
      else target.parentNode.insertBefore(el, target);
    }
    if (y < 96) window.scrollBy(0, -9);
    else if (y > window.innerHeight - 96) window.scrollBy(0, 9);
  }

  function shelfEndDrag() {
    var el = shelfDrag.el;
    shelfCancelTimer();
    if (!shelfDrag.active) { shelfDrag.el = null; return; }
    shelfDrag.active = false;
    if (shelfDrag.ghost) { shelfDrag.ghost.remove(); shelfDrag.ghost = null; }
    var shelf = el && el.closest ? el.closest('.shelf') : null;
    if (shelf) shelf.classList.remove('is-dragging');
    if (el) el.classList.remove('is-placeholder');
    var moved = shelfDrag.moved;
    shelfDrag.el = null;
    shelfDrag.suppress = Date.now() + 600;
    if (!moved) return;
    var order = [].map.call(document.querySelectorAll('#view .shelf-book'), function (b) { return b.dataset.value; });
    if (!order.length) return;
    state.prefs.bookOrder = order;
    savePrefs();
    save();
    render({ keepScroll: true });
    toast('顺序已保存');
  }

  document.addEventListener('pointerdown', function (e) {
    if (state.route.name !== 'book' || state.route.id) return;
    var el = e.target && e.target.closest ? e.target.closest('.shelf-book') : null;
    if (!el || (e.button && e.button > 0)) return;
    shelfCancelTimer();
    shelfDrag.el = el;
    shelfDrag.sx = e.clientX;
    shelfDrag.sy = e.clientY;
    shelfDrag.active = false;
    shelfDrag.moved = false;
    shelfDrag.mouse = e.pointerType === 'mouse';
    if (!shelfDrag.mouse) {
      shelfDrag.timer = setTimeout(function () { shelfStartDrag(); }, 380);
    }
  }, true);

  document.addEventListener('pointermove', function (e) {
    if (!shelfDrag.el) return;
    var dx = e.clientX - shelfDrag.sx, dy = e.clientY - shelfDrag.sy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (!shelfDrag.active) {
      if (shelfDrag.timer && dist > 9) { shelfCancelTimer(); shelfDrag.el = null; return; }
      if (shelfDrag.mouse && dist > 5) shelfStartDrag();
      if (!shelfDrag.active) return;
    }
    if (e.cancelable) e.preventDefault();
    if (dist > 7) shelfDrag.moved = true;
    shelfMoveTo(e.clientX, e.clientY);
  }, { passive: false });

  document.addEventListener('touchmove', function (e) {
    if (shelfDrag.active && e.cancelable) e.preventDefault();
  }, { passive: false });

  document.addEventListener('pointerup', function () {
    if (shelfDrag.active) shelfEndDrag();
    else { shelfCancelTimer(); shelfDrag.el = null; }
  });
  document.addEventListener('pointercancel', function () {
    if (shelfDrag.active) shelfEndDrag();
    else { shelfCancelTimer(); shelfDrag.el = null; }
  });

  /* 拖完那一下不要顺手把册子点开 */
  document.addEventListener('click', function (e) {
    if (Date.now() > shelfDrag.suppress) return;
    var el = e.target && e.target.closest ? e.target.closest('.shelf-book') : null;
    if (el) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  document.addEventListener('contextmenu', function (e) {
    if (e.target && e.target.closest && e.target.closest('.shelf-book')) e.preventDefault();
  });
  document.addEventListener('dragstart', function (e) {
    if (e.target && e.target.closest && e.target.closest('.shelf-book')) e.preventDefault();
  });

  var shelfResizeT = 0;
  window.addEventListener('resize', function () {
    if (state.route.name !== 'book' || shelfDrag.active) return;
    clearTimeout(shelfResizeT);
    shelfResizeT = setTimeout(function () {
      if (state.route.name === 'book' && !shelfDrag.active) {
        if (state.route.id) state.book.page = 0;
        render({ keepScroll: true });
      }
    }, 200);
  });

  /* ---------------- 游戏账号库：视图 ---------------- */

  function daysUntil(dateStr) {
    if (!dateStr) return -1;
    var d = new Date(dateStr + 'T00:00:00');
    var t = new Date();
    t.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 86400000);
  }

  function copyText(text) {
    if (!text) { toast('没有可复制的内容'); return; }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast('已复制'); }
      catch (e) { toast('复制失败，请手动选择'); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('已复制'); }).catch(fallback);
    } else fallback();
  }

  function acctCardHTML(a) {
    var quick = state.ui.acctQuick === a.id;
    var tags = [];
    if (a.membership) {
      var m = membershipLabel(a.membership);
      if (a.membershipEnd) {
        var days = daysUntil(a.membershipEnd);
        m += ' · ' + a.membershipEnd + (days >= 0 && days <= 30 ? '（剩 ' + days + ' 天）' : '');
      }
      tags.push(m);
    }
    if (a.twoFA) tags.push('2FA');
    if (a.status === 'banned') tags.push('已封禁');
    else if (a.status === 'limited') tags.push('受限');

    var gameChips = a.games.map(function (g, i) {
      return '<button class="acct-game is-' + g.status + '" data-action="acct-game" data-id="' + a.id + '" data-idx="' + i + '" title="' + gameStatusLabel(g.status) + '">' +
        (g.status === 'wish' ? '☆ ' : '') + esc(g.name) + '</button>';
    }).join('');

    return '<div class="acct-card">' +
      '<div class="acct-head">' +
      '<span class="acct-badge" style="--cc:' + coverColor(a.name) + '">' + esc(firstChar(a.name)) + '</span>' +
      '<span class="acct-title"><b>' + esc(a.name) +
      (a.nickname ? ' <em>' + esc(a.nickname) + '</em>' : '') + '</b>' +
      '<i>' + esc([a.platform, a.region].filter(Boolean).join(' · ') || '未设平台') + '</i></span>' +
      '<span class="acct-money">' + moneyText(a.balance, a.currency) + '</span>' +
      '</div>' +
      (tags.length
        ? '<div class="acct-tags">' + tags.map(function (t) {
          return '<span class="acct-tag">' + esc(t) + '</span>';
        }).join('') + '</div>'
        : '') +
      (a.games.length
        ? '<div class="acct-games">' + gameChips + '</div>'
        : '<p class="acct-none">还没登记游戏</p>') +
      (a.note ? '<p class="acct-note">' + esc(a.note) + '</p>' : '') +
      '<div class="acct-ops">' +
      '<button class="mini-btn" data-action="acct-copy" data-id="' + a.id + '">复制</button>' +
      '<button class="mini-btn" data-action="acct-quick" data-id="' + a.id + '">' + (quick ? '收起' : '＋ 加游戏') + '</button>' +
      '<button class="mini-btn" data-action="acct-edit" data-id="' + a.id + '">编辑</button>' +
      '<button class="mini-btn danger" data-action="acct-del" data-id="' + a.id + '">删除</button>' +
      '</div>' +
      (quick
        ? '<div class="acct-quick">' +
        '<input class="input" id="acct-quick-input" placeholder="游戏名，逗号分隔可一次加多个">' +
        '<button class="btn btn-primary btn-sm" data-action="acct-add-game" data-id="' + a.id + '">添加</button>' +
        '</div>'
        : '') +
      '</div>';
  }

  function membershipAlerts() {
    var out = [];
    accounts().forEach(function (a) {
      if (!a.membershipEnd) return;
      var d = daysUntil(a.membershipEnd);
      if (d >= 0 && d <= 30) out.push({ a: a, days: d });
    });
    return out.sort(function (x, y) { return x.days - y.days; });
  }

  function accountsView() {
    var all = accounts();

    var html = '<header class="page-head">' +
      '<div class="head-left"><button class="icon-btn" data-action="back" aria-label="返回">' + icon('back', 20) + '</button>' +
      '<div><p class="eyebrow">游戏账号 · ' + all.length + ' 个</p><h1 class="page-title">账号库</h1></div></div>' +
      '<div class="head-actions">' +
      '<button class="icon-btn" data-action="acct-new" aria-label="新增账号">' + icon('plus', 19) + '</button>' +
      '<button class="icon-btn" data-action="go" data-to="accounts/stats" aria-label="账号统计">' + icon('layers', 19) + '</button>' +
      '<button class="icon-btn" data-action="settings" aria-label="设置">' + icon('gear', 20) + '</button>' +
      '</div></header>';

    html += '<p class="fan-hint">按「平台 → 区服 → 账号」归档，点标题可以折叠。</p>';

    var alerts = membershipAlerts();
    if (alerts.length) {
      html += '<div class="acct-alert">' + alerts.map(function (x) {
        return '<div class="acct-alert-row">' +
          '<span class="acct-alert-name">' + esc(x.a.name) + '</span>' +
          '<span class="acct-alert-text">' + esc(membershipLabel(x.a.membership) || '会员') +
          (x.days === 0 ? ' 今天到期' : ' 还有 ' + x.days + ' 天到期') + '</span>' +
          '</div>';
      }).join('') + '</div>';
    }

    if (!all.length) {
      return html + '<div class="empty"><div class="empty-mark">·</div>' +
        '<p class="empty-title">还没有登记账号</p>' +
        '<p class="empty-text">把 Switch、Steam 这些账号记进来，余额和游戏一目了然。</p>' +
        '<button class="btn btn-primary btn-sm" data-action="acct-new">＋ 新增账号</button></div>';
    }

    /* 平台 → 区服 → 账号，按填写内容自动归档 */
    var order = [];
    var pMap = Object.create(null);
    all.forEach(function (a) {
      var p = a.platform || '未设平台';
      var r = a.region || '未设区服';
      if (!pMap[p]) {
        pMap[p] = { platform: p, count: 0, games: 0, rMap: Object.create(null), regions: [] };
        order.push(pMap[p]);
      }
      var pg = pMap[p];
      pg.count++;
      pg.games += a.games.length;
      if (!pg.rMap[r]) {
        pg.rMap[r] = { region: r, list: [] };
        pg.regions.push(pg.rMap[r]);
      }
      pg.rMap[r].list.push(a);
    });
    order.sort(function (x, y) {
      return y.count - x.count || x.platform.localeCompare(y.platform);
    });
    order.forEach(function (pg) {
      pg.regions.sort(function (x, y) {
        return y.list.length - x.list.length || x.region.localeCompare(y.region);
      });
    });

    var fold = state.ui.acctFold || {};
    var byCur = {};
    all.forEach(function (a) {
      var c = a.currency || 'CNY';
      byCur[c] = (byCur[c] || 0) + (a.balance || 0);
    });
    var moneyParts = Object.keys(byCur).map(function (c) { return moneyText(byCur[c], c); });
    html += '<div class="acct-sum">' +
      '<span>共 <b>' + all.length + '</b> 个账号</span>' +
      '<span>登记 <b>' + all.reduce(function (n, a) { return n + a.games.length; }, 0) + '</b> 款游戏</span>' +
      '<span>余额 <b>' + moneyParts.join(' · ') + '</b></span></div>';

    html += order.map(function (pg) {
      var pKey = 'p:' + pg.platform;
      var pFolded = !!fold[pKey];
      var head = '<button class="acct-group-head" data-action="acct-fold" data-key="' + esc(pKey) + '">' +
        '<span class="acct-group-icon" style="--cc:' + coverColor(pg.platform) + '">' + esc(firstChar(pg.platform)) + '</span>' +
        '<span class="acct-group-name">' + esc(pg.platform) + '</span>' +
        '<span class="acct-group-n">' + pg.count + ' 个号 · ' + pg.games + ' 款</span>' +
        '<span class="acct-fold-arrow">' + icon('chevron', 14) + '</span>' +
        '</button>';

      if (pFolded) return '<section class="acct-group is-folded">' + head + '</section>';

      return '<section class="acct-group">' + head +
        '<div class="acct-group-body">' + pg.regions.map(function (rg) {
          var rKey = 'r:' + pg.platform + '|' + rg.region;
          var rFolded = !!fold[rKey];
          var sub = '<button class="acct-sub-head" data-action="acct-fold" data-key="' + esc(rKey) + '">' +
            '<span class="acct-sub-dot"></span>' +
            '<span class="acct-sub-name">' + esc(rg.region) + '</span>' +
            '<span class="acct-sub-n">' + rg.list.length + ' 个号</span>' +
            '<span class="acct-fold-arrow small">' + icon('chevron', 12) + '</span>' +
            '</button>';
          if (rFolded) return '<div class="acct-sub is-folded">' + sub + '</div>';
          return '<div class="acct-sub">' + sub +
            '<div class="acct-list acct-sublist">' + rg.list.map(acctCardHTML).join('') + '</div></div>';
        }).join('') + '</div></section>';
    }).join('');

    return html;
  }

  function acctStatsData(list) {
    var byCur = {}, byPlat = Object.create(null), byMonth = {}, byYear = {};
    var totalGames = 0, wishN = 0, ownedN = 0;
    list.forEach(function (a) {
      var c = a.currency || 'CNY';
      var p = a.platform || '未设平台';
      byPlat[p] = byPlat[p] || { accounts: 0, games: 0, spent: {} };
      byPlat[p].accounts++;
      totalGames += a.games.length;
      a.games.forEach(function (g) {
        byPlat[p].games++;
        if (g.status === 'wish') { wishN++; return; }
        ownedN++;
        if (!(g.price > 0)) return;
        byCur[c] = byCur[c] || { spent: 0, priced: 0 };
        byCur[c].spent += g.price;
        byCur[c].priced++;
        byPlat[p].spent[c] = (byPlat[p].spent[c] || 0) + g.price;
        if (g.buyDate) {
          var mk = g.buyDate.slice(0, 7), yk = g.buyDate.slice(0, 4);
          byMonth[mk] = byMonth[mk] || {};
          byMonth[mk][c] = (byMonth[mk][c] || 0) + g.price;
          byYear[yk] = byYear[yk] || {};
          byYear[yk][c] = (byYear[yk][c] || 0) + g.price;
        }
      });
    });
    return { byCur: byCur, byPlat: byPlat, byMonth: byMonth, byYear: byYear,
      totalGames: totalGames, wishN: wishN, ownedN: ownedN };
  }

  function moneyList(obj) {
    var keys = Object.keys(obj || {}).sort();
    if (!keys.length) return '—';
    return keys.map(function (c) { return moneyText(obj[c], c); }).join(' · ');
  }

  function acctStatsView() {
    var list = accounts();
    var d = acctStatsData(list);
    var html = '<header class="page-head">' +
      '<div class="head-left"><button class="icon-btn" data-action="go" data-to="accounts" aria-label="返回账号库">' + icon('back', 20) + '</button>' +
      '<div><p class="eyebrow">' + list.length + ' 个账号</p><h1 class="page-title">账号统计</h1></div></div>' +
      '<div class="head-actions">' +
      '<button class="icon-btn" data-action="acct-export" aria-label="导出清单">' + icon('download', 19) + '</button>' +
      '</div></header>';

    if (!list.length) {
      return html + '<div class="empty"><div class="empty-mark">·</div>' +
        '<p class="empty-title">还没有可统计的账号</p>' +
        '<p class="empty-text">先登记账号和游戏，这里会算出投入和均价。</p></div>';
    }

    html += '<div class="stat-grid">' +
      '<div class="stat"><div class="stat-num">' + list.length + '</div><div class="stat-label">账号</div></div>' +
      '<div class="stat"><div class="stat-num">' + d.totalGames + '</div><div class="stat-label">游戏</div></div>' +
      '<div class="stat"><div class="stat-num">' + d.ownedN + '</div><div class="stat-label">已购</div></div>' +
      '<div class="stat"><div class="stat-num">' + d.wishN + '</div><div class="stat-label">愿望单</div></div>' +
      '</div>';

    html += '<section class="section"><div class="section-head"><h2 class="section-title">按币种投入</h2>' +
      '<span class="section-note">只算填了价格的已购游戏</span></div>';
    var curs = Object.keys(d.byCur).sort();
    if (!curs.length) {
      html += '<p class="muted" style="margin:4px 0">还没有填过购入价。点开游戏名可以标价格。</p>';
    } else {
      html += curs.map(function (c) {
        var x = d.byCur[c];
        var avg = x.priced ? x.spent / x.priced : 0;
        return '<div class="acct-stat-row">' +
          '<span class="acct-stat-k">' + c + '</span>' +
          '<span class="acct-stat-v">' + moneyText(x.spent, c) + '</span>' +
          '<span class="acct-stat-n">' + x.priced + ' 款 · 均价 ' + moneyText(avg, c) + '</span>' +
          '</div>';
      }).join('');
    }
    html += '</section>';

    html += '<section class="section"><div class="section-head"><h2 class="section-title">按平台</h2></div>' +
      Object.keys(d.byPlat).sort(function (a, b) { return d.byPlat[b].games - d.byPlat[a].games; }).map(function (p) {
        var x = d.byPlat[p];
        return '<div class="acct-stat-row">' +
          '<span class="acct-stat-k">' + esc(p) + '</span>' +
          '<span class="acct-stat-v">' + moneyList(x.spent) + '</span>' +
          '<span class="acct-stat-n">' + x.accounts + ' 个号 · ' + x.games + ' 款</span>' +
          '</div>';
      }).join('') + '</section>';

    var years = Object.keys(d.byYear).sort().reverse();
    if (years.length) {
      html += '<section class="section"><div class="section-head"><h2 class="section-title">按年支出</h2></div>' +
        years.map(function (y) {
          return '<div class="acct-stat-row">' +
            '<span class="acct-stat-k">' + y + '</span>' +
            '<span class="acct-stat-v">' + moneyList(d.byYear[y]) + '</span>' +
            '</div>';
        }).join('') + '</section>';
    }

    var months = Object.keys(d.byMonth).sort().reverse().slice(0, 12);
    if (months.length) {
      html += '<section class="section"><div class="section-head"><h2 class="section-title">按月支出</h2>' +
        '<span class="section-note">最近 12 个有购入记录的月份</span></div>' +
        months.map(function (m) {
          return '<div class="acct-stat-row">' +
            '<span class="acct-stat-k">' + m + '</span>' +
            '<span class="acct-stat-v">' + moneyList(d.byMonth[m]) + '</span>' +
            '</div>';
        }).join('') + '</section>';
    }

    html += '<p class="fan-hint">愿望单不计入投入和均价。没有购入日期的游戏只进总额，不进年月统计。</p>';
    return html;
  }

  function exportAccountsCSV() {
    var list = accounts();
    if (!list.length) { toast('还没有账号'); return; }
    function cell(v) {
      var t = String(v == null ? '' : v);
      if (/[",\n]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
      return t;
    }
    var rows = [['账号名', '昵称', '平台', '区服', '货币', '余额', '会员', '到期日', '二次验证', '账号状态', '注册日期', '好友码', '邮箱', '游戏数', '游戏清单']];
    list.forEach(function (a) {
      rows.push([
        a.name, a.nickname, a.platform, a.region, a.currency, a.balance,
        membershipLabel(a.membership), a.membershipEnd, a.twoFA, a.status, a.registeredAt,
        a.friendCode, a.email, a.games.length,
        a.games.map(function (g) { return g.name + '(' + gameStatusLabel(g.status) + ')'; }).join(' / ')
      ]);
    });
    var csv = rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n');
    downloadBlob(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), 'accounts-' + todayISO() + '.csv');
    toast('已导出 ' + list.length + ' 个账号');
  }

  function openAccountEditor(id) {
    var cur = id ? accounts().filter(function (a) { return a.id === id; })[0] : null;
    var d = cur ? JSON.parse(JSON.stringify(cur)) : {
      id: uid(), name: '', nickname: '', email: '', twoFA: '', platform: 'Nintendo Switch',
      region: '国区', currency: 'CNY', friendCode: '', membership: '', membershipEnd: '',
      registeredAt: '', status: 'normal', games: [], balance: 0, note: ''
    };
    var plats = platformOptions();
    if (d.platform && plats.indexOf(d.platform) < 0) plats.unshift(d.platform);

    var root = document.getElementById('modal-root');
    root.innerHTML = '<div class="modal-backdrop">' +
      '<div class="modal acct-modal" role="dialog" aria-modal="true">' +
      '<h3 class="modal-title">' + (cur ? '编辑账号' : '新增账号') + '</h3>' +
      '<p class="modal-desc">一台主机或一个平台一条。</p>' +
      '<div class="acct-form">' +
      '<p class="acct-sec">基本信息</p>' +
      '<label class="field"><span class="field-label">账号名</span>' +
      '<input class="input" id="acct-name" maxlength="40" placeholder="Switch 1 / Steam 主号" value="' + esc(d.name) + '"></label>' +
      '<div class="row2">' +
      '<label class="field"><span class="field-label">昵称 / 玩家 ID</span>' +
      '<input class="input" id="acct-nickname" maxlength="40" placeholder="游戏内昵称" value="' + esc(d.nickname) + '"></label>' +
      '<label class="field"><span class="field-label">好友码</span>' +
      '<input class="input" id="acct-friend" maxlength="40" placeholder="SW-1234-5678-9012" value="' + esc(d.friendCode) + '"></label>' +
      '</div>' +
      '<div class="field"><span class="field-label">平台</span>' +
      '<div class="acct-plat-row">' +
      '<select class="input" id="acct-platform">' + plats.map(function (x) {
        return '<option value="' + esc(x) + '"' + (d.platform === x ? ' selected' : '') + '>' + esc(x) + '</option>';
      }).join('') + '</select>' +
      '<button class="btn btn-ghost btn-sm" data-acct="newplat" type="button">＋ 平台</button>' +
      '</div>' +
      '<div class="acct-newplat hidden" id="acct-newplat">' +
      '<input class="input" id="acct-newplat-input" maxlength="40" placeholder="新平台名">' +
      '<button class="btn btn-primary btn-sm" data-acct="addplat" type="button">加入</button>' +
      '</div></div>' +
      '<div class="row2">' +
      '<label class="field"><span class="field-label">区服</span>' +
      '<input class="input" id="acct-region" list="acct-region-list" maxlength="40" placeholder="国区 / 港区 / 日区" value="' + esc(d.region) + '">' +
      '<datalist id="acct-region-list">' + REGIONS.map(function (r) {
        return '<option value="' + esc(r.label) + '"></option>';
      }).join('') + '</datalist></label>' +
      '<label class="field"><span class="field-label">货币</span>' +
      '<select class="input" id="acct-currency">' + CURRENCIES.map(function (c) {
        return '<option value="' + c.code + '"' + (d.currency === c.code ? ' selected' : '') + '>' +
          c.code + ' · ' + c.label + '</option>';
      }).join('') + '</select></label>' +
      '</div>' +
      '<label class="field"><span class="field-label">余额</span>' +
      '<input class="input" id="acct-balance" type="number" min="0" step="0.01" placeholder="0.00" value="' + (d.balance || '') + '"></label>' +

      '<p class="acct-sec">账号安全</p>' +
      '<label class="field"><span class="field-label">登录邮箱</span>' +
      '<input class="input" id="acct-email" type="email" maxlength="80" placeholder="只记提示，不要填密码" value="' + esc(d.email) + '"></label>' +
      '<div class="row2">' +
      '<label class="field"><span class="field-label">二次验证</span>' +
      '<select class="input" id="acct-2fa">' +
      [['', '不记'], ['off', '未开启'], ['email', '邮箱验证'], ['phone', '手机验证'], ['app', '验证器 App']].map(function (x) {
        return '<option value="' + x[0] + '"' + (d.twoFA === x[0] ? ' selected' : '') + '>' + x[1] + '</option>';
      }).join('') + '</select></label>' +
      '<label class="field"><span class="field-label">账号状态</span>' +
      '<select class="input" id="acct-status">' +
      [['normal', '正常'], ['limited', '受限'], ['banned', '封禁']].map(function (x) {
        return '<option value="' + x[0] + '"' + (d.status === x[0] ? ' selected' : '') + '>' + x[1] + '</option>';
      }).join('') + '</select></label>' +
      '</div>' +
      '<label class="field"><span class="field-label">注册日期</span>' +
      '<input class="input" id="acct-registered" type="date" value="' + esc(d.registeredAt) + '"></label>' +

      '<p class="acct-sec">会员</p>' +
      '<div class="row2">' +
      '<label class="field"><span class="field-label">会员类型</span>' +
      '<select class="input" id="acct-membership">' + MEMBERSHIPS.map(function (m) {
        return '<option value="' + m.key + '"' + (d.membership === m.key ? ' selected' : '') + '>' + esc(m.label) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="field"><span class="field-label">到期日</span>' +
      '<input class="input" id="acct-mem-end" type="date" value="' + esc(d.membershipEnd) + '"></label>' +
      '</div>' +

      '<p class="acct-sec">游戏与备注</p>' +
      '<label class="field"><span class="field-label">游戏清单</span>' +
      '<textarea class="input" id="acct-games" rows="4" placeholder="一行一个，也支持逗号、顿号、分号、竖线分隔">' +
      esc(d.games.map(function (g) { return g.name; }).join('\n')) + '</textarea></label>' +
      '<p class="hint" style="margin:-4px 0 0">想标状态、价格或购入日期，保存后点卡片上的游戏名。</p>' +
      '<label class="field"><span class="field-label">备注</span>' +
      '<input class="input" id="acct-note" maxlength="200" placeholder="选填" value="' + esc(d.note) + '"></label>' +
      '</div>' +
      '<div class="modal-actions">' +
      '<button class="btn btn-ghost" data-acct="cancel">取消</button>' +
      '<button class="btn btn-primary" data-acct="save">保存</button>' +
      '</div></div></div>';

    function close() { root.innerHTML = ''; }
    root.querySelector('[data-acct="cancel"]').addEventListener('click', close);
    var backdrop = root.querySelector('.modal-backdrop');
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });

    var platBox = root.querySelector('#acct-newplat');
    root.querySelector('[data-acct="newplat"]').addEventListener('click', function () {
      platBox.classList.toggle('hidden');
      if (!platBox.classList.contains('hidden')) {
        var inp = root.querySelector('#acct-newplat-input');
        if (inp) inp.focus();
      }
    });
    root.querySelector('[data-acct="addplat"]').addEventListener('click', function () {
      var inp = root.querySelector('#acct-newplat-input');
      var name = String(inp && inp.value || '').trim().slice(0, 40);
      if (!name) { toast('先填平台名'); return; }
      var arr = (state.prefs.platforms || []).slice();
      if (arr.indexOf(name) < 0 && DEFAULT_PLATFORMS.indexOf(name) < 0) arr.push(name);
      state.prefs.platforms = arr;
      savePrefs();
      var sel = root.querySelector('#acct-platform');
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
      sel.value = name;
      if (inp) inp.value = '';
      platBox.classList.add('hidden');
      toast('已加入平台列表');
    });

    var regionEl = root.querySelector('#acct-region');
    if (regionEl) {
      var syncCurrency = function () {
        var rg = REGIONS.filter(function (x) { return x.label === String(regionEl.value || '').trim(); })[0];
        if (rg) root.querySelector('#acct-currency').value = rg.currency;
      };
      regionEl.addEventListener('input', syncCurrency);
      regionEl.addEventListener('change', syncCurrency);
    }

    root.querySelector('[data-acct="save"]').addEventListener('click', function () {
      var name = String(root.querySelector('#acct-name').value || '').trim();
      if (!name) { toast('先填账号名'); return; }
      /* 文本域只负责增删游戏名；已有游戏的状态/价格/购入日期原样保留 */
      var names = parseGameList(root.querySelector('#acct-games').value);
      var oldMap = {};
      (d.games || []).forEach(function (g) { oldMap[g.name] = g; });
      var games = names.map(function (n) {
        return oldMap[n] || { name: n, status: 'owned', price: 0, buyDate: '' };
      });
      var rec = normalizeAccount({
        id: d.id,
        name: name,
        nickname: root.querySelector('#acct-nickname').value,
        email: root.querySelector('#acct-email').value,
        twoFA: root.querySelector('#acct-2fa').value,
        platform: root.querySelector('#acct-platform').value,
        region: root.querySelector('#acct-region').value,
        currency: root.querySelector('#acct-currency').value,
        friendCode: root.querySelector('#acct-friend').value,
        membership: root.querySelector('#acct-membership').value,
        membershipEnd: root.querySelector('#acct-mem-end').value,
        registeredAt: root.querySelector('#acct-registered').value,
        status: root.querySelector('#acct-status').value,
        balance: root.querySelector('#acct-balance').value,
        games: games,
        note: root.querySelector('#acct-note').value,
        updatedAt: Date.now()
      });
      if (!rec) { toast('保存失败，检查一下账号名'); return; }
      var arr = accounts().slice();
      var idx = -1;
      for (var i = 0; i < arr.length; i++) if (arr[i].id === rec.id) { idx = i; break; }
      if (idx >= 0) arr[idx] = rec; else arr.unshift(rec);
      state.prefs.accounts = arr;
      flushPrefsDB().then(function (ok) {
        if (!ok) { toast('账号没写入数据库，请重试'); return; }
        close();
        render({ keepScroll: true });
        toast(cur ? '已保存' : '已添加');
      });
    });
  }

  function openGameEditor(accountId, idx) {
    var a = accounts().filter(function (x) { return x.id === accountId; })[0];
    if (!a || !a.games[idx]) return;
    var g = a.games[idx];
    var st = g.status;
    var root = document.getElementById('modal-root');
    root.innerHTML = '<div class="modal-backdrop">' +
      '<div class="modal acct-modal" role="dialog" aria-modal="true">' +
      '<h3 class="modal-title">' + esc(g.name) + '</h3>' +
      '<p class="modal-desc">' + esc(a.name) + ' · 标记状态和购入信息</p>' +
      '<div class="acct-form">' +
      '<div class="field"><span class="field-label">状态</span>' +
      '<div class="game-status-row">' + GAME_STATUS.map(function (x) {
        return '<button class="game-status' + (st === x.key ? ' is-on' : '') + '" data-gstat="' + x.key + '" type="button">' + x.label + '</button>';
      }).join('') + '</div></div>' +
      '<div class="row2">' +
      '<label class="field"><span class="field-label">购入价（' + esc(a.currency) + '）</span>' +
      '<input class="input" id="game-price" type="number" min="0" step="0.01" placeholder="0.00" value="' + (g.price || '') + '"></label>' +
      '<label class="field"><span class="field-label">购入日期</span>' +
      '<input class="input" id="game-date" type="date" value="' + esc(g.buyDate) + '"></label>' +
      '</div>' +
      '</div>' +
      '<div class="modal-actions">' +
      '<button class="btn btn-ghost" data-game="cancel">取消</button>' +
      '<button class="btn btn-danger" data-game="del">移除</button>' +
      '<button class="btn btn-primary" data-game="save">保存</button>' +
      '</div></div></div>';

    function close() { root.innerHTML = ''; }
    root.querySelector('[data-game="cancel"]').addEventListener('click', close);
    var backdrop = root.querySelector('.modal-backdrop');
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    root.querySelectorAll('[data-gstat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        st = btn.dataset.gstat;
        root.querySelectorAll('[data-gstat]').forEach(function (b) {
          b.classList.toggle('is-on', b.dataset.gstat === st);
        });
      });
    });
    root.querySelector('[data-game="save"]').addEventListener('click', function () {
      var arr = accounts().slice();
      var hit = arr.filter(function (x) { return x.id === accountId; })[0];
      if (!hit) return;
      hit.games[idx] = normalizeGame({
        name: g.name,
        status: st,
        price: root.querySelector('#game-price').value,
        buyDate: root.querySelector('#game-date').value
      });
      hit.updatedAt = Date.now();
      state.prefs.accounts = arr;
      savePrefs();
      close();
      render({ keepScroll: true });
      toast('已保存');
    });
    root.querySelector('[data-game="del"]').addEventListener('click', function () {
      var arr = accounts().slice();
      var hit = arr.filter(function (x) { return x.id === accountId; })[0];
      if (!hit) return;
      hit.games.splice(idx, 1);
      hit.updatedAt = Date.now();
      state.prefs.accounts = arr;
      savePrefs();
      close();
      render({ keepScroll: true });
      toast('已移除');
    });
  }

  /* ---------------- 收藏册：翻书 ---------------- */

  function bookNarrow() {
    return (window.innerWidth || document.documentElement.clientWidth || 390) < 720;
  }

  /* 册子设置：每页张数 / 入册顺序 / 风格 / 音效 / 票根，全在收藏册里切换 */
  function openBookSettings() {
    var t = state.book.type || typesOn()[0];
    var cfg = bookCfg();
    function seg(key, label, opts) {
      return '<div class="bk-set-row"><span class="bk-set-label">' + label + '</span>' +
        '<div class="bk-set-opts">' + opts.map(function (o) {
          return '<button class="bk-set-opt' + (o[2] ? ' is-on' : '') + '" data-action="bk-set" ' +
            'data-key="' + key + '" data-value="' + o[0] + '">' + o[1] + '</button>';
        }).join('') + '</div></div>';
    }
    var body = '<div class="bk-settings">' +
      seg('per', '每页张数', [[1, '1 张', cfg.per === 1], [2, '2 张', cfg.per === 2], [4, '4 张', cfg.per === 4]]) +
      seg('order', '入册顺序', [['seq', '顺序入册', cfg.order === 'seq'], ['new', '最新优先', cfg.order === 'new']]) +
      seg('album', '册子风格', [
        ['grid', '方格黑卡', cfg.album === 'grid'], ['dots', '墨点手账', cfg.album === 'dots'],
        ['astral', '月相星图', cfg.album === 'astral'], ['velvet', '绿绒牌桌', cfg.album === 'velvet']
      ]) +
      seg('sound', '入册音效', [['on', '开启', cfg.sound], ['off', '关闭', !cfg.sound]]) +
      (isTicketType(t)
        ? seg('ticket', '本册显示', [
          ['stub', '纪念票根', cfg.ticket[t] === 'stub'],
          ['card', '标准卡', cfg.ticket[t] === 'card']
        ])
        : '') +
      '</div>';
    openModal({
      title: '册子设置',
      desc: TYPES[t].label + ' · 只影响收藏册的翻阅方式',
      body: body,
      actions: [{ label: '完成', value: null, variant: 'primary' }]
    });
  }

  function bookCard(r) {
    var cfg = bookCfg();
    if (isTicketType(r.type) && cfg.ticket[r.type] === 'stub') {
      return '<div class="bk-item is-tk" data-action="record-card" data-id="' + r.id + '">' +
        ticketHTML(r, 'mini') + '</div>';
    }
    return '<div class="bk-item" data-action="record-card" data-id="' + r.id + '">' +
      '<div class="bk-cover" style="--cc:' + coverColor(r.title) + '">' + coverInner(r) + '</div>' +
      '<div class="bk-info">' +
      '<b>' + esc(r.title) + '</b>' +
      '<span>' + esc(cardSub(r)) + '</span>' +
      '<i>' + (doneISO(r) || '—') + '</i>' +
      '</div></div>';
  }

  function bookPageHTML(list, pageNo, per) {
    var start = pageNo * per;
    var slice = list.slice(start, start + per);
    var body;
    if (!slice.length) {
      body = '<div class="bk-blank"><span>' + (pageNo === 0 ? '这一册还空着' : '') + '</span></div>';
    } else {
      body = '<div class="bk-cards per-' + per + '">' + slice.map(bookCard).join('') + '</div>';
    }
    return '<div class="bk-inner">' + body +
      '<span class="bk-folio">' + (slice.length ? (start + 1) + '–' + (start + slice.length) : '') + '</span></div>';
  }

  function bookView(type) {
    if (TYPE_KEYS.indexOf(type) < 0) type = typesOn()[0];
    if (state.book.type !== type) {
      state.book.type = type;
      var pos = (state.prefs.book && state.prefs.book.pos) || {};
      state.book.page = Number(pos[type]) || 0;
    }
    var cfg = bookCfg();
    var ticketMode = isTicketType(type) && cfg.ticket[type] === 'stub';
    var per = ticketMode ? 1 : cfg.per;
    var single = bookNarrow();
    var perView = single ? per : per * 2;
    var list = bookList(type);
    var total = Math.max(1, Math.ceil(list.length / perView));
    var page = Math.min(Math.max(0, state.book.page || 0), total - 1);
    state.book.page = page;

    var html = '<header class="page-head bk-head">' +
      '<div class="head-left"><button class="icon-btn" data-action="go" data-to="book" aria-label="返回收藏册">' + icon('back', 20) + '</button>' +
      '<div><p class="eyebrow">' + list.length + ' 张 · 第 ' + (page + 1) + ' / ' + total + ' 翻</p>' +
      '<h1 class="page-title">' + TYPES[type].label + '</h1></div></div>' +
      '<div class="head-actions">' +
      '<button class="icon-btn" data-action="bk-settings" aria-label="册子设置">' + icon('gear', 18) + '</button>' +
      (type === 'game' ? '<button class="icon-btn" data-action="go" data-to="accounts" aria-label="游戏账号库">' + icon('game', 18) + '</button>' : '') +
      '<button class="icon-btn" data-action="yb-open" data-value="' + type + '" aria-label="年度档案">' + icon('stamp', 19) + '</button>' +
      '</div></header>';

    html += '<div class="bk-bar"><span>' + (cfg.order === 'new' ? '最新优先' : '顺序入册') +
      ' · 每页 ' + per + ' 张' + (single ? '' : ' · 双页') + '</span>' +
      '<span>' + (isTicketType(type) && cfg.ticket[type] === 'stub' ? '票根模式' : '卡片模式') + '</span></div>';

    if (!list.length) {
      html += '<div class="empty"><div class="empty-mark">·</div>' +
        '<p class="empty-title">这一册还没有内容</p>' +
        '<p class="empty-text">记一条' + TYPES[type].label + '，它就会入册。</p>' +
        '<button class="btn btn-primary btn-sm" data-action="new">＋ 记录一条</button></div>';
      return html;
    }

    html += '<div class="bk' + (single ? ' is-single' : '') + '" id="bk" data-album="' + cfg.album + '">' +
      '<div class="bk-spread">' +
      '<div class="bk-page left">' + bookPageHTML(list, page * perView, per) + '</div>' +
      (single ? '' : '<div class="bk-page right">' + bookPageHTML(list, page * perView + per, per) + '</div>') +
      '<div class="bk-leaf"></div>' +
      '</div>' +
      '<button class="bk-mark" data-action="book-jump" aria-label="快速翻阅">' +
      '<span>' + (page >= total - 1 && total > 1 ? '开头' : '末尾') + '</span></button>' +
      '<button class="bk-nav prev" data-action="book-prev" aria-label="上一页"' + (page === 0 ? ' disabled' : '') + '>' +
      icon('chevron-left', 22) + '</button>' +
      '<button class="bk-nav next" data-action="book-next" aria-label="下一页"' + (page >= total - 1 ? ' disabled' : '') + '>' +
      icon('chevron-right', 22) + '</button>' +
      '</div>';

    html += '<div class="book-ins" id="book-ins"></div>';
    return html;
  }

  var bookInsTimer = null;

  function bookFlip(dir) {
    var el = document.getElementById('bk');
    if (!el || el.dataset.flipping) return;
    var cfg = bookCfg();
    var ticketMode = isTicketType(state.book.type) && cfg.ticket[state.book.type] === 'stub';
    var per = ticketMode ? 1 : cfg.per;
    var single = bookNarrow();
    var perView = single ? per : per * 2;
    var list = bookList(state.book.type);
    var total = Math.max(1, Math.ceil(list.length / perView));
    var i = state.book.page;
    var target = i + dir;
    if (target < 0 || target >= total) return;

    var leaf = el.querySelector('.bk-leaf');
    if (!leaf) { state.book.page = target; render({ keepScroll: true }); return; }

    var front, back;
    if (single) {
      /* 单页模式：先铺好目标页，再让当前页翻过去 */
      var leftEl = el.querySelector('.bk-page.left');
      if (leftEl) leftEl.innerHTML = bookPageHTML(list, target * perView, per);
      if (dir > 0) {
        front = bookPageHTML(list, i * perView, per);
        back = bookPageHTML(list, target * perView, per);
        leaf.className = 'bk-leaf is-next';
      } else {
        front = bookPageHTML(list, target * perView, per);
        back = bookPageHTML(list, i * perView, per);
        leaf.className = 'bk-leaf is-prev';
      }
    } else if (dir > 0) {
      front = bookPageHTML(list, i * perView + per, per);
      back = bookPageHTML(list, (i + 1) * perView, per);
      leaf.className = 'bk-leaf is-next';
    } else {
      front = bookPageHTML(list, (i - 1) * perView + per, per);
      back = bookPageHTML(list, i * perView, per);
      leaf.className = 'bk-leaf is-prev';
    }
    leaf.innerHTML = '<div class="leaf-face front">' + front + '</div>' +
      '<div class="leaf-face back">' + back + '</div>';
    el.dataset.flipping = '1';
    requestAnimationFrame(function () { leaf.classList.add('go'); });
    playFlipSound();
    setTimeout(function () {
      state.book.page = target;
      var pos = (state.prefs.book && state.prefs.book.pos) || {};
      pos[state.book.type] = target;
      saveBookCfg({ pos: pos });
      render({ keepScroll: true });
    }, 640);
  }

  /* ---------------- 声音（WebAudio 合成，无外部资源） ---------------- */

  var audioCtx = null;

  function tone(freq, dur, gain, type, delay) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var t0 = audioCtx.currentTime + (delay || 0);
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = type || 'triangle';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* 静默 */ }
  }

  function playFlipSound() {
    if (!bookCfg().sound) return;
    tone(760, 0.05, 0.035, 'triangle', 0);
    tone(420, 0.07, 0.028, 'triangle', 0.05);
  }

  function playSettleSound() {
    if (!bookCfg().sound) return;
    tone(150, 0.16, 0.09, 'sine', 0);
    tone(1500, 0.04, 0.03, 'square', 0.02);
  }

  /* ---------------- 新卡入册演出 ---------------- */

  var bookInsPlaying = false;

  function bookMaybeInsert() {
    if (state.route.name !== 'book' || !state.route.id) return;
    if (bookInsPlaying) return;
    var r = bookPending();
    if (!r) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      markBookSeen(r.id);
      return;
    }
    var host = document.getElementById('book-ins');
    if (!host) return;
    var tier = r.rating >= 9 ? 3 : (r.rating > 8 ? 2 : 1);
    bookInsPlaying = true;
    host.className = 'book-ins is-on tier-' + tier;
    host.innerHTML = '<div class="ins-veil"></div>' +
      '<div class="ins-stage">' +
      '<div class="ins-slot"></div>' +
      '<div class="ins-card" style="--cc:' + coverColor(r.title) + '">' + coverInner(r) + '</div>' +
      (tier === 1 ? '<span class="ins-zap z1">✦</span><span class="ins-zap z2">✦</span>' : '') +
      '<span class="ins-cap">' + esc(r.title) + ' · 已入册</span>' +
      '</div>';
    clearTimeout(bookInsTimer);
    bookInsTimer = setTimeout(function () {
      host.className = 'book-ins';
      host.innerHTML = '';
      bookInsPlaying = false;
      /* 中途离开就不算看过，下次进来重播 */
      if (state.route.name === 'book' && state.route.id) markBookSeen(r.id);
    }, 2600);
    setTimeout(playSettleSound, 1500);
  }

  /* ---------------- 年度档案（年份跨页） ---------------- */

  function ybGroups(type) {
    var t = type || state.archive.type || '';
    var map = {};
    state.records.forEach(function (r) {
      if (t && r.type !== t) return;
      var y = yearOf(r);
      (map[y] = map[y] || []).push(r);
    });
    return Object.keys(map).sort(function (a, b) {
      if (a === 'earlier') return -1;
      if (b === 'earlier') return 1;
      return Number(b) - Number(a);
    }).map(function (k) { return { key: k, list: map[k] }; });
  }

  function ybStats(list) {
    var done = list.filter(function (r) { return r.status === 'done'; });
    var hours = list.reduce(function (a, r) { return a + (r.hours || 0); }, 0);
    var rated = list.filter(function (r) { return r.rating > 0; });
    var avg = rated.length ? rated.reduce(function (a, r) { return a + r.rating; }, 0) / rated.length : 0;
    var types = {};
    list.forEach(function (r) { types[r.type] = (types[r.type] || 0) + 1; });
    var typeN = Object.keys(types).length;
    var topType = Object.keys(types).sort(function (a, b) { return types[b] - types[a]; })[0] || '';
    var months = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    list.forEach(function (r) {
      var d = doneISO(r) || ymd(new Date(r.createdAt));
      var m = Number(d.slice(5, 7)) - 1;
      if (m >= 0 && m < 12) months[m]++;
    });
    var topM = 0;
    months.forEach(function (n, i) { if (n > months[topM]) topM = i; });
    var best = list.filter(function (r) { return r.rating > 0; })
      .sort(function (a, b) { return b.rating - a.rating || (b.hours || 0) - (a.hours || 0); })[0] || list[0];
    var longest = list.slice().sort(function (a, b) { return (b.hours || 0) - (a.hours || 0); })[0];
    return {
      n: list.length, done: done.length, hours: hours, avg: avg,
      typeN: typeN, topType: topType, months: months, topM: topM,
      topMN: months[topM], best: best, longest: longest,
      rate: list.length ? Math.round(done.length / list.length * 100) : 0
    };
  }

  function ybStampCands(list) {
    var st = ybStats(list);
    var out = [
      { k: 'done', label: 'COMPLETED', big: String(st.done), unit: '部完成', color: '#C8102E' },
      { k: 'hours', label: 'TIME SPENT', big: fmtHours(st.hours), unit: '小时', color: '#1A1A1A' },
      { k: 'rate', label: 'FINISH RATE', big: st.rate + '%', unit: '完成率', color: '#1F5FBF' },
      { k: 'types', label: 'VARIETY', big: String(st.typeN), unit: '种类型', color: '#0E7C66' },
      { k: 'month', label: 'BUSIEST', big: (st.topM + 1) + '月', unit: st.topMN + ' 部', color: '#B26A00' }
    ];
    if (st.best) out.push({ k: 'best', label: 'HIGHEST', big: ratingText(st.best.rating), unit: st.best.title, color: '#6B4FBB' });
    if (st.longest && st.longest.hours) out.push({ k: 'long', label: 'LONGEST', big: fmtHours(st.longest.hours), unit: st.longest.title, color: '#8A3B12' });
    return out;
  }

  function ybStampSet(yearKey, list) {
    var cands = ybStampCands(list);
    var sk = (state.archive.type || '') + ':' + yearKey;
    var off = Number((state.prefs.ybStamp || {})[sk]) || 0;
    var out = [];
    for (var i = 0; i < 3 && i < cands.length; i++) out.push(cands[(off + i) % cands.length]);
    return out;
  }

  function ybYearHTML(g, idx, totalYears) {
    var st = ybStats(g.list);
    var stamps = ybStampSet(g.key, g.list);
    var label = g.key === 'earlier' ? '更早' : g.key;

    var left = '<div class="yb-left">' +
      (g.key !== 'earlier' ? '<span class="yb-redstamp">YEAR<br>REVIEW</span>' : '') +
      '<p class="yb-kicker">YEAR IN REVIEW</p>' +
      '<div class="yb-yearnum">' + esc(label) + '</div>' +
      '<div class="yb-statgrid">' +
      '<div><b>' + st.n + '</b><span>收录</span></div>' +
      '<div><b>' + st.done + '</b><span>完成</span></div>' +
      '<div><b>' + fmtHours(st.hours) + '</b><span>小时</span></div>' +
      '<div><b>' + ratingText(st.avg) + '</b><span>均分</span></div>' +
      '</div>' +
      '<div class="yb-stamps">' + stamps.map(function (s, i) {
        return '<button class="yb-seal s' + i + '" data-action="yb-stamp" data-value="' + g.key + '" ' +
          'style="--sc:' + s.color + '" title="换一枚">' +
          '<span class="seal-in">' +
          '<b>' + esc(s.big) + '</b>' +
          '<i>' + esc(s.unit) + '</i>' +
          '<em>' + esc(s.label) + '</em>' +
          '</span></button>';
      }).join('') + '</div>' +
      '<p class="yb-hint">点邮票换一枚 · 第 1 名票根盖年度红章</p>' +
      '</div>';

    var favs = g.list.filter(function (r) { return r.rating > 0; })
      .sort(function (a, b) { return b.rating - a.rating || (b.hours || 0) - (a.hours || 0); })
      .slice(0, 3);

    var right = '<div class="yb-right">' +
      '<p class="yb-kicker">FAVORITES OF THE YEAR</p>' +
      (favs.length
        ? '<div class="yb-favs">' + favs.map(function (r, i) {
          return '<button class="yb-fav r' + (i + 1) + '" data-action="record-card" data-id="' + r.id + '">' +
            '<span class="yb-fav-rank">0' + (i + 1) + '</span>' +
            '<span class="yb-fav-art" style="--cc:' + coverColor(r.title) + '">' + coverInner(r) + '</span>' +
            '<span class="yb-fav-main"><b>' + esc(r.title) + '</b>' +
            '<i>' + TYPES[r.type].label + ' · ' + (doneISO(r) || '—') + '</i>' +
            '<span class="yb-fav-foot">' +
            '<em>' + ratingText(r.rating) + '</em>' +
            '<span class="yb-pips lv' + Math.min(5, Math.max(1, Math.ceil((r.rating || 0) / 2))) +
            (r.rating >= 9.5 ? ' is-shiny' : '') + '">' +
            new Array(Math.min(5, Math.max(1, Math.ceil((r.rating || 0) / 2))) + 1).join('<i></i>') +
            '</span>' +
            (!ticketStill(r) ? '<span class="yb-nocover">无封面</span>' : '') +
            '</span></span>' +
            (i === 0 ? '<span class="yb-no1">FAVORITE OF THE YEAR · No.1</span>' : '') +
            '</button>';
        }).join('') + '</div>'
        : '<p class="yb-empty">这一年还没有打分的作品。</p>') +
      '</div>';

    var months = '<section class="yb-sheet">' +
      '<p class="yb-kicker">MONTH BY MONTH · 月份足迹</p>' +
      '<div class="yb-months">' + st.months.map(function (n, i) {
        return '<button class="yb-month' + (n ? ' has' : '') + (state.ui.ybMonth === i + 1 ? ' is-on' : '') +
          '" data-action="yb-month" data-value="' + (i + 1) + '">' +
          '<b>' + (i + 1) + '</b>' +
          '<span class="yb-dots">' + new Array(Math.min(n, 5) + 1).join('<i></i>') + '</span>' +
          '<em>' + (n ? n : '') + '</em></button>';
      }).join('') + '</div>' +
      (function () {
        if (!state.ui.ybMonth) return '<p class="yb-hint">点一个月，展开当月入册的全部。</p>';
        var m = state.ui.ybMonth;
        var items = g.list.filter(function (r) {
          var d = doneISO(r) || ymd(new Date(r.createdAt));
          return Number(d.slice(5, 7)) === m;
        });
        return '<div class="yb-monthlist"><p class="yb-sub">' + m + ' 月 · ' + items.length + ' 条</p>' +
          (items.length ? items.map(function (r) {
            return '<button class="yb-row" data-action="record-card" data-id="' + r.id + '">' +
              '<span class="yb-row-art" style="--cc:' + coverColor(r.title) + '">' + coverInner(r) + '</span>' +
              '<span class="yb-row-main"><b>' + esc(r.title) + '</b>' +
              '<i>' + TYPES[r.type].label + ' · ' + (doneISO(r) || '—') + '</i></span>' +
              '<em>' + (r.rating ? ratingText(r.rating) : '') + '</em></button>';
          }).join('') : '<p class="yb-empty">这个月没有记录。</p>') + '</div>';
      })() +
      '</section>';

    var IDX = 24;
    var sortedIdx = g.list.slice().sort(function (a, b) {
      return (doneISO(b) || '').localeCompare(doneISO(a) || '');
    });
    var idxMax = Math.max(1, Math.ceil(sortedIdx.length / IDX));
    var idxPage = Math.min(Math.max(1, Number(state.ui.ybIndex) || 1), idxMax);
    var idxSlice = sortedIdx.slice((idxPage - 1) * IDX, idxPage * IDX);
    var index = '<section class="yb-sheet">' +
      '<div class="yb-indexhead"><p class="yb-kicker">INDEX · 本年目录</p>' +
      (idxMax > 1
        ? '<div class="yb-pager">' +
        '<button data-action="yb-idx" data-value="' + (idxPage - 1) + '"' + (idxPage <= 1 ? ' disabled' : '') + '>' + icon('chevron-left', 13) + '</button>' +
        '<span>' + idxPage + ' / ' + idxMax + '</span>' +
        '<button data-action="yb-idx" data-value="' + (idxPage + 1) + '"' + (idxPage >= idxMax ? ' disabled' : '') + '>' + icon('chevron-right', 13) + '</button>' +
        '</div>' : '') +
      '</div>' +
      '<div class="yb-index">' + idxSlice.map(function (r, i) {
        return '<button class="yb-row" data-action="record-card" data-id="' + r.id + '">' +
          '<span class="yb-row-n">' + ((idxPage - 1) * IDX + i + 1) + '</span>' +
          '<span class="yb-row-main"><b>' + esc(r.title) + '</b>' +
          '<i>' + TYPES[r.type].label + ' · ' + esc(r.creator || '—') + '</i></span>' +
          '<span class="yb-row-date">' + (doneISO(r) || '—') + '</span>' +
          '<em>' + (r.rating ? ratingText(r.rating) : '') + '</em></button>';
      }).join('') + '</div></section>';

    return '<div class="yb-year" data-year="' + g.key + '">' +
      '<div class="yb-tabs">' +
      (idx > 0 ? '<button class="yb-tab-arrow" data-action="yb-year" data-value="' + ybGroups()[idx - 1].key + '" aria-label="上一年">' + icon('chevron-left', 16) + '</button>' : '') +
      ybGroups().map(function (x, i) {
        return '<button class="yb-tab' + (i === idx ? ' is-on' : '') + '" data-action="yb-year" data-value="' + x.key + '">' +
          (x.key === 'earlier' ? '更早' : x.key) + '</button>';
      }).join('') +
      (idx < totalYears - 1 ? '<button class="yb-tab-arrow" data-action="yb-year" data-value="' + ybGroups()[idx + 1].key + '" aria-label="下一年">' + icon('chevron-right', 16) + '</button>' : '') +
      '</div>' +
      months +
      '<section class="yb-sheet yb-spread is-live">' + left + right + '</section>' +
      index +
      '</div>';
  }

  /* 本年报告卡：由年度档案生成，可保存成图片 */
  function ybReportHTML(t, yearKey) {
    if (!/^\d{4}$/.test(String(yearKey))) return '';   /* 「更早」组不生成年份页/报告卡 */
    var rs = state.report;
    var active = !!(rs.data && String(rs.year) === String(yearKey) && rs.type === t);
    var html = '<section class="yb-sheet yb-report">' +
      '<div class="yb-indexhead"><p class="yb-kicker">REPORT CARD · 本年报告卡</p>' +
      '<button class="btn btn-ghost btn-sm" data-action="yb-report">' +
      (active ? '重新生成' : '生成') + '</button></div>';
    if (active) {
      html += '<div class="report-wrap">' + reportCardHTML(rs.data) + '</div>' +
        '<div class="yb-report-ops"><button class="btn btn-primary btn-sm" data-action="yb-report-save">' +
        icon('download', 14) + ' 保存图片</button></div>';
    } else {
      html += '<p class="yb-hint">生成 ' + esc(String(yearKey)) + ' 年「' + TYPES[t].label +
        '」的总结卡，可保存成图片。</p>';
    }
    return html + '</section>';
  }

  function saveReportCard() {
    var d = state.report.data;
    if (!d) return;
    toast('正在生成图片…');
    makePosterCanvas().then(function (cv) {
      cv.toBlob(function (blob) {
        if (!blob) { toast('生成失败'); return; }
        downloadBlob(blob, 'cimeibu-' + d.year + '-' + (d.types || 'report') + '-' + todayISO() + '.png');
        toast('报告卡已保存');
      }, 'image/png');
    }).catch(function () {
      toast('生成失败，请稍后再试');
    });
  }

  function yearbookView(type) {
    var t = TYPE_KEYS.indexOf(type) >= 0 ? type
      : (TYPE_KEYS.indexOf(state.archive.type) >= 0 ? state.archive.type : typesOn()[0]);
    state.archive.type = t;
    var groups = ybGroups(t);

    var html = '<header class="page-head">' +
      '<div class="head-left"><button class="icon-btn" data-action="back" aria-label="返回">' + icon('back', 20) + '</button>' +
      '<div><p class="eyebrow">' + TYPES[t].label + ' · ' + groups.length + ' 个年份</p>' +
      '<h1 class="page-title">年度档案</h1></div></div>' +
      '<div class="head-actions">' +
      '<button class="icon-btn" data-action="settings" aria-label="设置">' + icon('gear', 20) + '</button>' +
      '</div></header>';

    if (!groups.length) {
      return html + '<div class="empty"><div class="empty-mark">·</div>' +
        '<p class="empty-title">' + TYPES[t].label + '还没有可归档的内容</p>' +
        '<p class="empty-text">记几条' + TYPES[t].label + '，这里会按完成年份排成一本年鉴。</p></div>';
    }

    var cur = String(state.archive.year || '');
    var idx = 0;
    for (var i = 0; i < groups.length; i++) if (groups[i].key === cur) idx = i;
    state.archive.year = groups[idx].key;

    html += '<p class="fan-hint">只统计「' + TYPES[t].label + '」。每年四页：月份足迹 → 年份与年度最爱 → 本年目录；年份标签可直达。</p>';
    html += ybYearHTML(groups[idx], idx, groups.length);
    html += ybReportHTML(t, groups[idx].key);
    return html;
  }

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
      '次元簿', 'home'
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
        '</div></div>' +
        watchingCard(featured) +
        (rest.length ? '<div class="rail" style="margin-top:12px">' + rest.map(railCard).join('') + '</div>' : '') +
        '</section>';
    }

    /* 更多入口 */
    var moreItems = [
      { to: 'week', ic: 'calendar', label: '本周追更', note: weekSchedule().reduce(function (a2, l) { return a2 + l.length; }, 0) + ' 部' },
      { to: 'authors', ic: 'user', label: '创作者', note: '' },
      { to: 'quotes', ic: 'quote', label: '摘抄库', note: allQuotes().length + ' 条' }
    ];
    html += '<section class="section"><div class="section-head"><h2 class="section-title">翻一翻</h2>' +
      '<button class="link-btn" data-action="random">' + icon('sparkle', 14) + ' 随机回顾</button></div>' +
      '<div class="more-grid">' + moreItems.map(function (m) {
        return '<button class="more-tile" data-action="go" data-to="' + m.to + '">' +
          icon(m.ic, 18) + '<b>' + m.label + '</b>' +
          (m.note ? '<i>' + m.note + '</i>' : '') + '</button>';
      }).join('') + '</div></section>';

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

  /* ---------------- 记录天数 / 年度档案 / 徽章 ---------------- */




  var TYPE_BADGE_NAME = {
    novel: ['初读', '书虫', '藏书家'],
    comic: ['初翻', '画迷', '漫画通'],
    anime: ['初看', '追番人', '番剧通'],
    tv: ['初看', '剧痴', '剧评人'],
    movie: ['初看', '影迷', '影评人'],
    variety: ['初看', '综艺咖', '综艺通'],
    drama: ['初听', '声控', '声优厨'],
    stage: ['初看', '剧场常客', '剧场老饕'],
    game: ['初玩', '玩家', '硬核玩家'],
    music: ['初听', '乐迷', '唱片藏家'],
    magazine: ['初订', '老订户', '期刊藏家']
  };

  var _typeCountsCache = null;
  function countType(s, k) {
    if (!_typeCountsCache) {
      var m = {};
      TYPE_KEYS.forEach(function (x) { m[x] = 0; });
      s.records.forEach(function (r) { if (m[r.type] != null) m[r.type]++; });
      _typeCountsCache = m;
    }
    return _typeCountsCache[k] || 0;
  }

  var BADGES = [
    /* 阶段：按总收录量，铜 → 银 → 金 */
    { key: 'n1', g: 'stage', tier: 'bronze', name: '初识', desc: '收录第 1 条', icon: 'sparkle', color: '#E8457A', goal: 1,
      val: function (s) { return s.records.length; } },
    { key: 'n5', g: 'stage', tier: 'bronze', name: '试水', desc: '收录 5 条', icon: 'layers', color: '#E8913D', goal: 5,
      val: function (s) { return s.records.length; } },
    { key: 'n10', g: 'stage', tier: 'bronze', name: '起步', desc: '收录 10 条', icon: 'layers', color: '#E8913D', goal: 10,
      val: function (s) { return s.records.length; } },
    { key: 'n25', g: 'stage', tier: 'silver', name: '常客', desc: '收录 25 条', icon: 'layers', color: '#3FA9E0', goal: 25,
      val: function (s) { return s.records.length; } },
    { key: 'n50', g: 'stage', tier: 'silver', name: '半百', desc: '收录 50 条', icon: 'medal', color: '#7C6BFF', goal: 50,
      val: function (s) { return s.records.length; } },
    { key: 'n100', g: 'stage', tier: 'gold', name: '百部', desc: '收录 100 条', icon: 'trophy', color: '#E8B33D', goal: 100,
      val: function (s) { return s.records.length; } },
    { key: 'n200', g: 'stage', tier: 'gold', name: '藏家', desc: '收录 200 条', icon: 'archive', color: '#A96BE0', goal: 200,
      val: function (s) { return s.records.length; } },
    { key: 'n300', g: 'stage', tier: 'gold', name: '三百', desc: '收录 300 条', icon: 'archive', color: '#D05FA8', goal: 300,
      val: function (s) { return s.records.length; } },
    { key: 'n500', g: 'stage', tier: 'gold', name: '大藏家', desc: '收录 500 条', icon: 'crown', color: '#D05FA8', goal: 500,
      val: function (s) { return s.records.length; } },
    { key: 'n800', g: 'stage', tier: 'gold', name: '八百', desc: '收录 800 条', icon: 'crown', color: '#E8B33D', goal: 800,
      val: function (s) { return s.records.length; } },
    { key: 'n1000', g: 'stage', tier: 'gold', name: '千卷', desc: '收录 1000 条', icon: 'diamond', color: '#5C8BE8', goal: 1000,
      val: function (s) { return s.records.length; } },
    { key: 'n1500', g: 'stage', tier: 'gold', name: '千五', desc: '收录 1500 条', icon: 'diamond', color: '#45AFA0', goal: 1500,
      val: function (s) { return s.records.length; } },
    { key: 'n2000', g: 'stage', tier: 'gold', name: '两千', desc: '收录 2000 条', icon: 'diamond', color: '#7C6BFF', goal: 2000,
      val: function (s) { return s.records.length; } },
    { key: 'n3000', g: 'stage', tier: 'gold', name: '三千', desc: '收录 3000 条', icon: 'crown', color: '#D05FA8', goal: 3000,
      val: function (s) { return s.records.length; } },
    { key: 'n5000', g: 'stage', tier: 'gold', name: '五千', desc: '收录 5000 条', icon: 'crown', color: '#E8B33D', goal: 5000,
      val: function (s) { return s.records.length; } },
    { key: 'n8000', g: 'stage', tier: 'gold', name: '八千', desc: '收录 8000 条', icon: 'trophy', color: '#E8457A', goal: 8000,
      val: function (s) { return s.records.length; } },
    { key: 'n10000', g: 'stage', tier: 'gold', name: '万卷', desc: '收录 10000 条', icon: 'diamond', color: '#5C8BE8', goal: 10000,
      val: function (s) { return s.records.length; } }
  ];

  /* 类型徽章：每类 10 档，从 1 一直到 10000 */
  var TYPE_UNIT = {
    novel: '卷', comic: '卷', anime: '部', tv: '部', movie: '部', variety: '部',
    drama: '部', stage: '部', game: '款', music: '张', magazine: '期'
  };
  var TYPE_BADGE_GOALS = [1, 10, 50, 100, 300, 500, 1000, 3000, 5000, 10000];
  var TYPE_BADGE_TIER = ['bronze', 'bronze', 'silver', 'silver', 'silver',
    'gold', 'gold', 'gold', 'gold', 'gold'];
  TYPE_KEYS.forEach(function (k) {
    var nm = TYPE_BADGE_NAME[k] || ['初识', '常客', '老手'];
    var unit = TYPE_UNIT[k] || '部';
    TYPE_BADGE_GOALS.forEach(function (goal, i) {
      var name = i < nm.length ? nm[i] : (goal >= 10000 ? '万' + unit : goal + unit);
      BADGES.push({
        key: 't' + goal + '_' + k, g: 'type', type: k, tier: TYPE_BADGE_TIER[i], name: name,
        desc: '收录 ' + goal + ' 部' + TYPES[k].label, icon: k, color: TYPES[k].color, goal: goal,
        val: function (s) { return countType(s, k); }
      });
    });
  });

  /* 习惯徽章 */
  BADGES.push(
    { key: 'alltype', g: 'habit', tier: 'gold', name: '全景', desc: '11 种类型都留下记录', icon: 'grid', color: '#7C6BFF', goal: 11,
      val: function (s) {
        var seen = {};
        s.records.forEach(function (r) { seen[r.type] = 1; });
        return TYPE_KEYS.filter(function (k) { return seen[k]; }).length;
      } },
    { key: 'critic', g: 'habit', tier: 'silver', name: '评审', desc: '为 20 部作品打分', icon: 'star', color: '#D05FA8', goal: 20,
      val: function (s) { return s.records.filter(function (r) { return r.rating > 0; }).length; } },
    { key: 'allrated', g: 'habit', tier: 'gold', name: '全评', desc: '50 部作品都有评分', icon: 'star', color: '#E8B33D', goal: 50,
      val: function (s) { return s.records.filter(function (r) { return r.rating > 0; }).length; } },
    { key: 'perfect', g: 'habit', tier: 'gold', name: '满分控', desc: '10 部作品给出最高分', icon: 'star', color: '#E8457A', goal: 10,
      val: function (s) {
        var m = maxRating();
        return s.records.filter(function (r) { return r.rating >= m - 0.01; }).length;
      } },
    { key: 'highavg', g: 'habit', tier: 'gold', name: '高分党', desc: '平均 8.5 分以上（至少 20 条）', icon: 'star', color: '#E8913D', goal: 1,
      val: function (s) {
        var rated = s.records.filter(function (r) { return r.rating > 0; });
        if (rated.length < 20) return 0;
        var avg = rated.reduce(function (a, r) { return a + r.rating; }, 0) / rated.length;
        return avg >= 8.5 ? 1 : 0;
      } },
    { key: 'marathon', g: 'habit', tier: 'silver', name: '马拉松', desc: '单部作品投入 100 小时', icon: 'clock', color: '#45AFA0', goal: 100,
      val: function (s) {
        return s.records.reduce(function (a, r) { return Math.max(a, r.hours || 0); }, 0);
      } },
    { key: 'thousandhours', g: 'habit', tier: 'gold', name: '千小时', desc: '累计投入 1000 小时', icon: 'clock', color: '#3FA9E0', goal: 1000,
      val: function (s) { return s.records.reduce(function (a, r) { return a + (r.hours || 0); }, 0); } },
    { key: 'quoter', g: 'habit', tier: 'silver', name: '摘抄家', desc: '收集 20 条摘抄', icon: 'quote', color: '#5C8BE8', goal: 20,
      val: function (s) {
        return s.records.reduce(function (a, r) { return a + (r.quotes || []).length; }, 0);
      } },
    { key: 'noter', g: 'habit', tier: 'silver', name: '笔记党', desc: '写下 20 条笔记', icon: 'feather', color: '#5FB86B', goal: 20,
      val: function (s) {
        return s.records.reduce(function (a, r) { return a + (r.notesLog || []).length; }, 0);
      } },
    { key: 'typist', g: 'habit', tier: 'silver', name: '打字机', desc: '100 条作品写了短评', icon: 'pen', color: '#A96BE0', goal: 100,
      val: function (s) { return s.records.filter(function (r) { return r.review; }).length; } },
    { key: 'longreview', g: 'habit', tier: 'gold', name: '长评', desc: '单条短评超过 300 字', icon: 'feather', color: '#D96A4A', goal: 1,
      val: function (s) {
        return s.records.some(function (r) { return (r.review || '').length >= 300; }) ? 1 : 0;
      } },
    { key: 'week', g: 'habit', tier: 'bronze', name: '七日', desc: '连续打卡 7 天', icon: 'flame', color: '#E8913D', goal: 7,
      val: function () { return checkinStats().streak; } },
    { key: 'month', g: 'habit', tier: 'gold', name: '满月', desc: '连续打卡 30 天', icon: 'flame', color: '#D96A4A', goal: 30,
      val: function () { return checkinStats().streak; } },
    { key: 'checkin100', g: 'habit', tier: 'gold', name: '打卡百天', desc: '累计打卡 100 天', icon: 'calendar', color: '#45AFA0', goal: 100,
      val: function (s) {
        var seen = {};
        (s.checkins || []).forEach(function (c) { if (c && c.date) seen[c.date] = 1; });
        return Object.keys(seen).length;
      } },
    { key: 'rewatch', g: 'habit', tier: 'bronze', name: '重温', desc: '同一部重刷 3 次', icon: 'archive', color: '#A96BE0', goal: 3,
      val: function (s) {
        return s.records.reduce(function (a, r) { return Math.max(a, (r.rewatches || []).length); }, 0);
      } },
    { key: 'hundredday', g: 'habit', tier: 'silver', name: '百日', desc: '记录满 100 天', icon: 'calendar', color: '#3FA9E0', goal: 100,
      val: function () { return recordDayCount(); } },
    { key: 'span', g: 'habit', tier: 'silver', name: '跨年', desc: '记录横跨 3 个年份', icon: 'archive', color: '#7C6BFF', goal: 3,
      val: function (s) {
        var ys = {};
        s.records.forEach(function (r) { ys[new Date(r.createdAt).getFullYear()] = 1; });
        return Object.keys(ys).length;
      } },
    { key: 'finisher', g: 'habit', tier: 'silver', name: '完成派', desc: '50 部作品走到最后', icon: 'check', color: '#2FB59B', goal: 50,
      val: function (s) { return s.records.filter(function (r) { return r.status === 'done'; }).length; } },
    { key: 'nightowl', g: 'habit', tier: 'bronze', name: '夜猫子', desc: '凌晨 0–5 点记过一条', icon: 'moon', color: '#5C8BE8', goal: 1,
      val: function (s) {
        return s.records.some(function (r) {
          var h = new Date(r.createdAt).getHours();
          return h >= 0 && h < 5;
        }) ? 1 : 0;
      } },
    { key: 'weekend', g: 'habit', tier: 'silver', name: '周末党', desc: '10 条在周末收录', icon: 'sun', color: '#E8B33D', goal: 10,
      val: function (s) {
        return s.records.filter(function (r) {
          var d = new Date(r.createdAt).getDay();
          return d === 0 || d === 6;
        }).length;
      } },
    { key: 'collector', g: 'habit', tier: 'bronze', name: '收藏家', desc: '建 3 个自定义列表', icon: 'list', color: '#5FB86B', goal: 3,
      val: function (s) { return (s.lists || []).length; } },
    { key: 'clean', g: 'habit', tier: 'gold', name: '数据洁癖', desc: '30 条以上且没有数据问题', icon: 'check', color: '#45AFA0', goal: 1,
      val: function (s) {
        if (s.records.length < 30) return 0;
        try { return healthIssues().length === 0 ? 1 : 0; } catch (e) { return 0; }
      } },
    { key: 'coverlover', g: 'habit', tier: 'silver', name: '封面党', desc: '50 条作品配了封面', icon: 'grid', color: '#E86A9A', goal: 50,
      val: function (s) { return s.records.filter(function (r) { return !!r.cover; }).length; } },
    { key: 'tagger', g: 'habit', tier: 'silver', name: '标签党', desc: '用过 20 个不同题材', icon: 'list', color: '#E8913D', goal: 20,
      val: function (s) {
        var seen = {};
        s.records.forEach(function (r) { (r.tags || []).forEach(function (t) { seen[t] = 1; }); });
        return Object.keys(seen).length;
      } },
    { key: 'quote100', g: 'habit', tier: 'gold', name: '摘抄狂', desc: '收集 100 条摘抄', icon: 'quote', color: '#5C8BE8', goal: 100,
      val: function (s) {
        return s.records.reduce(function (a, r) { return a + (r.quotes || []).length; }, 0);
      } },
    { key: 'note100', g: 'habit', tier: 'gold', name: '笔记狂', desc: '写下 100 条笔记', icon: 'feather', color: '#5FB86B', goal: 100,
      val: function (s) {
        return s.records.reduce(function (a, r) { return a + (r.notesLog || []).length; }, 0);
      } },
    { key: 'wordsmith', g: 'habit', tier: 'gold', name: '长评家', desc: '短评累计 1 万字', icon: 'pen', color: '#7C6BFF', goal: 10000,
      val: function (s) {
        return s.records.reduce(function (a, r) { return a + (r.review || '').length; }, 0);
      } },
    { key: 'noflop', g: 'habit', tier: 'gold', name: '零差评', desc: '50 部作品都在 8 分以上', icon: 'star', color: '#E8B33D', goal: 50,
      val: function (s) {
        var rated = s.records.filter(function (r) { return r.rating > 0; });
        if (rated.length < 50) return 0;
        return rated.every(function (r) { return r.rating >= 8; }) ? rated.length : 0;
      } },
    { key: 'rewatch10', g: 'habit', tier: 'gold', name: '重刷狂', desc: '同一部重刷 10 次', icon: 'archive', color: '#A96BE0', goal: 10,
      val: function (s) {
        return s.records.reduce(function (a, r) { return Math.max(a, (r.rewatches || []).length); }, 0);
      } },
    { key: 'hours5000', g: 'habit', tier: 'gold', name: '五千小时', desc: '累计投入 5000 小时', icon: 'clock', color: '#3FA9E0', goal: 5000,
      val: function (s) { return s.records.reduce(function (a, r) { return a + (r.hours || 0); }, 0); } },
    { key: 'checkin365', g: 'habit', tier: 'gold', name: '打卡一年', desc: '累计打卡 365 天', icon: 'calendar', color: '#45AFA0', goal: 365,
      val: function (s) {
        var seen = {};
        (s.checkins || []).forEach(function (c) { if (c && c.date) seen[c.date] = 1; });
        return Object.keys(seen).length;
      } },
    { key: 'fullyear', g: 'habit', tier: 'gold', name: '全勤年', desc: '某一年 12 个月都有记录', icon: 'calendar', color: '#D05FA8', goal: 1,
      val: function (s) {
        var map = {};
        s.records.forEach(function (r) {
          var d = new Date(r.createdAt);
          var y = d.getFullYear();
          (map[y] = map[y] || {})[d.getMonth()] = 1;
        });
        return Object.keys(map).some(function (y) { return Object.keys(map[y]).length === 12; }) ? 1 : 0;
      } },
    { key: 'longrun', g: 'habit', tier: 'gold', name: '长跑者', desc: '记录横跨 5 个年份', icon: 'archive', color: '#7C6BFF', goal: 5,
      val: function (s) {
        var ys = {};
        s.records.forEach(function (r) { ys[new Date(r.createdAt).getFullYear()] = 1; });
        return Object.keys(ys).length;
      } },
    { key: 'earlybird', g: 'habit', tier: 'bronze', name: '早起鸟', desc: '早上 6–9 点记过一条', icon: 'sun', color: '#E8B33D', goal: 1,
      val: function (s) {
        return s.records.some(function (r) {
          var h = new Date(r.createdAt).getHours();
          return h >= 6 && h < 9;
        }) ? 1 : 0;
      } },
    { key: 'goalmet', g: 'habit', tier: 'gold', name: '目标达成', desc: '完成今年的收录目标', icon: 'trophy', color: '#E8457A', goal: 1,
      val: function (s) {
        var g = Number(s.prefs.goalCount) || 0;
        if (!g) return 0;
        var y = new Date().getFullYear();
        var n = s.records.filter(function (r) { return new Date(r.createdAt).getFullYear() === y; }).length;
        return n >= g ? 1 : 0;
      } },
    { key: 'list10', g: 'habit', tier: 'silver', name: '收藏达人', desc: '建 10 个自定义列表', icon: 'list', color: '#5FB86B', goal: 10,
      val: function (s) { return (s.lists || []).length; } },
    { key: 'done100', g: 'habit', tier: 'gold', name: '百部完成', desc: '100 部作品走到最后', icon: 'check', color: '#2FB59B', goal: 100,
      val: function (s) { return s.records.filter(function (r) { return r.status === 'done'; }).length; } }
  );

  function badgeList() {
    _typeCountsCache = null;   /* 164 枚徽章共用一次类型统计 */
    return BADGES.map(function (b) {
      var v = 0;
      try { v = b.val(state) || 0; } catch (e) { v = 0; }
      return {
        b: b, v: v, got: v >= b.goal,
        pct: Math.min(100, Math.round(v / b.goal * 100))
      };
    });
  }

  function badgeCard(x, dim, small) {
    return '<div class="badge' + (dim ? ' is-locked' : '') + (small ? ' badge-sm' : '') + '">' +
      '<span class="badge-medal tier-' + (x.b.tier || 'bronze') + '" style="--bc:' + x.b.color + '">' +
      icon(x.b.icon, small ? 18 : 22) + '</span>' +
      '<span class="badge-name">' + esc(x.b.name) + '</span>' +
      (small ? '' : '<span class="badge-desc">' + esc(x.b.desc) + '</span>') +
      '<span class="badge-state">' + (dim ? x.v + ' / ' + x.b.goal : '已获得') + '</span>' +
      '</div>';
  }

  function badgesView() {
    var list = badgeList();
    var got = list.filter(function (x) { return x.got; });
    var pct = Math.round(got.length / list.length * 100);
    var stageList = list.filter(function (x) { return x.b.g === 'stage'; });
    var habitList = list.filter(function (x) { return x.b.g === 'habit'; });

    var html = '<header class="page-head">' +
      '<div class="head-left"><button class="icon-btn" data-action="back" aria-label="返回">' + icon('back', 20) + '</button>' +
      '<div><p class="eyebrow">记录会留下痕迹</p><h1 class="page-title">徽章</h1></div></div>' +
      '<button class="icon-btn" data-action="settings" aria-label="设置">' + icon('gear', 20) + '</button>' +
      '</header>';

    html += '<div class="badge-summary">' +
      '<div class="badge-sum-num"><b>' + got.length + '</b><span>/ ' + list.length + ' 枚</span></div>' +
      '<div class="badge-sum-main"><p>已点亮 ' + pct + '%，还差 ' + (list.length - got.length) + ' 枚</p>' +
      '<div class="badge-sum-bar"><i style="width:' + pct + '%"></i></div></div></div>';

    /* 阶段 */
    html += '<section class="section"><div class="section-head"><h2 class="section-title">阶段徽章</h2>' +
      '<span class="section-note">按收录总量 · ' + stageList.filter(function (x) { return x.got; }).length + ' / ' + stageList.length + '</span></div>' +
      '<div class="badge-grid">' + stageList.map(function (x) { return badgeCard(x, !x.got, false); }).join('') + '</div></section>';

    /* 类型 */
    html += '<section class="section"><div class="section-head"><h2 class="section-title">类型徽章</h2>' +
      '<span class="section-note">11 类 · 每类 10 枚</span></div>' +
      TYPE_KEYS.map(function (k) {
        var two = list.filter(function (x) { return x.b.g === 'type' && x.b.type === k; });
        var n = countType(state, k);
        var gotN = two.filter(function (x) { return x.got; }).length;
        return '<div class="btype">' +
          '<div class="btype-head">' + icon(k, 15) +
          '<span class="btype-name">' + TYPES[k].label + '</span>' +
          '<span class="btype-n">' + n + ' 条 · ' + gotN + ' / ' + two.length + '</span></div>' +
          '<div class="btype-badges">' +
          two.map(function (x) { return badgeCard(x, !x.got, true); }).join('') +
          '</div></div>';
      }).join('') + '</section>';

    /* 习惯 */
    html += '<section class="section"><div class="section-head"><h2 class="section-title">习惯徽章</h2>' +
      '<span class="section-note">打卡、评分、摘抄这些 · ' + habitList.filter(function (x) { return x.got; }).length + ' / ' + habitList.length + '</span></div>' +
      '<div class="badge-grid">' + habitList.map(function (x) { return badgeCard(x, !x.got, false); }).join('') + '</div></section>';

    html += '<p class="badge-note">徽章由本机记录自动计算，不联网、不上传。铜 / 银 / 金 代表难度。</p>';
    return html;
  }

  /* 筛选项管理：值来自库里的记录，可删可加 */
  function optionsView() {
    var html = '<header class="page-head">' +
      '<div class="head-left"><button class="icon-btn" data-action="back" aria-label="返回">' + icon('back', 20) + '</button>' +
      '<div><p class="eyebrow">筛选项来自你的记录</p><h1 class="page-title">选项管理</h1></div></div>' +
      '<button class="icon-btn" data-action="settings" aria-label="设置">' + icon('gear', 20) + '</button>' +
      '</header>';

    html += '<p class="opt-hint">下拉里的值都来自你库里已有的记录。点 × 可以不再显示它，也可以自己加一个；已有记录不会被改动。</p>';

    var any = false;
    typesOn().forEach(function (k) {
      var fields = (EXTRA_FIELDS[k] || []).filter(function (fd) {
        if (!fd.options) return false;
        return Object.keys(metaCountsOf(k, fd.key)).length > 0 ||
          ((state.prefs.vocab[fd.key] || []).length > 0);
      });
      if (!fields.length) return;
      any = true;

      html += '<section class="section"><div class="section-head">' +
        '<h2 class="section-title">' + TYPES[k].label + '</h2>' +
        '<span class="section-note">' + fields.length + ' 个筛选项</span></div>' +
        fields.map(function (fd) {
          var counts = metaCountsOf(k, fd.key);
          var opts = fieldOptions(fd.key, false);
          var hidden = (state.prefs.vocabHidden && state.prefs.vocabHidden[fd.key]) || [];
          return '<div class="opt-block"><div class="opt-head">' +
            '<span class="opt-name">' + esc(fd.label) + '</span>' +
            '<span class="opt-n">' + opts.length + ' 个值' + (hidden.length ? ' · 已隐藏 ' + hidden.length : '') + '</span>' +
            '</div><div class="opt-chips">' +
            opts.map(function (v) {
              return '<span class="opt-chip">' + esc(v) +
                (counts[v] ? '<i>' + counts[v] + '</i>' : '<i class="is-new">新</i>') +
                '<button data-action="opt-del" data-key="' + fd.key + '" data-value="' + esc(v) + '" aria-label="移除">' +
                icon('close', 11) + '</button></span>';
            }).join('') +
            '<button class="opt-add" data-action="opt-add" data-key="' + fd.key + '">＋ 添加</button>' +
            (hidden.length ? '<button class="opt-reset" data-action="opt-reset" data-key="' + fd.key + '">恢复隐藏</button>' : '') +
            '</div></div>';
        }).join('') + '</section>';
    });

    if (!any) {
      html += '<div class="empty"><div class="empty-mark">·</div>' +
        '<p class="empty-title">还没有可管理的筛选项</p>' +
        '<p class="empty-text">记录里填过平台、分级、装帧这类字段后，这里会出现对应的选项。</p></div>';
    }

    html += '<p class="badge-note">这些设置只存在本机，导出数据时不会带上。</p>';
    return html;
  }

  function watchingCard(r) {
    var pct = progressPercent(r);
    var t = TYPES[r.type];
    var canPlus = t.mode === 'book' || t.mode === 'series';
    return '<div class="watching">' +
      '<div class="watching-cover" style="background:' + coverColor(r.title) + '" data-action="open" data-id="' + r.id + '">' +
      coverInner(r) + '</div>' +
      '<div class="watching-body" data-action="open" data-id="' + r.id + '">' +
      '<span class="watching-label">' + TYPES[r.type].label + ' · ' + statusLabelFor(r) + '</span>' +
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
      (r.tags || []).some(function (t) { return t.toLowerCase().indexOf(s) >= 0; }) ||
      metaHit(r, s) ||
      customHit(r, s);
  }

  function metaHit(r, s) {
    var m = r.meta;
    if (!m) return false;
    for (var k in m) {
      if (m[k] && String(m[k]).toLowerCase().indexOf(s) >= 0) return true;
    }
    return false;
  }

  function customHit(r, s) {
    if (!Array.isArray(r.custom)) return false;
    return r.custom.some(function (c) {
      return (String(c.k || '') + ' ' + String(c.v || '')).toLowerCase().indexOf(s) >= 0;
    });
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
        '<div class="srow-meta">' + esc([TYPES[r.type].label, r.creator, statusLabelFor(r)].filter(Boolean).join(' · ')) + '</div>' +
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
    /* 老 Safari 不支持 :has()，用 class 兜住「清除」按钮的显示 */
    var box = document.querySelector('.search');
    if (box) box.classList.toggle('has-text', !!q);
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
    if (f.meta && f.type !== 'all') {
      for (var mk in f.meta) {
        if (!f.meta.hasOwnProperty(mk)) continue;
        if (f.meta[mk] && f.meta[mk] !== 'all' && (r.meta || {})[mk] !== f.meta[mk]) return false;
      }
    }
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


  /* 当前列表（不叠加状态/题材等筛选）里的类型分布，用于类型 chip 上的计数 */


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
    else if (mode === 'hours') copy.sort(function (a, b) { return ((b.hours || 0) - (a.hours || 0)) || (b.createdAt - a.createdAt); });
    else copy.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    return copy;
  }



  /* 全部视图：按类型分区，每类一排封面 */

  /* 各类型自己的筛选项（取自专属字段里的选项型字段） */
  var TYPE_FILTERS = {
    novel: [{ key: 'serialStatus', label: '连载' }, { key: 'binding', label: '装帧' }],
    comic: [{ key: 'serialStatus', label: '连载' }, { key: 'colorPages', label: '彩页' }],
    anime: [{ key: 'airWeekday', label: '放送日' }, { key: 'ageRating', label: '分级' }],
    tv: [{ key: 'ageRating', label: '分级' }, { key: 'airPeriod', label: '时段' }],
    movie: [{ key: 'watchPlace', label: '观看' }, { key: 'color', label: '色彩' }],
    variety: [{ key: 'quarter', label: '季度' }],
    drama: [{ key: 'updateCycle', label: '更新' }],
    stage: [],
    game: [{ key: 'gameType', label: '类型' }, { key: 'chineseSupport', label: '中文' }],
    music: [{ key: 'albumType', label: '类型' }, { key: 'medium', label: '介质' }],
    magazine: [{ key: 'serialStatus', label: '刊期' }, { key: 'subscribeFrom', label: '订阅' }]
  };

  /* ---------------- 筛选项：以库里的实际值为准，可自行增删 ---------------- */

  function metaCounts(key) {
    var map = {};
    state.records.forEach(function (r) {
      var v = r.meta && r.meta[key];
      if (v) map[v] = (map[v] || 0) + 1;
    });
    return map;
  }

  function metaCountsOf(type, key) {
    var map = {};
    state.records.forEach(function (r) {
      if (r.type !== type) return;
      var v = r.meta && r.meta[key];
      if (v) map[v] = (map[v] || 0) + 1;
    });
    return map;
  }

  function fieldDef(key) {
    for (var t in EXTRA_FIELDS) {
      if (!EXTRA_FIELDS.hasOwnProperty(t)) continue;
      var list = EXTRA_FIELDS[t];
      for (var i = 0; i < list.length; i++) {
        if (list[i].key === key) return list[i];
      }
    }
    return null;
  }

  function isOptHidden(key, v) {
    var h = state.prefs.vocabHidden && state.prefs.vocabHidden[key];
    return !!(h && h.indexOf(v) >= 0);
  }

  /* withStatic=true 时把字段自带的默认选项也并进来（新增记录时用） */
  function fieldOptions(key, withStatic) {
    var out = [], seen = {};
    var counts = metaCounts(key);
    Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).forEach(function (v) {
      if (isOptHidden(key, v) || seen[v]) return;
      seen[v] = 1;
      out.push(v);
    });
    ((state.prefs.vocab && state.prefs.vocab[key]) || []).forEach(function (v) {
      if (isOptHidden(key, v) || seen[v]) return;
      seen[v] = 1;
      out.push(v);
    });
    if (withStatic) {
      var fd = fieldDef(key);
      ((fd && fd.options) || []).forEach(function (v) {
        if (isOptHidden(key, v) || seen[v]) return;
        seen[v] = 1;
        out.push(v);
      });
    }
    return out;
  }

  /* 库里出现过的值 + 自己添加的值（都不含已隐藏的）→ 用于筛选下拉 */
  function usedOptions(key) {
    return fieldOptions(key, false);
  }



  /* ---------------- 看板视图（按状态分列） ---------------- */




  function metaLabel(key) {
    for (var t in EXTRA_FIELDS) {
      var list = EXTRA_FIELDS[t];
      for (var i = 0; i < list.length; i++) {
        if (list[i].key === key) return list[i].label;
      }
    }
    if (key === 'link') return '条目链接';
    return key;
  }

  function metaSummary(r) {
    var m = r.meta || {};
    var parts = [];
    META_KEYS.forEach(function (k) {
      if (m[k]) parts.push(metaLabel(k) + '=' + m[k]);
    });
    return parts.join('; ');
  }

  function customSummary(r) {
    if (!Array.isArray(r.custom)) return '';
    return r.custom.filter(function (c) { return c && c.k; })
      .map(function (c) { return c.k + '=' + (c.v || ''); }).join('; ');
  }

  /* 卡片上的一行摘要：优先显示最能代表这个类型的字段 */
  function cardSub(r) {
    var m = r.meta || {};
    var bits = [];
    var order = ['publisher', 'channel', 'platform', 'studio', 'magazineName', 'venue'];
    for (var i = 0; i < order.length; i++) {
      if (m[order[i]]) { bits.push(m[order[i]]); break; }
    }
    if (!bits.length && Array.isArray(r.custom) && r.custom[0] && r.custom[0].v) {
      bits.push(r.custom[0].k + '：' + r.custom[0].v);
    }
    if (r.year) bits.push(r.year);
    return bits.slice(0, 2).join(' · ');
  }

  function haystack(r) {
    var bits = [r.title, r.originalTitle, r.creator, r.year, r.review,
      (r.aliases || []).join(' '), (r.tags || []).join(' ')];
    var m = r.meta || {};
    for (var k in m) { if (m[k]) bits.push(m[k]); }
    (r.custom || []).forEach(function (c) { bits.push(c.k, c.v); });
    (r.quotes || []).forEach(function (q) { bits.push(q.text); });
    return bits.filter(Boolean).join(' ').toLowerCase();
  }


  /* ---------------- 列表（智能 / 手动） ---------------- */

  function smartRulesHTML(draft, tags) {
    var typeOpts = '<option value="all">全部类型</option>' + TYPE_KEYS.map(function (k) {
      return '<option value="' + k + '"' + (draft.rules.type === k ? ' selected' : '') + '>' + TYPES[k].label + '</option>';
    }).join('');
    var statusOpts = '<option value="all">全部状态</option>' + STATUS_KEYS.map(function (k) {
      return '<option value="' + k + '"' + (draft.rules.status === k ? ' selected' : '') + '>' +
        statusLabel(draft.rules.type === 'all' ? '' : draft.rules.type, k) + '</option>';
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
    var seen = {};
    state.records.forEach(function (r) { if (ids.indexOf(r.id) >= 0) seen[r.type] = 1; });
    var only = Object.keys(seen).length === 1 ? Object.keys(seen)[0] : '';
    openModal({
      title: '批量修改状态',
      desc: '把选中的 ' + ids.length + ' 条记录改为：',
      body: '<div class="modal-choice">' + STATUS_KEYS.map(function (k) {
        return '<button class="choice" data-bs="' + k + '"><strong>' + statusLabel(only, k) + '</strong></button>';
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

  function bulkRating() {
    var ids = selectedIds();
    if (!ids.length) { toast('先选几条记录'); return; }
    var val = 0;
    openModal({
      title: '批量评分',
      desc: '给选中的 ' + ids.length + ' 条记录设置评分（0 表示清除）',
      body: '<div class="rating-field" style="margin:8px 0 4px">' +
        '<input type="range" class="range" id="modal-rating" min="0" max="10" step="0.5" value="0" style="--pct:0%">' +
        '<div class="rating-value"><strong id="modal-rating-num">—</strong><span>/ 10</span></div>' +
        '</div>',
      actions: [
        { label: '取消', value: null, variant: 'ghost' },
        { label: '应用', value: 'ok', variant: 'primary' }
      ]
    }).then(function (v) {
      if (v !== 'ok') return;
      var now = Date.now();
      state.records.forEach(function (r) {
        if (ids.indexOf(r.id) < 0) return;
        r.rating = val;
        r.updatedAt = now;
      });
      save();
      exitSelect();
      toast('已设置 ' + ids.length + ' 条的评分');
      render();
    });

    var root = document.getElementById('modal-root');
    var range = root.querySelector('#modal-rating');
    var numEl = root.querySelector('#modal-rating-num');
    if (range) {
      range.addEventListener('input', function () {
        val = parseFloat(range.value) || 0;
        range.style.setProperty('--pct', (val * 10) + '%');
        if (numEl) numEl.textContent = val ? val.toFixed(1) : '—';
      });
    }
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


  function exitSelect() {
    state.ui.selectMode = false;
    state.ui.selected = {};
  }

  /* ---------------- 添加 / 编辑 ---------------- */

  function initDraft(id) {
    if (id) {
      var r = state.records.filter(function (x) { return x.id === id; })[0];
      if (!r) { location.hash = '#/book'; return; }
      state.draft = JSON.parse(JSON.stringify(r));
      try {
        state.readonly = sessionStorage.getItem('shilu.ro.v1') === String(id);
      } catch (e) { state.readonly = false; }
      if (!state.readonly) tryRestoreStash(id);
    } else {
      state.draft = {
        id: '', type: 'novel', title: '', originalTitle: '', aliases: [],
        creator: '', year: '', releaseDate: '', tags: [], rating: 0,
        status: 'wish', review: '', quotes: [], hours: 0, cover: '', images: [], updateDay: -1,
        douban: 0, recommend: '', category: '', sections: {}, notesLog: [],
        meta: {},
        custom: [],
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
    try { state.draftSnapshot = JSON.stringify(state.draft); } catch (e) { state.draftSnapshot = ''; }
  }

  function tryRestoreStash(id) {
    var st = draftStash;
    if (!st || !st.json) return;
    if (String(st.id || '') !== String(id || '')) return;
    if (Date.now() - (st.at || 0) > 7 * 24 * 3600 * 1000) { clearStash(); return; }
    try {
      var d = JSON.parse(st.json);
      if (!d || !d.title && !d.review) { clearStash(); return; }
      state.draft = d;
      toast('已恢复上次没保存的内容');
    } catch (e) { clearStash(); }
  }

  function editView() {
    var d = state.draft;
    if (!d) return '';
    var isNew = !d.id;
    var type = d.type;
    var meta = TYPES[type];
    var mode = meta.mode;
    var f = formOf(type);

    var html = '<header class="edit-head">' +
      '<button class="icon-btn" data-action="back" aria-label="返回">' + icon('back', 19) + '</button>' +
      '<h1 class="edit-title">' + (isNew ? '记录一条' : (state.readonly ? '记录详情' : '编辑记录')) + '</h1>' +
      (isNew
        ? '<span class="icon-btn ghost"></span>'
        : '<button class="icon-btn" data-action="delete" aria-label="删除">' + icon('trash', 18) + '</button>') +
      '</header>';

    /* 类型 */
    var pickTypes = typesOn().slice();
    if (pickTypes.indexOf(type) < 0) pickTypes.push(type);
    html += '<section class="block"><div class="type-picker">' +
      pickTypes.map(function (k) {
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

      '<label class="field"><span class="field-label">条目链接</span>' +
      '<div class="link-row">' +
      '<input class="input" data-field="meta.link" value="' + esc((d.meta || {}).link || '') +
      '" inputmode="url" placeholder="豆瓣 / Bangumi / Steam 页面地址，选填">' +
      '<button class="btn btn-ghost btn-sm" data-action="open-link">打开</button>' +
      '</div></label>' +

      '<label class="field"><span class="field-label">出版年</span>' +
      '<input class="input" data-field="year" value="' + esc(d.year) + '" inputmode="numeric" placeholder="2024"></label>' +

      '<div class="field"><span class="field-label">状态' +
      '<em class="field-tip">' + TYPES[d.type].label + '</em></span>' +
      '<div class="seg status-seg">' +
      STATUS_KEYS.map(function (k) {
        return '<button type="button" data-action="set-status" data-value="' + k + '" class="' +
          (d.status === k ? 'is-active' : '') + '">' + statusLabel(d.type, k) + '</button>';
      }).join('') +
      '</div></div>' +

      '<label class="field"><span class="field-label">' + f.release + '</span>' +
      '<input class="input" type="date" data-field="releaseDate" value="' + esc(d.releaseDate) + '">' +
      '<span class="hint" style="display:block;margin-top:6px">' +
      (d.releaseDate
        ? (isReleased(d) ? '已' + f.verb : '未' + f.verb + '（还没到日期）')
        : '留空时按年份判断；保存时会按年份自动补全') +
      '</span></label>' +

      (f.single
        ? '<label class="field"><span class="field-label">' + f.finish + '</span>' +
        '<input class="input" type="date" data-field="finishedAt" value="' + esc(d.finishedAt || '') + '">' +
        '<span class="hint" style="display:block;margin-top:6px">不填就按今天算</span></label>'
        : '<div class="row2">' +
        '<label class="field"><span class="field-label">' + f.start + '</span>' +
        '<input class="input" type="date" data-field="startedAt" value="' + esc(d.startedAt || '') + '"></label>' +
        '<label class="field"><span class="field-label">' + f.finish + '</span>' +
        '<input class="input" type="date" data-field="finishedAt" value="' + esc(d.finishedAt || '') + '">' +
        '<span class="hint" id="date-hint" style="display:block;margin-top:6px">' + dateSpanHint(d) + '</span></label>' +
        '</div>');

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

    /* 外部评分 / 推荐指数 / 分类 */
    var scoreField = (f.score || d.douban)
      ? '<label class="field"><span class="field-label">' + (f.score || '外部评分') + '</span>' +
      '<input class="input" type="number" min="0" max="10" step="0.1" data-field="douban" value="' + (d.douban || '') +
      '" placeholder="' + (type === 'game' ? '9.2' : '8.9') + '">' +
      (type === 'game' ? '<span class="hint" style="display:block;margin-top:6px">按 10 分制填；MC 92 就写 9.2</span>' : '') +
      '</label>'
      : '';
    var recField = '<label class="field"><span class="field-label">推荐指数</span>' +
      '<select class="input" data-field="recommend">' +
      '<option value="">不标记</option>' +
      RECOMMEND_LEVELS.map(function (r) {
        return '<option value="' + r.key + '"' + (d.recommend === r.key ? ' selected' : '') + '>' + r.mark + ' ' + r.label + '</option>';
      }).join('') + '</select></label>';

    html += scoreField
      ? '<div class="row2">' + scoreField + recField + '</div>'
      : recField;
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
      '<label class="field"><span class="field-label">' + f.hours + '</span>' +
      '<input class="input" type="number" min="0" step="0.5" data-field="hours" value="' + (d.hours || '') + '" placeholder="选填"></label>' +
      '<label class="field"><span class="field-label">' + f.times + '</span>' +
      '<input class="input" value="共 ' + (1 + d.rewatches.length) + ' ' + (f.run === '周目' ? '周目' : '次') +
      (d.rewatches.length ? '（' + cnNum(1 + d.rewatches.length) + f.run + '）' : '') + '" disabled></label>' +
      '</div></section>';

    /* 看剧笔记 / 读书笔记 */
    if (isScreenType(type)) html += sectionsHTML(d);
    if (isBookType(type)) html += notesLogHTML(d);

    /* 重看记录 */
    html += '<section class="block"><p class="block-title">' + f.again + '记录</p>' +
      '<div class="field">' +
      d.rewatches.map(function (w, i) { return rewatchRow(w, i); }).join('') +
      '<button class="btn btn-ghost btn-sm" data-action="add-rewatch">＋ 添加一次' + f.again + '</button>' +
      '</div></section>';

    /* 操作历史 */
    if (!isNew && d.logs && d.logs.length) {
      html += '<section class="block"><p class="block-title">操作历史</p>' +
        '<div class="log-list">' + logListHTML(d.logs) + '</div></section>';
    }

    /* 封面与相册 */
    var coverIsLocal = d.cover.indexOf('img:') === 0 || d.cover.indexOf('data:') === 0;
    html += '<section class="block"><p class="block-title">封面与图片</p>' +
      '<div class="cover-edit">' +
      '<span class="cover-prev" style="--cc:' + coverColor(d.title || '·') + '">' + coverInner(d) + '</span>' +
      '<div class="cover-ops">' +
      '<label class="btn btn-ghost btn-sm">' + icon('plus', 14) + ' 从相册选' +
      '<input type="file" accept="image/*" class="file-input" data-cover="1" hidden></label>' +
      (d.cover ? '<button class="btn btn-ghost btn-sm" data-action="clear-cover">移除封面</button>' : '') +
      '<p class="hint" style="margin:2px 0 0">图片会压到 560px 存进本机，导出时不带图。</p>' +
      '</div></div>' +
      '<label class="field" style="margin-top:12px"><span class="field-label">或粘贴图片链接</span>' +
      '<input class="input" data-field="cover" value="' + esc(coverIsLocal ? '' : d.cover) + '" placeholder="https://…jpg" inputmode="url"></label>' +
      (coverIsLocal ? '<p class="hint">当前用的是本机图片，填链接会替换它。</p>' : '') +
      '<p class="block-title" style="margin:18px 0 8px">相册</p>' +
      galleryHTML(d, true) +
      '</section>';

    /* 资料站跳转 */
    if (d.title) {
      html += '<section class="block"><p class="block-title">去这些地方找资料</p>' +
        searchLinksHTML(d) + '</section>';
    }

    html += state.readonly
      ? '<div class="edit-bar">' +
        '<button class="btn btn-ghost" data-action="back">返回</button>' +
        '<button class="btn btn-primary grow" data-action="edit-mode">编辑</button>' +
        '</div>'
      : '<div class="edit-bar">' +
        '<button class="btn btn-ghost" data-action="back">取消</button>' +
        '<button class="btn btn-primary grow" data-action="save">保存</button>' +
        '</div>';

    return html;
  }

  function rewatchRow(w, i) {
    return '<div class="rewatch">' +
      '<div class="rewatch-head">' +
      '<span class="rw-badge">' + cnNum(i + 2) + formOf(state.draft.type).run + '</span>' +
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
    if (state.readonly) return;   /* 只读详情：不接受任何输入 */
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

    /* 自定义字段：custom.0.k / custom.0.v */
    if (path.indexOf('custom.') === 0) {
      var cp = path.split('.');
      var ci = Number(cp[1]);
      if (!Array.isArray(d.custom)) d.custom = [];
      if (!d.custom[ci]) d.custom[ci] = { k: '', v: '' };
      d.custom[ci][cp[2]] = value;
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
      '<p class="hint" style="margin-top:2px">适合没有固定章节的游戏；状态选「已通关」就按 100% 显示。</p>' +
      '</section>';
  }

  function dateSpanHint(d) {
    if (!d.startedAt || !d.finishedAt) return '两个日期都填上，会自动算用时';
    var a = new Date(d.startedAt + 'T00:00:00');
    var b = new Date(d.finishedAt + 'T00:00:00');
    var days = Math.round((b - a) / 86400000) + 1;
    return days > 0 ? '用时 ' + days + ' 天' : '结束日期早于开始日期';
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
      '<label class="field"><span class="field-label">本期出版方</span>' +
      '<input class="input" data-field="mag.publisher" value="' + esc(m.publisher) + '" placeholder="出版社 / 编辑部"></label>' +
      '<p class="hint">会显示成「' + esc(magazineIssueText({ type: 'magazine', magazine: m, year: d.year, status: d.status })) + '」</p>' +
      '</section>';
  }

  var META_GROUPS = { pub: '作品信息', prod: '制作信息', mine: '我的信息' };

  /* 每类常填的字段直接显示，其余收进「更多信息」。数据字段一个不少，只是默认折叠。 */
  var CORE_META = {
    novel: ['publisher', 'series', 'translator', 'pages', 'binding', 'price', 'isbn', 'language', 'format'],
    comic: ['magazineName', 'publisher', 'volumes', 'epCount', 'binding', 'isbn', 'translator', 'language', 'serialStatus'],
    anime: ['studio', 'originalWork', 'season', 'airWeekday', 'epCount', 'runtime', 'platform', 'composer', 'cast', 'ageRating'],
    tv: ['channel', 'seasons', 'epCount', 'runtime', 'country', 'language', 'screenwriter', 'platform', 'cast'],
    movie: ['runtime', 'country', 'language', 'ageRating', 'premiere', 'screeningFormat', 'cinema', 'watchPlace', 'composer', 'cast'],
    variety: ['channel', 'epCount', 'runtime', 'seasonNo', 'airTime', 'showFormat', 'chiefDirector', 'cast'],
    drama: ['epCount', 'runtime', 'updateCycle', 'originalWork', 'platform', 'cv', 'composer', 'themeSong'],
    stage: ['venue', 'shows', 'runtime', 'playType', 'seat', 'ticketPrice', 'screenwriter', 'composer', 'cast'],
    game: ['platform', 'gameType', 'franchise', 'mcScore', 'playTime', 'completion', 'publisher', 'ageRating', 'chineseSupport'],
    music: ['albumType', 'genre', 'tracks', 'medium', 'publisher', 'releaseCountry', 'composer', 'platform', 'version'],
    magazine: ['serialStatus', 'issn', 'organizer', 'pages', 'issueCount', 'subPrice', 'subscribeFrom', 'language']
  };

  function extrasFieldsHTML(d) {
    var raw = EXTRA_FIELDS[d.type] || [];
    if (!raw.length) return '';
    /* 按「作品 → 制作 → 我的」归拢，避免同组字段被拆成好几段 */
    var bucket = { pub: [], prod: [], mine: [] };
    raw.forEach(function (f) { (bucket[f.g] || bucket.pub).push(f); });
    var list = bucket.pub.concat(bucket.prod, bucket.mine);
    var coreKeys = CORE_META[d.type] || [];
    var core = list.filter(function (f) { return coreKeys.indexOf(f.key) >= 0; });
    var rest = list.filter(function (f) { return coreKeys.indexOf(f.key) < 0; });
    var m = d.meta || (d.meta = {});

    function renderFields(fields) {
      var body = '';
      var pairs = [];
      var curG = '';
      function flush() {
        for (var i = 0; i < pairs.length; i += 2) {
          body += '<div class="row2">' + pairs[i] + (pairs[i + 1] || '<span></span>') + '</div>';
        }
        pairs = [];
      }
      fields.forEach(function (f) {
        var val = m[f.key] == null ? '' : String(m[f.key]);
        /* 详情页只显示填过的，避免一屏空输入框 */
        if (state.readonly && !val) return;

        var g = f.g || 'pub';
        if (g !== curG) {
          flush();
          body += '<p class="meta-group">' + esc(META_GROUPS[g] || '') + '</p>';
          curG = g;
        }

        var input;
        if (f.options) {
          var opts = fieldOptions(f.key, true);
          if (val && opts.indexOf(val) < 0) opts.unshift(val);
          input = '<select class="input" data-field="meta.' + f.key + '">' +
            '<option value="">不指定</option>' +
            opts.map(function (o) {
              return '<option value="' + esc(o) + '"' + (val === o ? ' selected' : '') + '>' + esc(o) + '</option>';
            }).join('') + '</select>';
        } else if (f.date) {
          input = '<input class="input" type="date" data-field="meta.' + f.key + '" value="' + esc(val) + '">';
        } else {
          input = '<input class="input" ' + (f.numeric ? 'type="number" min="0" ' : '') +
            'data-field="meta.' + f.key + '" value="' + esc(val) + '" placeholder="' + esc(f.placeholder || '选填') + '">';
        }

        var cell = '<label class="field"><span class="field-label">' + esc(f.label) + '</span>' + input + '</label>';
        if (f.wide) { flush(); body += cell; } else { pairs.push(cell); }
      });
      flush();
      return body;
    }

    var body = renderFields(core);
    if (rest.length) {
      var used = rest.filter(function (f) { return !!m[f.key]; }).length;
      /* 只读态且一个都没填，就不出现空的折叠块 */
      if (!state.readonly || used) {
        body += '<details class="more-fields"' + (used ? ' open' : '') + '>' +
          '<summary>更多信息 <i>' + rest.length + ' 项' + (used ? ' · 已填 ' + used : '') + '</i></summary>' +
          '<div class="more-fields-body">' + renderFields(rest) + '</div>' +
          '</details>';
      }
    }

    if (!body) return customFieldsHTML(d);
    return '<section class="block"><p class="block-title">' + TYPES[d.type].label + '信息</p>' +
      body + '</section>' + customFieldsHTML(d);
  }

  function customFieldsHTML(d) {
    var list = Array.isArray(d.custom) ? d.custom : [];
    if (state.readonly && !list.length) return '';
    var rows = list.map(function (row, i) {
      return '<div class="custom-row">' +
        '<input class="input custom-k" data-custom="' + i + '.k" value="' + esc(row.k || '') + '" placeholder="字段名" maxlength="20">' +
        '<input class="input custom-v" data-custom="' + i + '.v" value="' + esc(row.v || '') + '" placeholder="内容" maxlength="120">' +
        '<button class="icon-btn custom-del" data-action="del-custom" data-idx="' + i + '" aria-label="删除字段">' +
        icon('close', 14) + '</button>' +
        '</div>';
    }).join('');

    return '<section class="block"><p class="block-title">自定义字段</p>' +
      (rows || '<p class="hint" style="margin:2px 0 8px">想记点这个类型没有的东西？自己加一行。</p>') +
      '<button class="btn btn-ghost btn-sm" data-action="add-custom" style="margin-top:8px">＋ 添加字段</button>' +
      '</section>';
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

  var saveBusy = false;

  function saveDraft() {
    if (state.readonly || saveBusy) return;
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
      images: d.images || [],
      updateDay: d.updateDay,
      meta: d.meta || {},
      custom: d.custom || [],
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
    saveBusy = true;
    toast('保存中…');
    flushWrite().then(function (ok) {
      saveBusy = false;
      if (!ok) {
        /* 写库失败：回滚内存，留在编辑页，草稿和输入都还在 */
        var ri = state.records.findIndex(function (r) { return r.id === rec.id; });
        if (isNew) { if (ri >= 0) state.records.splice(ri, 1); }
        else if (prev && ri >= 0) state.records[ri] = prev;
        toast('保存失败，内容还在，请再点一次保存');
        render({ keepScroll: true });
        return;
      }
      clearStash();
      state.draftSnapshot = '';
      state.draft = null;
      if (prev) purgeImages([prev]);
      toast(isNew ? '已收录「' + rec.title + '」' : '已保存');
      location.hash = state.returnTo || '#/book';
    });
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

  function monthKeys() {
    var seen = {};
    var out = [];
    state.records.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).forEach(function (r) {
      var d = new Date(r.createdAt);
      var key = d.getFullYear() + '-' + pad(d.getMonth() + 1);
      if (!seen[key]) { seen[key] = 1; out.push(key); }
    });
    return out;
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

    var folded = state.ui.fold || (state.ui.fold = {});
    var allFolded = true;
    for (var fi = 0; fi < order.length; fi++) {
      if (!folded['tl_' + order[fi]]) { allFolded = false; break; }
    }

    var head = '<div class="tl-foldbar"><span class="tl-foldnote">共 ' + order.length + ' 个月份</span>' +
      '<button class="link-btn" data-action="tl-fold-all">' + (allFolded ? '展开全部月份' : '折叠全部月份') + '</button></div>';

    return head + order.map(function (key) {
      var parts = key.split('-');
      var list = groups[key];
      var isFolded = !!folded['tl_' + key];
      return '<div class="tl-month-wrap">' +
        '<button class="tl-month" data-action="fold" data-key="tl_' + key + '" aria-expanded="' + (isFolded ? 'false' : 'true') + '">' +
        '<span class="tl-month-t"><b>' + parts[0] + ' 年 ' + Number(parts[1]) + ' 月</b><i>' + list.length + ' 条</i></span>' +
        '<span class="tl-month-ic">' + icon('chevron', 14) + '</span>' +
        '</button>' +
        '<div class="tl-list' + (isFolded ? ' is-folded' : '') + '">' + list.map(timelineItem).join('') + '</div>' +
        '</div>';
    }).join('');
  }

  function timelineItem(r) {
    var d = new Date(r.createdAt);
    return '<div class="tl-item"><div class="tl-body" data-action="open" data-id="' + r.id + '" role="button" tabindex="0">' +
      '<div class="tl-top"><span class="tl-date">' + md(d) + '</span>' +
      '<span class="chip" data-s="' + r.status + '">' + statusLabelFor(r) + '</span></div>' +
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

    /* 会员到期日单独标在日历上，不受类型筛选影响 */
    var memMap = {};
    accounts().forEach(function (a) {
      if (!a.membershipEnd) return;
      if (a.membershipEnd.slice(0, 7) !== y + '-' + pad(m + 1)) return;
      var mk = Number(a.membershipEnd.slice(8, 10));
      (memMap[mk] = memMap[mk] || []).push(a);
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
      cells += '<button class="' + cls + '" data-action="cal-day" data-date="' + ds + '">' +
        '<span class="cal-num">' + d + '</span>' +
        (map[d]
          ? '<span class="cal-covers">' + map[d].slice(0, 2).map(function (r) {
            return '<span class="cal-cv" style="--cc:' + coverColor(r.title) + '">' + coverInner(r) + '</span>';
          }).join('') +
          (map[d].length > 2 ? '<i class="cal-more">+' + (map[d].length - 2) + '</i>' : '') + '</span>'
          : '') +
        (memMap[d] ? '<span class="cal-mem" aria-label="会员到期"></span>' : '') + '</button>';
    }

    var selList = selected ? pool.filter(function (r) {
      return ymd(new Date(r.createdAt)) === selected;
    }) : [];
    var selMem = selected ? (memMap[Number(selected.slice(8, 10))] || []) : [];

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
      '<div class="cal-foot"><span>' + Object.keys(map).reduce(function (s, k) { return s + map[k].length; }, 0) + ' 条记录</span></div>' +
      '</div>' +
      '<div class="day-panel">' +
      (selected
        ? '<h3 class="day-title">' + selected.split('-')[0] + ' 年 ' + Number(selected.split('-')[1]) + ' 月 ' + Number(selected.split('-')[2]) + ' 日</h3>' +
        (selMem.length
          ? '<div class="cal-mem-row">' + selMem.map(function (a) {
            return '<span class="cal-mem-item">' + esc(a.name) + ' · ' +
              esc(membershipLabel(a.membership) || '会员') + ' 到期</span>';
          }).join('') + '</div>'
          : '') +
        (selList.length
          ? '<div class="tl-list">' + selList.map(timelineItem).join('') + '</div>'
          : '<p class="day-empty">这一天没有记录。</p>')
        : '<p class="day-empty">这个月还没有记录。</p>') +
      '</div>';
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

  /* ---------------- 评分分布 ---------------- */
  function ratingBarsSVG(recs) {
    var buckets = [];
    for (var i = 1; i <= 10; i++) buckets.push(0);
    var rated = recs.filter(function (r) { return r.rating > 0; });
    rated.forEach(function (r) {
      var b = Math.min(10, Math.max(1, Math.round(r.rating)));
      buckets[b - 1]++;
    });
    var max = Math.max.apply(null, buckets.concat([1]));
    var W = 320, H = 104, gap = 7, pad = 4;
    var bw = (W - gap * 9 - pad * 2) / 10;
    var out = '<svg class="bars-svg" viewBox="0 0 ' + W + ' ' + H + '">';
    buckets.forEach(function (n, i) {
      var h = Math.round((n / max) * (H - 30));
      var x = pad + i * (bw + gap);
      var y = H - 18 - h;
      out += '<rect x="' + x.toFixed(1) + '" y="' + (n ? y : H - 18) + '" width="' + bw.toFixed(1) +
        '" height="' + (n ? h : 1) + '" rx="3" fill="' + (n ? 'var(--accent)' : 'var(--line)') + '" opacity="' + (n ? (0.55 + 0.45 * (n / max)).toFixed(2) : 1) + '"></rect>';
      if (n) out += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 4) + '" text-anchor="middle" class="bar-num">' + n + '</text>';
      if (i % 2 === 0) out += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle" class="bar-x">' + (i + 1) + '</text>';
    });
    out += '</svg>';
    return out;
  }

  /* ---------------- 打卡热力图 ---------------- */
  function heatmapSVG() {
    var byDate = {};
    state.checkins.forEach(function (c) {
      if (!c || !c.date) return;
      byDate[c.date] = (byDate[c.date] || 0) + (c.minutes || 0);
    });
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var start = new Date(today.getTime() - 364 * DAY);
    var shift = (start.getDay() + 6) % 7;            /* 周一为一周起点 */
    start = new Date(start.getTime() - shift * DAY);

    var cell = 11, gap = 2, rows = 7;
    var days = Math.floor((today.getTime() - start.getTime()) / DAY) + 1;
    var cols = Math.ceil(days / rows);
    var W = cols * (cell + gap), H = rows * (cell + gap);
    var out = '<svg class="heat-svg" viewBox="0 0 ' + W + ' ' + H + '">';

    for (var i = 0; i < days; i++) {
      var d = new Date(start.getTime() + i * DAY);
      var key = ymd(d);
      var m = byDate[key] || 0;
      var lv = m === 0 ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4;
      var x = Math.floor(i / rows) * (cell + gap);
      var y = (i % rows) * (cell + gap);
      out += '<rect class="hm hm-' + lv + '" x="' + x + '" y="' + y + '" width="' + cell +
        '" height="' + cell + '" rx="2.5"><title>' + key + (m ? ' · ' + m + ' 分钟' : ' · 未打卡') + '</title></rect>';
    }
    out += '</svg>';
    return out;
  }

  /* ---------------- 各类型平均分 ---------------- */
  function typeAvgHTML(recs) {
    var rows = [];
    TYPE_KEYS.forEach(function (k) {
      var list = recs.filter(function (r) { return r.type === k && r.rating > 0; });
      if (!list.length) return;
      var sum = list.reduce(function (a, r) { return a + r.rating; }, 0);
      rows.push({ key: k, avg: sum / list.length, n: list.length });
    });
    rows.sort(function (a, b) { return b.avg - a.avg; });
    if (!rows.length) return '<p class="muted">还没有评分数据。</p>';
    return rows.map(function (row) {
      var pct = Math.round(row.avg / 10 * 100);
      return '<div class="avg-row"><span class="avg-name">' + TYPES[row.key].label + '</span>' +
        '<span class="avg-bar"><i style="width:' + pct + '%;background:var(--t-' + row.key + ')"></i></span>' +
        '<span class="avg-val">' + ratingText(row.avg) + '<em>' + row.n + '</em></span></div>';
    }).join('');
  }

  /* ---------------- 数据健康检查 ---------------- */
  function healthIssues() {
    var recs = state.records;
    var issues = [];
    function push(label, list, tip, names) {
      if (!list.length) return;
      issues.push({
        label: label, count: list.length, tip: tip, names: names || [],
        items: list.slice(0, 20).map(function (r) { return { id: r.id, title: r.title }; })
      });
    }

    var map = {};
    recs.forEach(function (r) {
      var k = r.type + '|' + String(r.title || '').trim().toLowerCase();
      (map[k] = map[k] || []).push(r);
    });
    var dups = Object.keys(map).filter(function (k) { return map[k].length > 1; });
    dups.slice(0, 5).forEach(function (k) {
      var group = map[k];
      issues.push({
        label: '重复条目',
        count: group.length,
        tip: '同类型同标题，合并会把标签、金句、笔记并到第一条',
        names: [group[0].title],
        ids: group.map(function (r) { return r.id; })
      });
    });
    if (dups.length > 5) {
      issues.push({
        label: '其他重复条目',
        count: dups.length - 5,
        tip: '还有 ' + (dups.length - 5) + ' 组重复，合并一部分后重新检查即可',
        names: []
      });
    }

    push('缺少封面', recs.filter(function (r) { return !r.cover; }), '列表里会显示纯色占位',
      recs.filter(function (r) { return !r.cover; }).slice(0, 4).map(function (r) { return r.title; }));

    push('已完成但没有评分', recs.filter(function (r) { return r.status === 'done' && !r.rating; }),
      '会影响平均分统计',
      recs.filter(function (r) { return r.status === 'done' && !r.rating; }).slice(0, 4).map(function (r) { return r.title; }));

    push('缺少主创信息', recs.filter(function (r) { return !r.creator; }), '作者 / 导演 / 制作方等',
      recs.filter(function (r) { return !r.creator; }).slice(0, 4).map(function (r) { return r.title; }));

    push('缺少年份', recs.filter(function (r) { return !r.year; }), '影响归档与时间线',
      recs.filter(function (r) { return !r.year; }).slice(0, 4).map(function (r) { return r.title; }));

    var dupTags = recs.filter(function (r) {
      var seen = {}, dup = false;
      (r.tags || []).forEach(function (t) { if (seen[t]) dup = true; seen[t] = 1; });
      return dup;
    });
    push('标签重复', dupTags, '同一条记录里出现了相同标签',
      dupTags.slice(0, 4).map(function (r) { return r.title; }));

    return issues;
  }

  function mergeDuplicates(ids) {
    var list = state.records.filter(function (r) { return ids.indexOf(r.id) >= 0; });
    if (list.length < 2) { toast('少于两条，不用合并'); return; }
    var base = list[0];
    list.slice(1).forEach(function (r) {
      ['cover', 'creator', 'year', 'review', 'releaseDate', 'startedAt', 'finishedAt', 'category'].forEach(function (k) {
        if (!base[k] && r[k]) base[k] = r[k];
      });
      if (!base.rating && r.rating) base.rating = r.rating;
      if (!base.douban && r.douban) base.douban = r.douban;
      if (base.status === 'wish' && r.status !== 'wish') base.status = r.status;
      (r.tags || []).forEach(function (t) { if (base.tags.indexOf(t) < 0) base.tags.push(t); });
      base.quotes = (base.quotes || []).concat(r.quotes || []);
      base.notesLog = (base.notesLog || []).concat(r.notesLog || []);
      base.rewatches = (base.rewatches || []).concat(r.rewatches || []);
      base.episodes = (base.episodes || []).concat(r.episodes || []);
      Object.keys(r.meta || {}).forEach(function (k) {
        if (!base.meta[k]) base.meta[k] = r.meta[k];
      });
      (r.custom || []).forEach(function (c) {
        var has = (base.custom || []).some(function (x) { return x.k === c.k; });
        if (!has) base.custom.push(c);
      });
      base.hours = (base.hours || 0) + (r.hours || 0);
    });
    base.updatedAt = Date.now();
    state.records = state.records.filter(function (r) {
      return ids.indexOf(r.id) < 0 || r.id === base.id;
    });
    save();
    toast('已合并为「' + base.title + '」');
    render({ keepScroll: true });
  }

  function openHealth() {
    var issues = healthIssues();
    var body;
    if (!issues.length) {
      body = '<div class="health-ok">' + icon('check', 18) + '<span>没有发现问题，数据很干净。</span></div>';
    } else {
      body = '<div class="health-list">' + issues.map(function (it) {
        return '<div class="health-row">' +
          '<div class="health-head"><strong>' + esc(it.label) + '</strong><span class="health-num">' + it.count + ' 条</span></div>' +
          '<div class="health-tip">' + esc(it.tip) + '</div>' +
          (it.items && it.items.length
            ? '<div class="health-names">' + it.items.map(function (x) {
                return '<button class="health-link" data-action="health-open" data-id="' + x.id + '">' + esc(x.title) + '</button>';
              }).join('') + (it.count > it.items.length ? '<span class="health-more">…还有 ' + (it.count - it.items.length) + ' 条</span>' : '') + '</div>'
            : '') +
          (it.ids && it.ids.length > 1
            ? '<button class="btn btn-ghost btn-sm" style="margin-top:8px" data-action="merge-dups" data-ids="' + it.ids.join(',') + '">合并这 ' + it.ids.length + ' 条</button>'
            : '') +
          '</div>';
      }).join('') + '</div>';
    }
    openModal({
      title: '数据健康检查',
      body: body,
      actions: [{ label: '知道了', value: null, variant: 'primary' }]
    });
  }

  function yearCompareHTML() {
    var nowY = new Date().getFullYear();
    function statOf(y) {
      var list = state.records.filter(function (r) {
        return new Date(r.createdAt || 0).getFullYear() === y;
      });
      var hours = list.reduce(function (a, r) { return a + (r.hours || 0); }, 0);
      var rated = list.filter(function (r) { return r.rating > 0; });
      var avg = rated.length ? rated.reduce(function (a, r) { return a + r.rating; }, 0) / rated.length : 0;
      var done = list.filter(function (r) { return r.status === 'done'; }).length;
      return { n: list.length, h: hours, avg: avg, done: done };
    }
    var a = statOf(nowY);
    var b = statOf(nowY - 1);
    if (!a.n && !b.n) return '<p class="muted">还没有跨年的数据可以对比。</p>';

    function row(label, cur, prev, unit, fmt) {
      var f = fmt || function (v) { return v; };
      var diff = cur - prev;
      var arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '—';
      var cls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
      return '<div class="cmp-row">' +
        '<span class="cmp-label">' + label + '</span>' +
        '<span class="cmp-prev">' + f(prev) + (unit || '') + '</span>' +
        '<span class="cmp-cur">' + f(cur) + (unit || '') + '</span>' +
        '<span class="cmp-diff ' + cls + '">' + arrow + (diff ? Math.abs(fmt ? Math.round(diff) : diff) : '') + '</span>' +
        '</div>';
    }

    return '<div class="cmp-head"><span></span><span>' + (nowY - 1) + '</span><span>' + nowY + '</span><span>变化</span></div>' +
      row('记录条数', a.n, b.n, ' 条') +
      row('投入小时', Math.round(a.h), Math.round(b.h), ' h') +
      row('完成数', a.done, b.done, ' 条') +
      row('平均分', a.avg, b.avg, '', function (v) { return v ? ratingText(v) : '—'; });
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
      '<div class="kpi"><strong>' + (recordDayCount() || '—') + '</strong><span>记录天数</span></div>' +
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

    /* 评分分布 */
    var ratedAll = recs.filter(function (r) { return r.rating > 0; });
    if (ratedAll.length) {
      var topBucket = 0, topN = 0;
      for (var bi = 1; bi <= 10; bi++) {
        var cnt = ratedAll.filter(function (r) { return Math.round(r.rating) === bi; }).length;
        if (cnt > topN) { topN = cnt; topBucket = bi; }
      }
      html += '<div class="chart-card"><div class="chart-head"><h3 class="chart-title">评分分布</h3>' +
        '<span class="chart-note">' + ratedAll.length + ' 条已评分 · 最多 ' + topBucket + ' 分</span></div>' +
        ratingBarsSVG(recs) + '</div>';
    }

    /* 打卡热力图 */
    html += '<div class="chart-card"><div class="chart-head"><h3 class="chart-title">打卡热力图</h3>' +
      '<span class="chart-note">近一年 · 共 ' + Object.keys(state.checkins.reduce(function (m, c) {
        if (c && c.date) m[c.date] = 1; return m;
      }, {})).length + ' 天</span></div>' +
      '<div class="heat-wrap">' + heatmapSVG() + '</div>' +
      '<div class="heat-legend"><span>少</span><i class="lg lg-0"></i><i class="lg lg-1"></i><i class="lg lg-2"></i><i class="lg lg-3"></i><i class="lg lg-4"></i><span>多</span></div>' +
      '</div>';

    /* 各类型平均分 */
    html += '<div class="chart-card"><div class="chart-head"><h3 class="chart-title">各类型平均分</h3>' +
      '<span class="chart-note">括号内为条数</span></div>' + typeAvgHTML(recs) + '</div>';

    /* 今年 vs 去年 */
    html += '<div class="chart-card"><div class="chart-head"><h3 class="chart-title">今年 vs 去年</h3>' +
      '<span class="chart-note">按收录时间统计</span></div>' + yearCompareHTML() + '</div>';

    /* 细分洞察 */
    html += insightHTML(recs);

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


  function buildReport(year, month, type) {
    /* 与年度档案同口径：按完成日期归档，没填完成日期的按收录日 */
    var list = state.records.filter(function (r) {
      if (type !== 'all' && r.type !== type) return false;
      var d = doneISO(r) || ymd(new Date(r.createdAt));
      if (d.slice(0, 4) !== String(year)) return false;
      if (month !== 'all' && Number(d.slice(5, 7)) !== Number(month)) return false;
      return true;
    }).sort(function (a, b) {
      return (doneISO(a) || ymd(new Date(a.createdAt))).localeCompare(doneISO(b) || ymd(new Date(b.createdAt)));
    });

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

  function anchorDownload(blob, name) {
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

  /* iOS「添加到主屏幕」后是独立窗口，<a download> 不会真的存文件，
     改用系统分享（存到「文件」/ 发微信 / 存相册）。只在 iOS 独立模式启用，
     其它环境行为完全不变。 */
  function downloadBlob(blob, name) {
    var iosStandalone = false;
    try { iosStandalone = window.navigator.standalone === true; } catch (e) { iosStandalone = false; }
    if (iosStandalone && navigator.canShare && navigator.share) {
      var file = null;
      try { file = new File([blob], name, { type: blob.type || 'application/octet-stream' }); } catch (e2) { file = null; }
      if (file && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: name }).catch(function () {
          /* 用户取消分享时不再重复下载，避免弹两次 */
        });
        return;
      }
    }
    anchorDownload(blob, name);
  }

  function posterName() {
    var d = state.report.data;
    return 'shilu-' + d.year + (d.month === 'all' ? '-year' : '-' + pad(Number(d.month))) + '-' + todayISO() + '.png';
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
      '<div class="head-left"><button class="icon-btn" data-action="back-home" aria-label="返回总览">' + icon('back', 20) + '</button>' +
      '<div><p class="eyebrow">共 ' + all.length + ' 条摘抄</p><h1 class="page-title">摘抄库</h1></div></div>' +
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

  function authCardHTML(g) {
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
      (hours ? ' · ' + fmtHours(hours) + ' 小时' : '') +
      (g.roles && g.roles.length > 1 ? ' · 跨 ' + g.roles.length + ' 类' : '') + '</span>' +
      '</span>' +
      '<span class="auth-arrow">' + icon('chevron', 15) + '</span>' +
      '</button>' +
      (isOpen
        ? '<div class="auth-body">' +
        '<button class="link-btn auth-more" data-action="open-person" data-name="' + esc(g.name) + '">' +
        '查看人物页 →</button>' + g.list.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; }).map(function (r) {
          return '<div class="auth-item" data-action="open" data-id="' + r.id + '" role="button" tabindex="0">' +
            '<span class="auth-item-title">' + esc(r.title) + '</span>' +
            '<span class="auth-item-meta">' + TYPES[r.type].label + ' · ' + statusLabelFor(r) +
            (r.rating ? ' · ' + ratingText(r.rating) : '') + '</span>' +
            '</div>';
        }).join('') + '</div>'
        : '') +
      '</div>';
  }

  function authorsView() {
    var map = {};
    state.records.forEach(function (r) {
      var name = String(r.creator || '').trim();
      if (!name) return;
      (map[name] = map[name] || { name: name, list: [] }).list.push(r);
    });
    var groups = Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.list.length - a.list.length || a.name.localeCompare(b.name); });

    /* 身份来自各类型的 creator 字段，一个人跨类型时归到作品最多的那一类 */
    groups.forEach(function (g) {
      var cnt = {};
      g.list.forEach(function (r) {
        var role = (TYPES[r.type] && TYPES[r.type].creator) || '创作者';
        cnt[role] = (cnt[role] || 0) + 1;
      });
      var roles = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; });
      g.roles = roles;
      g.role = roles[0] || '创作者';
    });

    var roleOrder = [];
    TYPE_KEYS.forEach(function (k) {
      var role = TYPES[k].creator || '创作者';
      if (roleOrder.indexOf(role) < 0) roleOrder.push(role);
    });
    var byRole = {};
    groups.forEach(function (g) { (byRole[g.role] = byRole[g.role] || []).push(g); });

    var html = '<header class="page-head">' +
      '<div class="head-left"><button class="icon-btn" data-action="back-home" aria-label="返回总览">' + icon('back', 20) + '</button>' +
      '<div><p class="eyebrow">' + groups.length + ' 位 · ' + Object.keys(byRole).length + ' 类身份</p>' +
      '<h1 class="page-title">创作者</h1></div></div>' +
      '<div class="head-actions"><button class="icon-btn" data-action="settings" aria-label="设置">' + icon('gear', 20) + '</button></div>' +
      '</header>';

    if (!groups.length) {
      return html + '<div class="empty"><div class="empty-mark">·</div>' +
        '<p class="empty-title">还没有填创作者</p>' +
        '<p class="empty-text">在记录里填上作者、导演或制作方，这里会自动聚合。</p></div>';
    }

    html += '<p class="fan-hint">按身份归档；同一个人的作品跨类型时，归到作品最多的那一类。</p>';

    roleOrder.forEach(function (role) {
      var list = byRole[role];
      if (!list || !list.length) return;
      html += '<section class="section"><div class="section-head"><h2 class="section-title">' + esc(role) + '</h2>' +
        '<span class="section-note">' + list.length + ' 位</span></div>' +
        '<div class="auth-list">' + list.map(authCardHTML).join('') + '</div></section>';
    });

    return html;
  }

  
  /* 点封面弹出的信息卡：封面占满左侧，信息在右 */
  /* 信息卡上显示哪些块，可在设置里关掉 */
  var CARD_FIELDS = [
    { k: 'rating', label: '评分' },
    { k: 'progress', label: '进度' },
    { k: 'rows', label: '专属信息' },
    { k: 'review', label: '短评' },
    { k: 'tags', label: '题材标签' },
    { k: 'extra', label: '摘抄与笔记' },
    { k: 'links', label: '搜索入口' },
    { k: 'time', label: '收录时间' }
  ];

  function cardOn(k) {
    var c = state.prefs.cardFields || {};
    return c[k] !== false;
  }

  function recordCardHTML(r) {
    var f = formOf(r.type);
    var m = r.meta || {};
    var rows = [];
    (EXTRA_FIELDS[r.type] || []).forEach(function (fd) {
      if (rows.length >= 9) return;
      if (m[fd.key]) rows.push([fd.label, m[fd.key]]);
    });
    if (r.hours) rows.push(['投入时长', fmtHours(r.hours) + ' 小时']);
    if (r.releaseDate) rows.push([f.release, r.releaseDate]);
    if (r.startedAt) rows.push([f.start || '开始', r.startedAt]);
    if (r.finishedAt) rows.push([f.finish || '完成', r.finishedAt]);

    var quoteN = (r.quotes || []).length;
    var noteN = (r.notesLog || []).length;
    var pct = progressPercent(r);

    return '<div class="rcard">' +
      '<div class="rcard-left" style="--cc:' + coverColor(r.title) + '">' +
      coverInner(r) +
      '<span class="rcard-veil"></span>' +
      '<span class="rcard-kind">' + TYPES[r.type].label + '</span>' +
      '</div>' +
      '<div class="rcard-right">' +
      '<span class="rcard-type">' + statusLabelFor(r) + '</span>' +
      '<h4 class="rcard-title">' + esc(r.title) + '</h4>' +
      (r.originalTitle ? '<p class="rcard-sub">' + esc(r.originalTitle) + '</p>' : '') +
      ([r.creator, r.year].filter(Boolean).length
        ? '<p class="rcard-sub">' + esc([r.creator, r.year].filter(Boolean).join(' · ')) + '</p>'
        : '') +

      (cardOn('rating')
        ? '<div class="rcard-rate">' +
        (r.rating
          ? '<b>' + ratingText(r.rating) + '</b><span>/ 10</span>'
          : '<span class="rcard-norate">还没评分</span>') +
        (r.douban ? '<em>' + (f.score || '外部评分') + ' ' + r.douban.toFixed(1) + '</em>' : '') +
        '</div>'
        : '') +

      (cardOn('progress')
        ? '<div class="rcard-prog"><div class="rcard-bar"><i style="width:' + pct + '%"></i></div>' +
        '<span>' + esc(progressText(r)) + '</span></div>'
        : '') +

      ((r.images || []).length
        ? '<div class="rcard-gal">' + r.images.slice(0, 4).map(function (src) {
          return '<button class="rcard-gal-i" data-action="view-img" data-src="' + esc(coverSrc(src)) + '">' +
            '<img src="' + esc(coverSrc(src)) + '" alt="" loading="lazy"></button>';
        }).join('') + '</div>'
        : '') +

      ((cardOn('rows') && rows.length) ? '<div class="rcard-rows">' + rows.map(function (x) {
        return '<div class="rcard-row"><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>';
      }).join('') + '</div>' : '') +

      ((cardOn('review') && r.review) ? '<p class="rcard-review">' + esc(r.review) + '</p>' : '') +

      ((cardOn('tags') && (r.tags || []).length) ? '<div class="rcard-tags">' + r.tags.map(function (t) {
        return '<span class="rcard-tag">' + esc(t) + '</span>';
      }).join('') + '</div>' : '') +

      ((cardOn('extra') && (quoteN || noteN)) ? '<p class="rcard-extra">' +
        (quoteN ? '摘抄 ' + quoteN + ' 条' : '') +
        (quoteN && noteN ? ' · ' : '') +
        (noteN ? '笔记 ' + noteN + ' 条' : '') + '</p>' : '') +

      (cardOn('links') ? searchLinksHTML(r) : '') +

      (cardOn('time') ? '<p class="rcard-foot">收录于 ' + ymd(new Date(r.createdAt)) +
        (r.updatedAt ? ' · 更新于 ' + ymd(new Date(r.updatedAt)) : '') + '</p>' : '') +

      '<div class="rcard-actions">' +
      (isTicketType(r.type) ? '<button class="rcard-btn" data-action="ticket" data-id="' + r.id + '">票根</button>' : '') +
      '<button class="rcard-btn" data-action="close-modal">关闭</button>' +
      '<button class="rcard-btn is-primary" data-action="rcard-edit" data-id="' + r.id + '">编辑</button>' +
      '</div>' +
      '</div></div>';
  }

  function openRecordCard(id) {
    var r = null;
    for (var i = 0; i < state.records.length; i++) {
      if (state.records[i].id === id) { r = state.records[i]; break; }
    }
    if (!r) return;
    var back = location.hash || '#/archive';
    openModal({
      title: '',
      cls: 'rcard-modal',
      body: recordCardHTML(r),
      actions: []
    });
  }

  
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
      '<div class="set-label" style="margin:16px 0 8px">主题色</div>' +
      '<div class="accent-row">' +
      [['rose', '玫红'], ['indigo', '靛蓝'], ['mint', '薄荷'], ['amber', '琥珀'],
      ['violet', '紫罗兰'], ['sand', '米黄']].map(function (a2) {
        return '<button class="accent-dot' + ((state.prefs.accent || 'rose') === a2[0] ? ' is-on' : '') + '" ' +
          'data-action="accent" data-value="' + a2[0] + '" data-accent="' + a2[0] + '" ' +
          'title="' + a2[1] + '" aria-label="' + a2[1] + '"></button>';
      }).join('') +
      '</div>' +
      '<div class="set-label" style="margin:16px 0 8px">评分制</div>' +
      '<div class="scale-seg">' +
      '<button data-action="rating-scale" data-value="10" class="' + (state.prefs.ratingScale !== '5' ? 'is-active' : '') + '">10 分制</button>' +
      '<button data-action="rating-scale" data-value="5" class="' + (state.prefs.ratingScale === '5' ? 'is-active' : '') + '">5 星制（半星）</button>' +
      '</div></div>';

    /* 显示哪些类型 */
    var off = state.prefs.offTypes || {};
    html += '<div class="set-group"><h2>显示的类型</h2>' +
      '<p class="muted" style="margin:0 0 10px">关掉的类型不再出现在收藏栏、新增页和筛选项里，已有记录不会被删。</p>' +
      '<div class="type-switch">' + TYPE_KEYS.map(function (k) {
        return '<button class="tsw' + (off[k] ? '' : ' is-on') + '" data-action="toggle-type" data-value="' + k + '">' +
          icon(k, 14) + '<span>' + TYPES[k].label + '</span></button>';
      }).join('') + '</div></div>';

    /* 信息卡显示项 */
    html += '<div class="set-group"><h2>信息卡显示项</h2>' +
      '<p class="muted" style="margin:0 0 10px">点封面弹出的卡片里要显示哪些块。</p>' +
      '<div class="card-switch">' + CARD_FIELDS.map(function (cf) {
        return '<button class="tsw' + (cardOn(cf.k) ? ' is-on' : '') + '" data-action="toggle-card" data-value="' + cf.k + '">' +
          '<span>' + cf.label + '</span></button>';
      }).join('') + '</div></div>';

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
      '<div class="set-desc">' + (last ? '上次备份：' + ymd(new Date(last)) : '还没有备份过') + ' · 共 ' + state.records.length + ' 条' +
      '<br>JSON 和 ZIP 都含图片与全部设置；ZIP 体积小约 25%</div>' +
      '</div><div class="set-actions">' +
      '<button class="btn btn-primary btn-sm" data-action="export-zip">ZIP</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="export">JSON</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="export-csv">CSV</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="export-md">Markdown</button>' +
      '</div></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">从备份文件导入</div>' +
      '<div class="set-desc">支持 JSON / ZIP，覆盖或合并，合并时按 id 去重</div>' +
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
      '<div class="set-label">数据健康检查</div>' +
      '<div class="set-desc">检查重复条目、缺封面、缺评分等问题</div>' +
      '</div><button class="btn btn-ghost btn-sm" data-action="health">检查</button></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">回收站</div>' +
      '<div class="set-desc">' + (state.trash.length ? state.trash.length + ' 条已删除，30 天内可恢复' : '没有待清理的记录') + '</div>' +
      '</div><button class="btn btn-ghost btn-sm" data-action="go" data-to="trash">打开</button></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">筛选项管理</div>' +
      '<div class="set-desc">筛选项来自你的记录，可以删掉不用的或自己加</div>' +
      '</div><button class="btn btn-ghost btn-sm" data-action="go" data-to="options">管理</button></div>' +
      ((state.prefs.backups || []).length
        ? '<div class="bk-list">' + state.prefs.backups.slice(0, 5).map(function (b2) {
          return '<div class="bk-row"><span>' + ymd(new Date(b2.at)) + ' ' +
            pad(new Date(b2.at).getHours()) + ':' + pad(new Date(b2.at).getMinutes()) + '</span>' +
            '<b>' + (b2.count || 0) + ' 条</b><i>' + (b2.kind || 'JSON') + '</i></div>';
        }).join('') + '</div>'
        : '') +
      '</div>';

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

    /* 其他 */
    html += '<div class="set-group"><h2>其他</h2>' +
      '<div class="set-row"><div class="set-row-main"><div class="set-label">示例数据</div>' +
      '<div class="set-desc">每个类型加三条示例，带封面，随时可以删掉</div></div>' +
      '<button class="btn btn-ghost btn-sm" data-action="seed-examples">填充</button></div>' +
      '<div class="set-row"><div class="set-row-main"><div class="set-label">清空全部数据</div>' +
      '<div class="set-desc">不可恢复，建议先导出一份备份</div></div>' +
      '<button class="btn btn-ghost btn-sm" data-action="clear-all">清空</button></div>' +
      '</div>';

    /* 关于：一次性的工具与纯说明收进折叠，默认不占版面 */
    var installRow = isStandalone() ? '' :
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">添加到主屏幕</div>' +
      '<div class="set-desc">像原生 App 一样全屏打开，断网也能查看和记录</div>' +
      '</div><button class="btn btn-ghost btn-sm" data-action="install">安装</button></div>';

    html += '<div class="set-group"><h2>关于</h2>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">当前版本</div>' +
      '<div class="set-desc">页面 <b>v' + APP_VERSION + '</b> · 缓存 <b>' + SW_VERSION + '</b>' +
      ' · 服务器 <b id="srv-ver">检测中…</b></div>' +
      '</div></div>' +
      '<details class="set-more"><summary>更多工具与说明 <i>7 项</i></summary>' +
      '<div class="set-more-body">' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">检查更新</div>' +
      '<div class="set-desc">手动拉取最新版本</div>' +
      '</div><button class="btn btn-ghost btn-sm" data-action="check-update">检查</button></div>' +
      installRow +
      '<div class="set-row"><div class="set-row-main"><div class="set-label">按年份补全发布日期</div>' +
      '<div class="set-desc">给只有年份的作品补一个 1 月 1 日</div></div>' +
      '<button class="btn btn-ghost btn-sm" data-action="backfill-date">补全</button></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">存储占用</div>' +
      '<div class="set-desc"><b id="stor-info">读取中…</b>（已用 / 本机可用配额）</div>' +
      '</div></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">记录容量</div>' +
      '<div class="set-desc"><b id="stor-cap">读取中…</b>（已用 / 本机可用）</div>' +
      '</div></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">持久化保护</div>' +
      '<div class="set-desc"><b id="stor-persist">读取中…</b>（防止浏览器自动回收本站数据）</div>' +
      '</div></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">iPhone 长期使用</div>' +
      '<div class="set-desc">把网页「添加到主屏幕」再打开；Safari 里长期不访问的站点数据可能被系统清理。定期导出 JSON 备份。</div>' +
      '</div></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">跨设备同步</div>' +
      '<div class="set-desc">导出后在另一台设备导入即可，数据不经过任何服务器</div>' +
      '</div></div>' +
      '<div class="set-row"><div class="set-row-main">' +
      '<div class="set-label">看不到更新时</div>' +
      '<div class="set-desc">点「检查更新」；仍然不行就删掉主屏幕图标，用 Safari 重新打开一次再添加</div>' +
      '</div></div>' +
      '</div></details>' +
      '</div>';


    html += '<p class="muted" style="text-align:center;margin:24px 0 8px">次元簿 v' + APP_VERSION + ' · 数据只保存在这台设备的浏览器里</p>';
    html += '</div>';
    return html;
  }

  /* ---------------- 导入 / 导出 ---------------- */

  function exportJSON() {
    var payload = JSON.parse(JSON.stringify({
      schemaVersion: SCHEMA_VERSION, backupVersion: 2,
      app: '次元簿', exportedAt: new Date().toISOString(), count: state.records.length,
      records: state.records, lists: state.lists, checkins: state.checkins,
      categories: state.categories, trash: state.trash, accounts: accounts(),
      platforms: state.prefs.platforms || [], prefs: state.prefs
    }));
    var refs = imageRefs([payload.records, payload.trash, payload.prefs.spineArt]);
    function finish() {
      var missing = Object.keys(refs).filter(function (id) { return !IMG[id]; });
      if (missing.length) {
        toast('备份未完成：有 ' + missing.length + ' 张本地图片缺失，请先检查图片');
        return;
      }
      var ids = Object.keys(refs);
      Promise.all(ids.map(function (id) {
        return imageDataURL(id).then(function (data) { return [id, data]; });
      })).then(function (pairs) {
        payload.images = Object.create(null);
        pairs.forEach(function (pair) { if (pair[1]) payload.images[pair[0]] = pair[1]; });
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        downloadBlob(blob, 'cimeibu-backup-' + todayISO() + '.json');
        state.prefs.lastExportAt = Date.now();
        state.prefs.backups = [{ at: Date.now(), count: state.records.length, kind: 'JSON' }]
          .concat(state.prefs.backups || []).slice(0, 10);
        savePrefs();
        toast('已导出 ' + state.records.length + ' 条记录及 ' + pairs.length + ' 张图片');
        if (state.route.name === 'settings') render({ keepScroll: true });
      }).catch(function () {
        toast('图片转换失败，备份未生成');
      });
    }
    if (Object.keys(refs).some(function (id) { return !IMG[id]; })) return loadImages().then(finish);
    finish();
  }

  function restoreBackupPrefs(p, mode) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return;
    var dst = state.prefs;
    ['theme', 'accent', 'ratingScale', 'goalCount', 'goalHours', 'seenStandaloneTip',
      'vocab', 'vocabHidden', 'offTypes', 'cardFields', 'book', 'bookOrder', 'spineArt', 'ybStamp'].forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(p, k)) return;
      var v = p[k];
      if (['theme', 'accent', 'ratingScale'].indexOf(k) >= 0 && typeof v !== 'string') return;
      if (['goalCount', 'goalHours', 'seenStandaloneTip'].indexOf(k) >= 0 && typeof v !== 'number') return;
      if (k === 'bookOrder') {
        if (!Array.isArray(v)) return;
        v = v.filter(function (t, i) { return TYPE_KEYS.indexOf(t) >= 0 && v.indexOf(t) === i; });
      } else if (['vocab', 'vocabHidden', 'offTypes', 'cardFields', 'book', 'spineArt', 'ybStamp'].indexOf(k) >= 0) {
        if (!v || typeof v !== 'object' || Array.isArray(v)) return;
        if (k === 'spineArt') {
          var art = {};
          TYPE_KEYS.forEach(function (t) { if (typeof v[t] === 'string') art[t] = v[t]; });
          v = art;
        }
      }
      if (mode !== 'overwrite') {
        if (k === 'spineArt' || k === 'book' || k === 'ybStamp') {
          v = Object.assign({}, v, dst[k] || {});
        } else if (dst[k] && (typeof dst[k] !== 'object' || Object.keys(dst[k]).length)) return;
      }
      dst[k] = v;
    });
    if (['light', 'dark', 'system'].indexOf(dst.theme) < 0) dst.theme = 'system';
    applyTheme();
  }

  /* 先存图片再提交记录；相同 ID、不同内容时另起 ID，防止覆盖现有图片。 */
  function prepareBackupImages(incoming, extras) {
    if (!extras || !extras.images) return Promise.resolve();
    var images = extras.images;
    var refs = imageRefs([incoming, extras.trash, extras.prefs && extras.prefs.spineArt]);
    var replacements = Object.create(null);
    var ids = Object.keys(refs);
    var blobs = Object.create(null);
    ids.forEach(function (id) {
      var data = Object.prototype.hasOwnProperty.call(images, id) ? images[id] : '';
      var blob = (typeof Blob !== 'undefined' && data instanceof Blob) ? data : null;
      if (!blob && typeof data === 'string' && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(data)) {
        blob = dataURLToBlob(data);
      }
      if (!blob) throw new Error('备份图片缺失或格式错误：' + id);
      blobs[id] = blob;
    });
    return Promise.all(ids.map(function (id) {
      var blob = blobs[id];
      var target = IMG[id] && IMG[id] !== blob ? ('b' + uid()) : id;
      return imgPut(target, blob).then(function (ok) {
        if (ok) { IMG[target] = blob; delete IMG_MISSING[target]; }
        replacements['img:' + id] = ok ? 'img:' + target : '';
      });
    })).then(function () {
      function replace(value) {
        if (!value || typeof value !== 'object') return;
        Object.keys(value).forEach(function (k) {
          if (typeof value[k] === 'string' && replacements[value[k]]) value[k] = replacements[value[k]];
          else replace(value[k]);
        });
      }
      replace(incoming); replace(extras.trash); replace(extras.prefs);
    });
  }

  /* ZIP 备份：manifest.json + images/*，图片按二进制原样打包，不再 base64 膨胀 */
  function exportZIP() {
    var payload = JSON.parse(JSON.stringify({
      schemaVersion: SCHEMA_VERSION, backupVersion: 2,
      app: '次元簿', exportedAt: new Date().toISOString(), count: state.records.length,
      records: state.records, lists: state.lists, checkins: state.checkins,
      categories: state.categories, trash: state.trash, accounts: accounts(),
      platforms: state.prefs.platforms || [], prefs: state.prefs
    }));
    var refs = imageRefs([payload.records, payload.trash, payload.prefs.spineArt]);
    var ids = Object.keys(refs);
    var missing = ids.filter(function (id) { return !IMG[id]; });
    if (missing.length) {
      toast('备份未完成：有 ' + missing.length + ' 张本地图片缺失，请先检查图片');
      return;
    }
    Promise.all(ids.map(function (id) {
      var v = IMG[id];
      if (typeof v === 'string') v = dataURLToBlob(v);
      if (!v) return null;
      var ext = (v.type || '').indexOf('png') >= 0 ? 'png' : 'jpg';
      return v.arrayBuffer().then(function (ab) {
        return { id: id, name: 'images/' + id + '.' + ext, data: new Uint8Array(ab), type: v.type || 'image/jpeg' };
      });
    })).then(function (list) {
      list = list.filter(Boolean);
      payload.imageFiles = list.map(function (x) { return { id: x.id, name: x.name, type: x.type }; });
      var manifest = new TextEncoder().encode(JSON.stringify(payload, null, 2));
      var files = [{ name: 'manifest.json', data: manifest }].concat(list.map(function (x) {
        return { name: x.name, data: x.data };
      }));
      var blob = ZipKit.create(files);
      downloadBlob(blob, 'cimeibu-backup-' + todayISO() + '.zip');
      state.prefs.lastExportAt = Date.now();
      state.prefs.backups = [{ at: Date.now(), count: state.records.length, kind: 'ZIP' }]
        .concat(state.prefs.backups || []).slice(0, 10);
      savePrefs();
      toast('已导出 ZIP：' + state.records.length + ' 条记录、' + list.length + ' 张图片');
      if (state.route.name === 'settings') render({ keepScroll: true });
    }).catch(function () {
      toast('ZIP 生成失败，改用 JSON 导出');
    });
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
    var rows = [['id', '类型', '标题', '原名', '别名', '创作者', '年份', '题材', '评分', '豆瓣评分', '推荐指数', '状态', '进度', '刊期',
      '专属信息', '自定义字段',
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
        (r.tags || []).join(' / '),
        r.rating ? ratingText(r.rating) : '',
        r.douban ? r.douban.toFixed(1) : '',
        r.recommend ? (RECOMMEND_LEVELS.filter(function (x) { return x.key === r.recommend; })[0] || {}).label || '' : '',
        statusLabelFor(r),
        progressText(r),
        r.type === 'magazine' ? magazineIssueText(r) : '',
        metaSummary(r),
        customSummary(r),
        r.hours || '',
        1 + r.rewatches.length,
        r.review,
        (r.quotes || []).map(function (q) { return q.text; }).join(' / '),
        (r.notesLog || []).length || '',
        r.cover.indexOf('img:') === 0 ? '' : r.cover,
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
        if (r.tags && r.tags.length) facts.push('**标签**：' + mdEscape(r.tags.join('、')));
        Object.keys(r.meta || {}).forEach(function (mk) {
          if (r.meta[mk]) facts.push('**' + metaLabel(mk) + '**：' + mdEscape(String(r.meta[mk])));
        });
        (r.custom || []).forEach(function (c) {
          if (c && c.k) facts.push('**' + mdEscape(c.k) + '**：' + mdEscape(c.v || ''));
        });
        facts.push('**状态**：' + statusLabelFor(r));
        if (r.rating) facts.push('**我的评分**：' + ratingText(r.rating));
        if (r.douban) facts.push('**' + (formOf(r.type).score || '外部评分') + '**：' + r.douban.toFixed(1));
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

  function logBackup(kind) {
    state.prefs.backups = [{ at: Date.now(), count: state.records.length, kind: kind }]
      .concat(state.prefs.backups || []).slice(0, 10);
    savePrefs();
  }

  function exportCSV() {
    var csv = buildCSV();
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, 'cimeibu-' + todayISO() + '.csv');
    logBackup('CSV');
    toast('已导出 ' + state.records.length + ' 条 CSV');
  }

  function pickImportFile() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,application/zip,.json,.zip';
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

  function importFail(title, desc) {
    openModal({ title: title, desc: desc, actions: [{ label: '知道了', value: null, variant: 'primary' }] });
  }

  function handleImportData(data, zipImages) {
    if (data && !Array.isArray(data) && data.app && String(data.app) !== '次元簿') {
      importFail('不是次元簿的备份',
        '这个文件的软件标识是「' + String(data.app).slice(0, 24) + '」，为避免数据混淆，已拒绝导入。');
      return;
    }
    var list = Array.isArray(data) ? data : (data && data.records);
    if (!Array.isArray(list)) {
      importFail('导入失败', '文件里找不到 records 字段，可能不是次元簿的备份文件。');
      return;
    }
    pendingExtras = {
      lists: (data && Array.isArray(data.lists)) ? data.lists.map(normalizeList).filter(Boolean) : null,
      checkins: (data && Array.isArray(data.checkins)) ? data.checkins.map(normalizeCheckin).filter(Boolean) : null,
      categories: (data && Array.isArray(data.categories)) ? normalizeCategories(data.categories) : null,
      trash: (data && Array.isArray(data.trash)) ? normalizeTrash(data.trash) : null,
      accounts: (data && Array.isArray(data.accounts)) ? normalizeAccounts(data.accounts) : null,
      platforms: (data && Array.isArray(data.platforms)) ? normalizePlatforms(data.platforms) : null,
      prefs: data && data.prefs && typeof data.prefs === 'object' ? data.prefs : null,
      images: zipImages || (data && data.images && typeof data.images === 'object' && !Array.isArray(data.images) ? data.images : null),
      backupVersion: data && Number(data.backupVersion) || 0
    };
    var ver = data && Number(data.schemaVersion);
    if (ver && ver > SCHEMA_VERSION) {
      openModal({
        title: '版本较新',
        desc: '文件的数据版本（v' + ver + '）高于当前应用（v' + SCHEMA_VERSION + '），导入后可能丢失部分字段。',
        actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '仍然导入', value: 'ok', variant: 'primary' }]
      }).then(function (v) { if (v === 'ok') askImportMode(list); });
      return;
    }
    askImportMode(list);
  }

  function handleImportFile(file) {
    var isZip = /\.zip$/i.test(file.name || '') || file.type === 'application/zip';
    if (isZip) {
      var zr = new FileReader();
      zr.onload = function () {
        var buffer = zr.result;
        var magic = 0;
        try { magic = buffer.byteLength >= 4 ? new DataView(buffer).getUint32(0, true) : 0; } catch (e) { magic = 0; }
        if (magic !== 0x04034b50) { importFail('导入失败', '这个文件不是有效的 ZIP。'); return; }
        ZipKit.read(buffer).then(function (entries) {
          var manifestBytes = entries['manifest.json'];
          if (!manifestBytes) throw new Error('ZIP 里缺少 manifest.json');
          var data = JSON.parse(new TextDecoder().decode(manifestBytes));
          var images = {};
          (data.imageFiles || []).forEach(function (f) {
            var bytes = entries[f.name];
            if (bytes) images[f.id] = new Blob([bytes], { type: f.type || 'image/jpeg' });
          });
          handleImportData(data, images);
        }).catch(function (err) {
          importFail('ZIP 读取失败', String(err && err.message || err));
        });
      };
      zr.onerror = function () { importFail('导入失败', '文件读取失败，请重试。'); };
      zr.readAsArrayBuffer(file);
      return;
    }

    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result)); }
      catch (e) { importFail('导入失败', '这个文件不是有效的 JSON，请确认选择的是次元簿导出的备份文件。'); return; }
      handleImportData(data, null);
    };
    reader.onerror = function () { importFail('导入失败', '文件读取失败，请重试。'); };
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

    var hasExtras = pendingExtras && (
      (pendingExtras.accounts || []).length || (pendingExtras.trash || []).length ||
      (pendingExtras.checkins || []).length || (pendingExtras.lists || []).length || pendingExtras.prefs);
    if (!incoming.length && !hasExtras) {
      openModal({
        title: '没有可导入的记录',
        desc: '文件格式正确，但其中没有有效的记录（每条记录至少需要标题）。',
        actions: [{ label: '知道了', value: null, variant: 'primary' }]
      });
      return;
    }

    var sum = [];
    if (pendingExtras && pendingExtras.images) sum.push(Object.keys(pendingExtras.images).length + ' 张图片');
    if (pendingExtras && pendingExtras.accounts) sum.push(pendingExtras.accounts.length + ' 个账号');
    if (pendingExtras && pendingExtras.trash) sum.push(pendingExtras.trash.length + ' 条回收站记录');
    var summary = incoming.length + ' 条记录' + (sum.length ? '、' + sum.join('、') : '');
    openModal({
      title: incoming.length ? '导入 ' + incoming.length + ' 条记录' : '导入备份中的其他数据',
      desc: '备份概况：' + summary + '。\n\n导入会改动当前数据，建议先导出当前备份。合并保留现有记录，按 id 去重，较新的覆盖较旧的。',
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
    var extras = pendingExtras;
    pendingExtras = null;
    if (extras && extras.backupVersion >= 2 && !extras.images) {
      toast('备份图片字段缺失，未修改当前数据');
      return Promise.resolve(false);
    }
    return Promise.resolve().then(function () {
      return prepareBackupImages(incoming, extras);
    }).then(function () {
      commitImport(incoming, mode, extras);
      return flushWrite();
    }).then(function (ok) {
      if (!ok) { toast('恢复写入数据库失败，当前数据未确认，请重试'); return false; }
      return dbGetAllRecords().then(function (rows) {
        var n = rows ? rows.length : -1;
        if (n !== state.records.length) {
          toast('恢复后校验不一致：数据库 ' + n + ' 条，界面 ' + state.records.length + ' 条');
        }
        return true;
      });
    }).catch(function (error) {
      toast('导入失败，当前记录未改动：' + error.message);
      return false;
    });
  }

  function commitImport(incoming, mode, pendingExtras) {
    var oldMedia = [state.records, state.trash, state.prefs.spineArt];
    var added = 0, updated = 0, skipped = 0;
    if (mode === 'overwrite') {
      added = incoming.length;
      state.records = incoming.slice();
      state.lists = (pendingExtras && pendingExtras.lists) ? pendingExtras.lists : [];
      state.checkins = (pendingExtras && pendingExtras.checkins) ? pendingExtras.checkins : [];
      state.categories = (pendingExtras && pendingExtras.categories) ? pendingExtras.categories : [];
      state.trash = (pendingExtras && pendingExtras.trash) ? pendingExtras.trash : [];
      state.prefs.accounts = (pendingExtras && pendingExtras.accounts) ? pendingExtras.accounts : [];
      state.prefs.platforms = (pendingExtras && pendingExtras.platforms) ? pendingExtras.platforms : [];
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
        if (pendingExtras.trash) {
          var activeIds = {}, trashIds = {};
          state.records.forEach(function (r) { activeIds[r.id] = true; });
          state.trash.forEach(function (x) { trashIds[x.r.id] = true; });
          pendingExtras.trash.forEach(function (x) {
            if (!activeIds[x.r.id] && !trashIds[x.r.id]) {
              state.trash.push(x); trashIds[x.r.id] = true;
            }
          });
        }
        if (pendingExtras.accounts) {
          var acctId = {};
          accounts().forEach(function (a, i) { acctId[a.id] = i; });
          pendingExtras.accounts.forEach(function (a) {
            if (!Object.prototype.hasOwnProperty.call(acctId, a.id)) {
              acctId[a.id] = state.prefs.accounts.length;
              state.prefs.accounts.push(a);
            } else if (a.updatedAt > state.prefs.accounts[acctId[a.id]].updatedAt) {
              state.prefs.accounts[acctId[a.id]] = a;
            }
          });
        }
        if (pendingExtras.platforms) {
          var plats = (state.prefs.platforms || []).slice();
          pendingExtras.platforms.forEach(function (p) { if (plats.indexOf(p) < 0) plats.push(p); });
          state.prefs.platforms = plats;
        }
      }
    }
    var activeRecordIds = Object.create(null);
    state.records.forEach(function (r) { activeRecordIds[r.id] = true; });
    state.trash = state.trash.filter(function (x) { return !activeRecordIds[x.r.id]; });
    if (pendingExtras) restoreBackupPrefs(pendingExtras.prefs, mode);
    savePrefs();
    clearStash();
    state.draft = null;
    save();
    purgeImages([oldMedia, incoming, pendingExtras && pendingExtras.trash, pendingExtras && pendingExtras.prefs]);
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

  function metaKeyFromLabel(label, type) {
    var list = EXTRA_FIELDS[type] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].label === label) return list[i].key;
    }
    for (var t in EXTRA_FIELDS) {
      var l2 = EXTRA_FIELDS[t];
      for (var j = 0; j < l2.length; j++) {
        if (l2[j].label === label) return l2[j].key;
      }
    }
    if (label === '条目链接') return 'link';
    return '';
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
    var iAuthor = find('author', 'creator', 'director', 'directors', 'director(s)', '作者', '创作者', '主创');
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
    var iMetaInfo = find('专属信息');
    var iCustomInfo = find('自定义字段');
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

      var metaObj = {};
      if (iMetaInfo >= 0) {
        String(row[iMetaInfo] || '').split(';').forEach(function (seg) {
          var p = seg.indexOf('=');
          if (p < 0) return;
          var lb = seg.slice(0, p).trim();
          var vv = seg.slice(p + 1).trim();
          var mk = metaKeyFromLabel(lb, type);
          if (mk && vv) metaObj[mk] = vv;
        });
      }
      var customArr = [];
      if (iCustomInfo >= 0) {
        String(row[iCustomInfo] || '').split(';').forEach(function (seg) {
          var p = seg.indexOf('=');
          if (p < 0) return;
          var kk = seg.slice(0, p).trim();
          var vv2 = seg.slice(p + 1).trim();
          if (kk) customArr.push({ k: kk, v: vv2 });
        });
      }

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
        meta: Object.keys(metaObj).length ? metaObj : undefined,
        custom: customArr.length ? customArr : undefined,
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
            '<em>' + esc([TYPES[it.type].label, it.creator, it.year, it.rating ? ratingText(it.rating) : '', statusLabel(it.type, it.status)].filter(Boolean).join(' · ')) + '</em></span>' +
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
          douban: it.douban || 0, recommend: it.recommend || '',
          magazine: it.magazine || {},
          meta: it.meta || {},
          custom: it.custom || [],
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
    var root = document.getElementById('modal-root');
    if (root && typeof root.__finish === 'function') { root.__finish(null); return; }
    if (root) root.innerHTML = '';
  }

  function openModal(opts) {
    return new Promise(function (resolve) {
      var root = document.getElementById('modal-root');
      var actions = opts.actions || [{ label: '取消', value: null, variant: 'ghost' }];
      root.innerHTML = '<div class="modal-backdrop">' +
        '<div class="modal' + (opts.cls ? ' ' + opts.cls : '') + '" role="dialog" aria-modal="true">' +
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
        root.__finish = null;
        root.innerHTML = '';
        resolve(v);
      }
      root.__finish = finish;

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


  /* ---------------- 事件 ---------------- */

  var stashTimer = null;
  function queueStash() {
    if (state.readonly) return;
    if (stashTimer) clearTimeout(stashTimer);
    stashTimer = setTimeout(function () {
      stashTimer = null;
      stashDraft();
    }, 700);
  }

  function draftDirty() {
    if (!state.draft || !state.draftSnapshot) return false;
    try {
      return JSON.stringify(state.draft) !== state.draftSnapshot;
    } catch (e) {
      return false;
    }
  }

  var draftStash = null;   /* 未保存草稿，只进 IndexedDB settings */

  function stashDraft() {
    if (!state.draft) return;
    try {
      draftStash = {
        id: state.draft.id || '',
        type: state.draft.type,
        title: state.draft.title || '',
        at: Date.now(),
        json: JSON.stringify(state.draft)
      };
      AppStorage.putSetting('draft', { data: draftStash, savedAt: draftStash.at });
    } catch (e) { /* ignore */ }
  }

  function clearStash() {
    draftStash = null;
    AppStorage.del('settings', 'draft');
  }

  function goBack() {
    if (draftDirty()) {
      openModal({
        title: '放弃这次修改？',
        desc: '这条记录有改动还没保存，返回会丢掉。',
        actions: [
          { label: '继续编辑', value: null, variant: 'ghost' },
          { label: '放弃修改', value: 'ok', variant: 'danger' }
        ]
      }).then(function (v) {
        if (v !== 'ok') return;
        clearStash();
        state.draft = null;
        state.readonly = false;
        location.hash = state.returnTo || '#/book';
      });
      return;
    }
    clearStash();
    state.draft = null;
    state.readonly = false;
    location.hash = state.returnTo || '#/book';
  }

  var READONLY_BLOCKED = {
    'set-type': 1, 'set-status': 1, 'set-star': 1, 'set-unit': 1, 'plus-one': 1,
    'add-quote': 1, 'del-quote': 1, 'add-note': 1, 'del-note': 1,
    'add-episode': 1, 'del-episode': 1, 'add-season': 1, 'del-season': 1,
    'add-rewatch': 1, 'del-rewatch': 1, 'add-custom': 1, 'del-custom': 1,
    'parse-paste': 1, 'toggle-paste': 1, 'save': 1,
    'clear-cover': 1, 'del-image': 1,
    'edit-list': 1, 'new-list': 1, 'list-pick': 1
  };

  function handleImagePick(input) {
    if (state.readonly) return;
    var file = input.files && input.files[0];
    if (!file || !state.draft) return;
    if (!/^image\//.test(file.type || '')) { toast('请选择图片文件'); return; }
    toast('处理中…');
    saveImageFile(file, input.dataset.cover ? 640 : 900).then(function (ref) {
      if (input.dataset.cover) {
        state.draft.cover = ref;
      } else {
        state.draft.images = state.draft.images || [];
        if (state.draft.images.length >= 12) { toast('相册最多 12 张'); return; }
        state.draft.images.push(ref);
      }
      queueStash();
      render({ keepScroll: true });
      toast('已添加图片');
    }).catch(function () {
      toast('图片读取失败，换一张试试');
    });
    input.value = '';
  }

  function handleAction(action, el) {
    if (state.readonly && READONLY_BLOCKED[action]) return;
    switch (action) {
      case 'new':
        if (state.route.name !== 'new' && state.route.name !== 'edit') {
          state.returnTo = '#/' + state.route.name;
        }
        state.readonly = false;
        try { sessionStorage.removeItem('shilu.ro.v1'); } catch (e) { /* ignore */ }
        location.hash = '#/new';
        break;

      case 'open':
        if (state.route.name !== 'new' && state.route.name !== 'edit') {
          state.returnTo = '#/' + state.route.name;
        }
        state.readonly = true;
        try { sessionStorage.setItem('shilu.ro.v1', el.dataset.id); } catch (e) { /* ignore */ }
        location.hash = '#/edit/' + el.dataset.id;
        break;

      case 'edit-mode':
        state.readonly = false;
        try { sessionStorage.removeItem('shilu.ro.v1'); } catch (e) { /* ignore */ }
        render({ keepScroll: true });
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

      case 'opt-del': {
        var ok2 = el.dataset.key, ov = el.dataset.value;
        var oc = metaCounts(ok2);
        if (oc[ov]) {
          var hid = state.prefs.vocabHidden[ok2] || (state.prefs.vocabHidden[ok2] = []);
          if (hid.indexOf(ov) < 0) hid.push(ov);
        } else {
          var voc = state.prefs.vocab[ok2] || [];
          var vi = voc.indexOf(ov);
          if (vi >= 0) voc.splice(vi, 1);
        }
        savePrefs();
        render({ keepScroll: true });
        toast('已从筛选项移除');
        break;
      }

      case 'opt-reset':
        delete state.prefs.vocabHidden[el.dataset.key];
        savePrefs();
        render({ keepScroll: true });
        break;

      case 'opt-add': {
        var ak = el.dataset.key;
        var af = fieldDef(ak);
        openModal({
          title: '添加选项',
          desc: '给「' + (af ? af.label : ak) + '」加一个新值，之后筛选和新增记录都能选到。',
          body: '<input class="input" id="modal-input" maxlength="20" placeholder="例如：精装">',
          actions: [
            { label: '取消', value: null, variant: 'ghost' },
            { label: '添加', value: 'ok', variant: 'primary', collect: true }
          ]
        }).then(function (v) {
          if (!v) return;
          var nv = String(v).trim().slice(0, 20);
          if (!nv) return;
          var vl = state.prefs.vocab[ak] || (state.prefs.vocab[ak] = []);
          if (vl.indexOf(nv) < 0) vl.push(nv);
          var hd = state.prefs.vocabHidden[ak];
          if (hd) {
            var hi = hd.indexOf(nv);
            if (hi >= 0) hd.splice(hi, 1);
          }
          savePrefs();
          render({ keepScroll: true });
          toast('已添加：' + nv);
        });
        break;
      }

      case 'close-modal':
        closeModal();
        break;

      case 'rcard-edit':
        closeModal();
        state.returnTo = location.hash || '#/book';
        location.hash = '#/edit/' + el.dataset.id;
        break;

      case 'record-card':
        openRecordCard(el.dataset.id);
        break;

      case 'book-open':
        state.book.page = 0;
        state.returnTo = '#/book';
        location.hash = '#/book/' + el.dataset.value;
        break;

      case 'bk-settings':
        openBookSettings();
        break;

      case 'acct-new':
        openAccountEditor('');
        break;

      case 'acct-edit':
        openAccountEditor(el.dataset.id);
        break;

      case 'acct-export':
        exportAccountsCSV();
        break;

      case 'acct-game':
        openGameEditor(el.dataset.id, Number(el.dataset.idx));
        break;

      case 'acct-copy': {
        var ca = accounts().filter(function (a) { return a.id === el.dataset.id; })[0];
        if (!ca) break;
        var lines = [];
        if (ca.name) lines.push('账号：' + ca.name);
        if (ca.nickname) lines.push('昵称：' + ca.nickname);
        if (ca.email) lines.push('邮箱：' + ca.email);
        if (ca.friendCode) lines.push('好友码：' + ca.friendCode);
        if (ca.platform) lines.push('平台：' + ca.platform + (ca.region ? ' · ' + ca.region : ''));
        copyText(lines.join('\n'));
        break;
      }

      case 'retry-boot':
        location.reload();
        break;

      case 'sync-reload':
        location.reload();
        break;

      case 'retry-write':
        if (state.draft && (state.route.name === 'new' || state.route.name === 'edit')) {
          saveDraft();
          break;
        }
        flushWrite().then(function (ok) {
          toast(ok ? '已写入本机数据库' : '仍然写不进去，请导出备份后重试');
        });
        break;

      case 'spine-art':
        openSpineArtPicker();
        break;

      case 'spine-art-clear': {
        var sat = el.dataset.value;
        var sam = state.prefs.spineArt || {};
        var oldArt = sam[sat];
        if (oldArt) {
          delete sam[sat];
          state.prefs.spineArt = sam;
          purgeImages([oldArt]);
          var keepY2 = modalScrollTop();
          savePrefs();
          save();
          render({ keepScroll: true });
          openSpineArtPicker();
          restoreModalScroll(keepY2);
          toast('已恢复类型色');
        }
        break;
      }

      case 'acct-fold': {
        var fk = el.dataset.key;
        state.ui.acctFold = state.ui.acctFold || {};
        if (state.ui.acctFold[fk]) delete state.ui.acctFold[fk];
        else state.ui.acctFold[fk] = 1;
        render({ keepScroll: true });
        break;
      }

      case 'acct-quick':
        state.ui.acctQuick = state.ui.acctQuick === el.dataset.id ? '' : el.dataset.id;
        render({ keepScroll: true });
        break;

      case 'acct-add-game': {
        var gid = el.dataset.id;
        var ginput = document.getElementById('acct-quick-input');
        var parsedGames = parseGameList(ginput ? ginput.value : '');
        if (!parsedGames.length) { toast('先输入游戏名'); break; }
        var garr = accounts().slice();
        var ghit = garr.filter(function (a) { return a.id === gid; })[0];
        if (!ghit) break;
        var gbefore = ghit.games.length;
        ghit.games = normalizeGames(ghit.games.concat(parsedGames));
        ghit.updatedAt = Date.now();
        state.prefs.accounts = garr;
        render({ keepScroll: true });
        flushPrefsDB().then(function (ok) {
          toast(ok ? '已加 ' + (ghit.games.length - gbefore) + ' 款' : '没写入数据库，请重试');
        });
        break;
      }

      case 'acct-del': {
        var aid = el.dataset.id;
        var hit = accounts().filter(function (a) { return a.id === aid; })[0];
        if (!hit) break;
        openModal({
          title: '删除账号？',
          desc: '「' + hit.name + '」会从账号库移除，记录本身不受影响。',
          actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '删除', value: 'ok', variant: 'danger' }]
        }).then(function (v) {
          if (v !== 'ok') return;
          state.prefs.accounts = accounts().filter(function (a) { return a.id !== aid; });
          render({ keepScroll: true });
          flushPrefsDB().then(function (ok) {
            toast(ok ? '已删除' : '删除没写入数据库，请重试');
          });
        });
        break;
      }

      case 'bk-set': {
        var bkKey = el.dataset.key, bkVal = el.dataset.value, bkPatch = {};
        var bkType = state.book.type;
        if (bkKey === 'per') bkPatch.per = Number(bkVal) || 1;
        else if (bkKey === 'order') bkPatch.order = bkVal === 'new' ? 'new' : 'seq';
        else if (bkKey === 'album') bkPatch.album = bkVal;
        else if (bkKey === 'sound') bkPatch.sound = bkVal === 'on';
        else if (bkKey === 'ticket') {
          var bkTicket = bookCfg().ticket;
          bkTicket[bkType] = bkVal;
          bkPatch.ticket = bkTicket;
        }
        saveBookCfg(bkPatch);
        state.book.page = 0;
        render({ keepScroll: true });
        openBookSettings();
        break;
      }

      case 'book-next':
        bookFlip(1);
        break;

      case 'book-jump': {
        var jl = bookList(state.book.type);
        var jtm = isTicketType(state.book.type) && bookCfg().ticket[state.book.type] === 'stub';
        var jp = jtm ? 1 : bookCfg().per;
        var jt = Math.max(1, Math.ceil(jl.length / (bookNarrow() ? jp : jp * 2)));
        state.book.page = state.book.page >= jt - 1 ? 0 : jt - 1;
        render({ keepScroll: true });
        break;
      }

      case 'book-prev':
        bookFlip(-1);
        break;

      case 'ticket':
        openTicket(el.dataset.id);
        break;

      case 'yb-open': {
        var yt = el.dataset.value;
        state.archive.type = yt;
        state.archive.year = 0;
        state.ui.ybMonth = 0;
        state.ui.ybIndex = 1;
        state.returnTo = '#/book/' + yt;
        location.hash = '#/archive/' + yt;
        break;
      }

      case 'yb-year':
        state.archive.year = el.dataset.value;
        state.ui.ybMonth = 0;
        state.ui.ybIndex = 1;
        render();
        break;

      case 'yb-idx':
        state.ui.ybIndex = Math.max(1, Number(el.dataset.value) || 1);
        render({ keepScroll: true });
        break;

      case 'yb-month': {
        var m = Number(el.dataset.value);
        state.ui.ybMonth = state.ui.ybMonth === m ? 0 : m;
        render({ keepScroll: true });
        break;
      }

      case 'yb-stamp': {
        var key = (state.archive.type || '') + ':' + el.dataset.value;
        var yb = state.prefs.ybStamp || (state.prefs.ybStamp = {});
        yb[key] = (Number(yb[key]) || 0) + 1;
        savePrefs();
        render({ keepScroll: true });
        break;
      }

      case 'seed-examples':
        seedExamples();
        break;

      case 'accent':
        state.prefs.accent = el.dataset.value || 'rose';
        savePrefs();
        applyTheme();
        render({ keepScroll: true });
        break;

      case 'toggle-type': {
        var tk = el.dataset.value;
        state.prefs.offTypes = state.prefs.offTypes || {};
        if (state.prefs.offTypes[tk]) delete state.prefs.offTypes[tk];
        else state.prefs.offTypes[tk] = 1;
        if (state.filters.type === tk && state.prefs.offTypes[tk]) state.filters.type = 'all';
        savePrefs();
        render({ keepScroll: true });
        break;
      }

      case 'toggle-card':
        state.prefs.cardFields = state.prefs.cardFields || {};
        if (state.prefs.cardFields[el.dataset.value] === false) delete state.prefs.cardFields[el.dataset.value];
        else state.prefs.cardFields[el.dataset.value] = false;
        savePrefs();
        render({ keepScroll: true });
        break;

      case 'random': {
        if (!state.records.length) { toast('还没有记录'); break; }
        var pick = state.records[Math.floor(Math.random() * state.records.length)];
        openRecordCard(pick.id);
        break;
      }

      case 'tag-open': {
        var tg = el.dataset.tag;
        var hits = state.records.filter(function (r) {
          return (r.tags || []).indexOf(tg) >= 0;
        }).sort(function (x, y) { return y.updatedAt - x.updatedAt; });
        if (!hits.length) { toast('这个题材还没有作品'); break; }
        openModal({
          title: tg,
          desc: '共 ' + hits.length + ' 条',
          body: '<div class="day-list">' + hits.map(function (r) {
            return '<button class="day-row" data-action="record-card" data-id="' + r.id + '">' +
              '<span class="day-cover" style="--cc:' + coverColor(r.title) + '">' + coverInner(r) + '</span>' +
              '<span class="day-main"><span class="day-title">' + esc(r.title) + '</span>' +
              '<span class="day-sub">' + TYPES[r.type].label + ' · ' + statusLabelFor(r) + '</span></span></button>';
          }).join('') + '</div>',
          actions: [{ label: '关闭', value: null, variant: 'ghost' }]
        });
        break;
      }

      case 'open-person':
        state.returnTo = '#/authors';
        location.hash = '#/person/' + encodeURIComponent(el.dataset.name);
        break;

      case 'view-img':
        viewImage(el.dataset.src);
        break;

      case 'trash-restore': {
        var back = trashRestore(el.dataset.id);
        if (!back) break;
        save();
        render({ keepScroll: true });
        flushWrite().then(function (ok) {
          toast(ok ? '已恢复「' + back.title + '」' : '恢复没写入数据库，请重试');
        });
        break;
      }

      case 'trash-purge':
        openModal({
          title: '彻底删除？',
          desc: '这条记录将从本机移除，无法再恢复。',
          actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '删除', value: 'ok', variant: 'danger' }]
        }).then(function (v) {
          if (v !== 'ok') return;
          var gone = state.trash.filter(function (x) { return x.r.id === el.dataset.id; });
          state.trash = state.trash.filter(function (x) { return x.r.id !== el.dataset.id; });
          purgeImages(gone.map(function (x) { return x.r; }));
          save();
          render({ keepScroll: true });
          flushWrite().then(function (ok) {
            toast(ok ? '已彻底删除' : '删除没写入数据库，请重试');
          });
        });
        break;

      case 'trash-clear':
        openModal({
          title: '清空回收站？',
          desc: '共 ' + state.trash.length + ' 条，清空后无法恢复。',
          actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '清空', value: 'ok', variant: 'danger' }]
        }).then(function (v) {
          if (v !== 'ok') return;
          var purged = state.trash.map(function (x) { return x.r; });
          state.trash = [];
          purgeImages(purged);
          save();
          render({ keepScroll: true });
          flushWrite().then(function (ok) {
            toast(ok ? '回收站已清空' : '清空没写入数据库，请重试');
          });
        });
        break;

      case 'clear-cover':
        if (!state.draft) break;
        state.draft.cover = '';
        queueStash();
        render({ keepScroll: true });
        break;

      case 'del-image':
        if (!state.draft) break;
        var idx = Number(el.dataset.idx);
        if (state.draft.images && state.draft.images[idx] != null) {
          state.draft.images.splice(idx, 1);
          queueStash();
          render({ keepScroll: true });
        }
        break;

      case 'tl-fold-all': {
        var mk = monthKeys();
        var anyOpen = false;
        for (var mi = 0; mi < mk.length; mi++) {
          if (!state.ui.fold['tl_' + mk[mi]]) { anyOpen = true; break; }
        }
        for (var mj = 0; mj < mk.length; mj++) state.ui.fold['tl_' + mk[mj]] = anyOpen;
        render({ keepScroll: true });
        break;
      }

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

      case 'back-home':
        location.hash = '#/home';
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

      case 'set-status':
        if (state.draft && STATUS_KEYS.indexOf(el.dataset.value) >= 0 && state.draft.status !== el.dataset.value) {
          state.draft.status = el.dataset.value;
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
        render({ keepScroll: true });
        flushWrite().then(function (ok) {
          toast(ok ? '进度 +1' : '进度没写入数据库，请重试');
        });
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
              desc: '「' + rec.title + '」会移到回收站，' + TRASH_DAYS + ' 天内可以恢复。',
              actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '移到回收站', value: 'ok', variant: 'danger' }]
            }).then(function (v) {
              if (v !== 'ok') return;
              var prevTrash = state.trash.slice();
              state.records = state.records.filter(function (r) { return r.id !== rec.id; });
              trashAdd([rec]);
              save();
              flushWrite().then(function (ok) {
                if (!ok) {
                  state.records.push(rec);
                  state.trash = prevTrash;
                  toast('删除失败，记录已恢复');
                  render({ keepScroll: true });
                  return;
                }
                state.draft = null;
                state.readonly = false;
                try { sessionStorage.removeItem('shilu.ro.v1'); } catch (e2) { /* ignore */ }
                toast('已删除');
                location.hash = state.returnTo || '#/book';
              });
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

      case 'yb-report': {
        var yr = String(state.archive.year || '');
        var rt = state.archive.type;
        state.report = {
          year: yr, month: 'all', type: rt,
          data: buildReport(yr, 'all', rt)
        };
        render({ keepScroll: true });
        setTimeout(function () {
          var card = document.getElementById('report-card');
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
        break;
      }

      case 'yb-report-save':
        saveReportCard();
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

      case 'export-zip':
        exportZIP();
        break;

      case 'export-csv':
        exportCSV();
        break;

      case 'export-md':
        exportMarkdown();
        break;

      case 'health':
        openHealth();
        break;

      case 'health-open': {
        var hid = el.dataset.id;
        closeModal();
        state.readonly = false;
        try { sessionStorage.removeItem('shilu.ro.v1'); } catch (e) { /* ignore */ }
        state.returnTo = '#/settings';
        location.hash = '#/edit/' + hid;
        break;
      }

      case 'merge-dups': {
        var mIds = String(el.dataset.ids || '').split(',').filter(Boolean);
        if (mIds.length < 2) { toast('少于两条，不用合并'); break; }
        openModal({
          title: '合并重复条目？',
          desc: '把 ' + mIds.length + ' 条合并成一条：保留最早那条的标题，标签、金句、笔记、专属字段会并进来，其余的删除。',
          actions: [{ label: '取消', value: null, variant: 'ghost' }, { label: '合并', value: 'ok', variant: 'primary' }]
        }).then(function (v) {
          if (v === 'ok') mergeDuplicates(mIds);
        });
        break;
      }

      case 'open-link': {
        var linkEl = document.querySelector('[data-field="meta.link"]');
        var url = linkEl ? String(linkEl.value || '').trim() : '';
        if (!url) { toast('先填一个链接'); break; }
        if (!/^https?:\/\//i.test(url)) { toast('链接要以 http:// 或 https:// 开头'); break; }
        window.open(url, '_blank', 'noopener');
        break;
      }

      case 'add-custom':
        if (state.draft) {
          if (!Array.isArray(state.draft.custom)) state.draft.custom = [];
          if (state.draft.custom.length >= 30) { toast('最多 30 个自定义字段'); break; }
          state.draft.custom.push({ k: '', v: '' });
          render({ keepScroll: true });
          var lastK = document.querySelectorAll('.custom-k');
          if (lastK.length) lastK[lastK.length - 1].focus();
        }
        break;

      case 'del-custom':
        if (state.draft && Array.isArray(state.draft.custom)) {
          var di = Number(el.dataset.idx);
          state.draft.custom.splice(di, 1);
          render({ keepScroll: true });
        }
        break;

      case 'go':
        if (['badges', 'options', 'week', 'tags', 'trash', 'archive',
          'quotes', 'authors', 'book', 'accounts'].indexOf(el.dataset.to) >= 0) {
          state.returnTo = location.hash || ('#/' + state.route.name);
        }
        location.hash = '#/' + el.dataset.to;
        break;

      case 'bulk-import':
        openBulkImport();
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
          state.prefs.accounts = [];
          state.prefs.spineArt = {};
          state.prefs.bookOrder = [];
          state.prefs.book = {};
          state.prefs.ybStamp = {};
          state.prefs.platforms = [];
          state.prefs.backups = [];
          state.trash = [];
          state.draft = null;
          Object.keys(IMG).forEach(function (id) { delete IMG[id]; });
          Object.keys(IMG_MISSING).forEach(function (id) { delete IMG_MISSING[id]; });
          clearStash();
          dbClear().then(function (ok) {
            AppStorage.putMeta('migrated', { at: Date.now(), version: 1 });
            savePrefs();
            save();
            toast(ok ? '已清空' : '清空失败，请重试');
            render({ keepScroll: true });
          });
        });
        break;
    }
  }

  /* 粘贴文本里的「键：值」映射到对应字段 */
  var PASTE_KEY_MAP = {
    '出版社': 'publisher', '出版方': 'publisher', '发行': 'publisher', '发行商': 'publisher', '厂牌': 'publisher',
    '译者': 'translator',
    'ISBN': 'isbn',
    '页数': 'pages',
    '字数': 'words',
    '卷数': 'volumes',
    '主演': 'cast', '主要演员': 'cast', '嘉宾': 'cast',
    '编剧': 'screenwriter',
    '片长': 'runtime', '时长': 'runtime', '单集时长': 'runtime', '总时长': 'runtime',
    '平台': 'platform', '播出平台': 'platform', '收听平台': 'platform', '上线平台': 'platform',
    '电视台': 'channel', '频道': 'channel', '出品方': 'channel',
    '主持人': 'host', '嘉宾': 'cast',
    '剧场': 'venue', '场馆': 'venue', '场次': 'shows', '座位': 'seat',
    '语言': 'language',
    '流派': 'genre', '介质': 'medium',
    '连载杂志': 'magazineName', '原作': 'originalWork', '作画': 'artist',
    '总话数': 'epCount', '集数': 'epCount', '总集数': 'epCount', '期数': 'epCount',
    '季数': 'seasons', '放送季度': 'season',
    '装帧': 'binding', '首发': 'firstPlatform',
    '系列构成': 'seriesComp', '角色设计': 'charDesign',
    '成就': 'achievements', '奖杯': 'achievements',
    '定价': 'price', '价格': 'price', '丛书': 'series', '系列': 'series',
    '副标题': 'subtitle', '副题': 'subtitle',
    '唱片数': 'discs', '碟数': 'discs',
    '配乐': 'composer', '音乐': 'composer',
    '分级': 'ageRating', 'IMDb': 'imdb',
    '链接': 'link', '条目链接': 'link', '豆瓣链接': 'link',
    '阅读格式': 'format',
    '制作公司': 'studio', '动画制作': 'studio', '开发商': 'studio', '制作组': 'studio', '剧团': 'studio',
    '国家': 'country', '制片国家': 'country', '地区': 'country',
    '曲目': 'tracks', '曲目数': 'tracks',
    '声优': 'cv', '主役声优': 'cv',
    '剧场': 'venue', '场馆': 'venue',
    '平台类型': 'gameType',
    '连载状态': 'serialStatus', '状态': 'serialStatus'
  };

  function extractRich(text) {
    var out = { meta: {}, cover: '', review: '' };
    var lines = String(text || '').split(/\r?\n/);

    /* 封面：优先 markdown 图片，其次裸链接 */
    var md = text.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
    if (md) out.cover = md[1];
    if (!out.cover) {
      var m2 = text.match(/https?:\/\/[^\s"'<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/i);
      if (m2) out.cover = m2[0];
    }

    /* 键：值 */
    lines.forEach(function (line) {
      var m = line.match(/^\s*([^：:]{1,10})[：:]\s*(.+?)\s*$/);
      if (!m) return;
      var key = m[1].replace(/\s+/g, '');
      var val = m[2].trim();
      if (!val) return;
      var target = PASTE_KEY_MAP[key];
      if (!target) return;
      if (target === 'runtime' || target === 'pages' || target === 'words' ||
          target === 'volumes' || target === 'tracks') {
        var num = val.match(/\d+(?:\.\d+)?/);
        if (num) out.meta[target] = num[0];
        return;
      }
      out.meta[target] = val.slice(0, 60);
    });

    /* 简介：最长的一段纯文字 */
    var best = '';
    lines.forEach(function (line) {
      var t = line.trim();
      if (t.length < 30) return;
      if (/^[\w\s：:]+$/.test(t) && t.length < 60) return;
      if (t.length > best.length) best = t;
    });
    if (best) out.review = best.slice(0, 400);

    return out;
  }

  function parsePaste() {
    var text = state.pasteText || '';
    if (!text.trim()) {
      toast('先粘贴一段文字');
      return;
    }

    /* 只贴了一个链接：读不到内容，直接说清楚 */
    var onlyUrl = text.trim().match(/^(https?:\/\/\S+)$/);
    if (onlyUrl) {
      var u = onlyUrl[1];
      var isImg = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(u);
      var d0 = state.draft;
      if (isImg && d0) {
        d0.cover = u;
        render({ keepScroll: true });
        toast('这是图片链接，已设为封面');
        return;
      }
      toast('只贴链接读不到内容：浏览器不能跨站抓取网页，请在网页上全选复制文字再粘贴');
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
    /* 封面与类型专属字段 */
    var rich = extractRich(text);
    if (rich.cover && !d.cover) { d.cover = rich.cover; filled.push('封面'); }
    if (!d.meta) d.meta = {};
    var metaN = 0;
    Object.keys(rich.meta).forEach(function (k) {
      if (!d.meta[k]) { d.meta[k] = rich.meta[k]; metaN++; }
    });
    if (metaN) filled.push('专属信息 ' + metaN + ' 项');
    if (rich.review && !d.review) { d.review = rich.review; filled.push('简介'); }

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

      if (el.dataset && el.dataset.custom && state.draft) {
        setDraftField('custom.' + el.dataset.custom, el.value);
        queueStash();
        return;
      }

      var f = el.dataset.field;
      if (f && state.draft) {
        queueStash();
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

      if (el.type === 'file' && el.dataset && (el.dataset.cover || el.dataset.image)) {
        handleImagePick(el);
        return;
      }
      if (el.type === 'file' && el.dataset && el.dataset.spine) {
        handleSpineArtPick(el);
        return;
      }

      if (el.dataset && el.dataset.filter === 'meta') {
        if (!state.filters.meta) state.filters.meta = {};
        state.filters.meta[el.dataset.key] = el.value;
        render({ keepScroll: true });
        return;
      }
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

  var booted = false, bootFailed = false;

  function renderBoot() {
    view.innerHTML = '<div class="page"><div class="boot-wait">' +
      '<div class="boot-spin" aria-hidden="true"></div>' +
      '<p>正在读取本机数据…</p></div></div>';
  }

  function renderBootError() {
    bootFailed = true;
    view.innerHTML = '<div class="page"><div class="boot-wait">' +
      '<p>本机数据库打不开，记录暂时读不到。</p>' +
      '<p class="muted">可能是无痕模式、网站数据被禁用，或另一个标签页正占用数据库。关掉其他页面后点重试。</p>' +
      '<button class="btn btn-primary btn-sm" data-action="retry-boot">重试</button></div></div>';
  }

  function init() {
    loadUiPrefs();
    applyTheme();
    var now = new Date();
    state.timeline.y = now.getFullYear();
    state.timeline.m = now.getMonth();
    state.checkin.y = now.getFullYear();
    state.checkin.m = now.getMonth();

    var r = parseRoute();
    state.route = r;
    if (!state.route.name) state.route.name = 'home';

    bindEvents();
    registerSW();
    watchInstall();
    renderBoot();

    /* 切后台或关闭时，把记录和设置都强制落一次 */
    window.addEventListener('pagehide', function () { flushWrite(); flushPrefsDB(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { flushWrite(); flushPrefsDB(); }
    });

    /* 告诉 index.html 里的启动自检：脚本已经跑起来了 */
    window.__BOOT_OK = true;
    var fix = document.getElementById('boot-fix');
    if (fix) fix.parentNode.removeChild(fix);

    bootStore().then(function (ok) {
      if (!ok) { renderBootError(); return; }
      booted = true;
      applyTheme();
      var nowRoute = state.route;
      if (nowRoute.name === 'new') initDraft(null);
      else if (nowRoute.name === 'edit') initDraft(nowRoute.id);
      else state.draft = null;
      render();
      loadImages().then(function (n) { if (n) render({ keepScroll: true }); });
      checkStandaloneTip();
      readStorageInfo();
      requestPersistentStorage().then(function () {
        if (state.route.name === 'settings') paintStorageInfo();
      });
    });
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
        if (storQuota && storUsed / storQuota > 0.8 && !quotaWarned) {
          quotaWarned = true;
          toast('本机存储已用超过 80%，请导出备份并清理图片');
        }
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

  /* 申请持久化存储：能显著降低浏览器在磁盘紧张时回收本站数据的概率 */
  function requestPersistentStorage() {
    try {
      if (!navigator.storage || !navigator.storage.persist || !navigator.storage.persisted) {
        storagePersisted = false;
        return Promise.resolve(false);
      }
      return navigator.storage.persisted().then(function (already) {
        if (already) { storagePersisted = true; return true; }
        return navigator.storage.persist().then(function (ok) {
          storagePersisted = !!ok;
          return storagePersisted;
        });
      }).catch(function () { storagePersisted = false; return false; });
    } catch (e) { storagePersisted = false; return Promise.resolve(false); }
  }

  function paintStorageInfo() {
    var el = document.getElementById('stor-info');
    var cap = document.getElementById('stor-cap');
    if (!el && !cap) return;
    var t = storageTexts();
    if (el) el.textContent = t[0];
    if (cap) cap.textContent = t[1];
    var ps = document.getElementById('stor-persist');
    if (ps) ps.textContent = storagePersisted === null ? '读取中…'
      : (storagePersisted ? '已开启，浏览器不会自动回收' : '未开启，建议添加到主屏幕并定期导出备份');
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

  /* iOS「添加到主屏幕」后是独立存储，和 Safari 里的数据互不相通。
     第一次在独立窗口打开、又没有记录时，直接说清楚怎么把数据搬过来。 */
  function checkStandaloneTip() {
    var standalone = false;
    try {
      if (window.navigator.standalone === true) standalone = true;
      else if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) standalone = true;
    } catch (e) { standalone = false; }
    if (!standalone) return;
    if (state.prefs.seenStandaloneTip) return;
    if (state.records.length) return;

    setTimeout(function () {
      openModal({
        title: '第一次从主屏幕打开？',
        desc: '主屏幕版和 Safari 里是两个独立的存储空间，这里看不到 Safari 里的记录。\n\n' +
          '如果之前记过东西：先用 Safari 打开同一网址 → 设置 → 导出全部数据（JSON），' +
          '再回到这里 → 设置 → 从 JSON 文件导入。',
        actions: [{ label: '知道了', value: 'ok', variant: 'primary' }]
      }).then(function () {
        state.prefs.seenStandaloneTip = 1;
        savePrefs();
      });
    }, 1200);
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
  /* ---------------- 图标长按提示 ---------------- */
  /* 桌面靠 title hover，触屏靠长按气泡；长按后抑制那一次误触点击 */

  function paintIconTips() {
    var sels = '.icon-btn, .tab, .fab, .more-tile, .more-btn, .bk-nav, .bk-mark, ' +
      '.yb-tab-arrow, .yb-pager button, .days-strip, .mini-btn, .search-clear';
    var nodes = view.querySelectorAll(sels);
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.dataset.tip) continue;
      var t = el.getAttribute('aria-label') || el.getAttribute('title') || '';
      if (!t) {
        var b = el.querySelector('b');
        if (b) t = b.textContent;
        else {
          var sp = el.querySelector('span:not(.ico)');
          t = sp ? sp.textContent : el.textContent;
        }
      }
      t = String(t || '').replace(/\s+/g, ' ').trim().slice(0, 24);
      if (!t) continue;
      el.dataset.tip = t;
      if (!el.getAttribute('title')) el.setAttribute('title', t);
    }
  }

  var iconTipTimer = null;
  var iconTipEl = null;
  var iconTipTarget = null;
  var iconTipAt = 0;

  function hideIconTip() {
    if (iconTipTimer) { clearTimeout(iconTipTimer); iconTipTimer = null; }
    if (iconTipEl) { iconTipEl.remove(); iconTipEl = null; }
  }

  function showIconTip(el) {
    var text = el.dataset.tip;
    if (!text) return;
    hideIconTip();
    var box = document.createElement('div');
    box.className = 'icon-tip';
    box.textContent = text;
    document.body.appendChild(box);
    var r = el.getBoundingClientRect();
    var w = box.offsetWidth, h = box.offsetHeight;
    var left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    var top = r.bottom + 9;
    if (top + h > window.innerHeight - 10) top = Math.max(8, r.top - h - 9);
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    iconTipEl = box;
    iconTipTarget = el;
    iconTipAt = Date.now();
    iconTipTimer = setTimeout(hideIconTip, 2200);
  }

  document.addEventListener('touchstart', function (e) {
    var t = e.target;
    var el = t && t.closest ? t.closest('[data-tip]') : null;
    hideIconTip();
    if (!el) return;
    iconTipTarget = el;
    iconTipTimer = setTimeout(function () { showIconTip(el); }, 420);
  }, { passive: true });

  ['touchend', 'touchmove', 'touchcancel', 'scroll'].forEach(function (ev) {
    document.addEventListener(ev, function () {
      if (iconTipTimer && !iconTipEl) { clearTimeout(iconTipTimer); iconTipTimer = null; }
    }, { passive: true });
  });

  /* 长按只是想看说明：紧跟着的那次 click 不该真的执行动作 */
  document.addEventListener('click', function (e) {
    if (!iconTipTarget || !iconTipEl) return;
    var t = e.target;
    var el = t && t.closest ? t.closest('[data-tip]') : null;
    if (el === iconTipTarget && Date.now() - iconTipAt < 1400) {
      e.preventDefault();
      e.stopPropagation();
      hideIconTip();
      iconTipTarget = null;
    }
  }, true);

  window.__shilu = { state: state, render: render, save: save,
    flushWrite: flushWrite, loadImages: loadImages, coverSrc: coverSrc, IMG: IMG,
    bootStore: bootStore, typesOn: typesOn };

})();
