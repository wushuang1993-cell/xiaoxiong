const DEFAULT_STATE = {
  people: [
    { name: "闪闪鱼", displayName: "闪闪鱼", wechatId: "shuang_wu83", openid: "oARbkxZvJaqo4ZvUb7cYzebpxi2k", coins: 0, redrawChances: 0, exchangeChances: 0, wishBear: "史迪奇", image: "../../assets/shanshanyu.png" },
    { name: "杰尼龟", displayName: "杰尼龟", wechatId: "Alan0Xu", openid: "oARbkxXMLbBTgt1PtABedW2BhwFk", coins: 0, redrawChances: 0, exchangeChances: 0, wishBear: "卢卡斯", image: "../../assets/jienigui.png" }
  ],
  bears: [
    { name: "史迪奇", image: "../../assets/stitch.png", active: true },
    { name: "拖拉机", image: "../../assets/tractor.png", active: true },
    { name: "芭芭拉", image: "../../assets/barbara.png", active: true },
    { name: "卢卡斯", image: "../../assets/lucas.png", active: true },
    { name: "马里奥", image: "../../assets/mario.png", active: true },
    { name: "爱丽丝", image: "../../assets/alice.png", active: true }
  ],
  draw: null,
  drawUsed: false,
  drawHistory: {},
  todayId: "",
  pendingAuction: null,
  actions: [],
  logs: {},
  sportsLogs: {},
  wechatSteps: {},
  sportRules: [
    { key: "run", label: "跑步", rate: 1.2 },
    { key: "walk", label: "快走", rate: 0.8 },
    { key: "ride", label: "骑行", rate: 0.7 },
    { key: "swim", label: "游泳", rate: 1.4 },
    { key: "strength", label: "力量", rate: 1 },
    { key: "yoga", label: "瑜伽", rate: 0.6 },
    { key: "ball", label: "球类", rate: 1.1 }
  ],
  rules: {
    base: [
      { label: "做饭", value: "+1 申请重抽" },
      { label: "洗衣服", value: "+1 申请重抽" },
      { label: "倒垃圾", value: "+1 申请重抽" }
    ],
    bonus: [
      { label: "帮对方设计封面图", value: "+1 申请兑换" },
      { label: "帮对方提供工作建议", value: "+1 申请兑换" }
    ],
    penalty: [
      { label: "未完成基础家务", value: "-1 申请重抽" }
    ]
  }
};

const BEAR_IMAGE_BY_NAME = {
  史迪奇: "../../assets/stitch.png",
  拖拉机: "../../assets/tractor.png",
  芭芭拉: "../../assets/barbara.png",
  卢卡斯: "../../assets/lucas.png",
  马里奥: "../../assets/mario.png",
  爱丽丝: "../../assets/alice.png"
};

const REMOVED_BEAR_NAMES = [];
const SHANSHANYU_WISH_HIT_RATE = 0.7;

const PERSON_IMAGE_BY_NAME = {
  闪闪鱼: "../../assets/shanshanyu.png",
  杰尼龟: "../../assets/jienigui.png"
};

const ALLOWED_PERSON_NAMES = DEFAULT_STATE.people.map((person) => person.name);

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseLogDate(log, fallbackDay) {
  if (log?.date) {
    const parsed = new Date(log.date);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (log?.createdAt) {
    const parsed = new Date(log.createdAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), Number(fallbackDay || now.getDate()));
}

function isLogActive(logDate, today = new Date()) {
  const expiryMonthOffset = logDate.getDate() >= 25 ? 2 : 1;
  const expiresAt = new Date(logDate.getFullYear(), logDate.getMonth() + expiryMonthOffset, 1);
  return today < expiresAt;
}

function normalizeLog(log, fallbackDay) {
  const logDate = parseLogDate(log, fallbackDay);
  const dateKey = formatDateKey(logDate);
  const createdAt = log.createdAt || `${dateKey}T00:00:00.000Z`;
  const stableId = [
    "log",
    dateKey,
    fallbackDay || logDate.getDate(),
    log.person || "",
    log.type || "",
    log.detail || "",
    log.delta || 0,
    createdAt
  ].join("-");
  return {
    ...log,
    id: log.id || stableId,
    date: log.date || dateKey,
    earnedDay: log.earnedDay || logDate.getDate(),
    createdAt
  };
}

function normalizeLogs(logs = {}) {
  return Object.keys(logs).reduce((nextLogs, day) => {
    nextLogs[day] = (logs[day] || []).map((log) => normalizeLog(log, day));
    return nextLogs;
  }, {});
}

function normalizeSportsLog(log, fallbackDay) {
  const logDate = parseLogDate(log, fallbackDay);
  const dateKey = formatDateKey(logDate);
  const createdAt = log.createdAt || `${dateKey}T00:00:00.000Z`;
  const stableId = [
    "sport",
    dateKey,
    fallbackDay || logDate.getDate(),
    log.person || "",
    log.type || "",
    log.duration || 0,
    log.steps || 0,
    createdAt
  ].join("-");
  return {
    ...log,
    id: log.id || stableId,
    date: log.date || dateKey,
    earnedDay: log.earnedDay || logDate.getDate(),
    duration: Number(log.duration || 0),
    steps: Number(log.steps || 0),
    score: Number(log.score || 0),
    createdAt
  };
}

function normalizeSportsLogs(logs = {}) {
  return Object.keys(logs).reduce((nextLogs, day) => {
    nextLogs[day] = (logs[day] || []).map((log) => normalizeSportsLog(log, day));
    return nextLogs;
  }, {});
}

function normalizeWechatSteps(steps = {}) {
  return Object.keys(steps || {}).reduce((result, day) => {
    result[day] = (steps[day] || []).map((item) => ({
      ...item,
      id: item.id || `steps-${item.date || day}-${item.person || ""}`,
      steps: Number(item.steps || 0),
      date: item.date || item.day || formatDateKey(),
      createdAt: item.createdAt || new Date().toISOString()
    }));
    return result;
  }, {});
}

function ruleAmount(rule) {
  const match = String(rule?.value || "").match(/[-+]?\d+/);
  return match ? Number(match[0]) : 0;
}

function chanceLabel(creditType) {
  return creditType === "exchange" ? "申请兑换" : "申请重抽";
}

function ruleValue(amount, creditType) {
  return `${amount > 0 ? "+" : ""}${amount} ${chanceLabel(creditType)}`;
}

function normalizeRules(rules = DEFAULT_STATE.rules) {
  const nextRules = {
    ...DEFAULT_STATE.rules,
    ...(rules || {})
  };
  return {
    ...nextRules,
    base: (nextRules.base || []).map((rule) => ({ ...rule, value: ruleValue(1, "redraw") })),
    bonus: (nextRules.bonus || []).filter((rule) => rule.label !== "运动").map((rule) => ({ ...rule, value: ruleValue(1, "exchange") })),
    penalty: (nextRules.penalty || []).map((rule) => ({ ...rule, value: ruleValue(-1, "redraw") }))
  };
}

function creditTypeForLog(log) {
  if (log?.creditType) return log.creditType;
  if (log?.type === "增值家务" || log?.type === "兑换小熊") return "exchange";
  if (["家务", "基础家务", "扣分", "重新抽签", "重抽"].includes(log?.type)) return "redraw";
  return null;
}

function calculateChances(people, logs) {
  const totals = people.reduce((result, person) => {
    result[person.name] = { redraw: 0, exchange: 0 };
    return result;
  }, {});

  Object.keys(logs || {}).forEach((day) => {
    (logs[day] || []).forEach((log) => {
      if (!Object.prototype.hasOwnProperty.call(totals, log.person)) return;
      const creditType = creditTypeForLog(log);
      if (!creditType) return;
      totals[log.person][creditType] += Number(log.delta || 0);
    });
  });

  return people.map((person) => ({
    ...person,
    coins: 0,
    redrawChances: Math.max(0, totals[person.name]?.redraw || 0),
    exchangeChances: Math.max(0, totals[person.name]?.exchange || 0)
  }));
}

const STATE_CACHE_KEY = "xiaoxiongStateCache";

function ensureCloudAvailable() {
  if (!wx.cloud) {
    throw new Error("当前基础库不支持云开发");
  }
}

async function callStateFunction(action, payload) {
  ensureCloudAvailable();
  const result = await wx.cloud.callFunction({
    name: "state",
    data: {
      action,
      payload
    }
  });

  if (!result?.result?.ok) {
    throw new Error(result?.result?.message || result?.errMsg || "小熊云函数返回异常");
  }

  return result.result;
}

function readCachedState() {
  try {
    return wx.getStorageSync(STATE_CACHE_KEY) || null;
  } catch (error) {
    console.warn("[小熊本地缓存读取失败]", error);
    return null;
  }
}

function cacheState(state) {
  try {
    wx.setStorageSync(STATE_CACHE_KEY, state);
  } catch (error) {
    console.warn("[小熊本地缓存保存失败]", error);
  }
}

function cleanForCloud(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanForCloud(item)).filter((item) => item !== undefined);
  }
  if (value && typeof value === "object") {
    return Object.keys(value).reduce((result, key) => {
      const cleanedValue = cleanForCloud(value[key]);
      if (cleanedValue !== undefined) result[key] = cleanedValue;
      return result;
    }, {});
  }
  if (typeof value === "undefined" || typeof value === "function") return undefined;
  return value;
}

function normalizeAssetPath(path) {
  if (!path || path.startsWith("http") || path.startsWith("data:")) return path;
  if (path.startsWith("../../")) return path;
  return path.replace(/^\/?assets\//, "../../assets/");
}

function sanitizeBears(bears = DEFAULT_STATE.bears) {
  const filtered = (bears || []).filter((bear) => bear?.name && !REMOVED_BEAR_NAMES.includes(bear.name));
  return filtered.length ? filtered : DEFAULT_STATE.bears.filter((bear) => !REMOVED_BEAR_NAMES.includes(bear.name));
}

function sanitizeAssignments(assignments = {}, bears = []) {
  const validNames = new Set((bears || []).map((bear) => bear.name));
  return Object.keys(assignments || {}).reduce((result, personName) => {
    result[personName] = (assignments[personName] || []).filter((bearName) => validNames.has(bearName));
    return result;
  }, {});
}

function sanitizeDraw(draw, bears = []) {
  if (!draw?.assignments) return draw || null;
  return {
    ...draw,
    assignments: sanitizeAssignments(draw.assignments, bears)
  };
}

function normalizeDrawHistory(history = {}, bears = []) {
  return Object.keys(history || {}).reduce((result, dateKey) => {
    const draw = sanitizeDraw(history[dateKey], bears);
    if (draw?.assignments) result[dateKey] = draw;
    return result;
  }, {});
}

function normalizeState(state = DEFAULT_STATE) {
  const todayId = formatDateKey();
  const remotePeople = Array.isArray(state.people) && state.people.length ? state.people : [];
  const remotePeopleByName = remotePeople.reduce((result, person) => {
    if (ALLOWED_PERSON_NAMES.includes(person.name)) result[person.name] = person;
    return result;
  }, {});
  const remoteBears = sanitizeBears(Array.isArray(state.bears) && state.bears.length ? state.bears : DEFAULT_STATE.bears);
  const isTodayState = !state.todayId || state.todayId === todayId;
  const mergedBears = [
    ...remoteBears,
    ...DEFAULT_STATE.bears.filter(
      (defaultBear) => !REMOVED_BEAR_NAMES.includes(defaultBear.name) && !remoteBears.some((bear) => bear.name === defaultBear.name)
    )
  ];
  const bears = sanitizeBears(mergedBears).map((bear) => ({
    ...bear,
    image: normalizeAssetPath(bear.image || BEAR_IMAGE_BY_NAME[bear.name]),
    active: bear.active !== false
  }));
  const fallbackBear = bears[0]?.name || "史迪奇";

  const logs = normalizeLogs(state.logs || {});
  const sportsLogs = normalizeSportsLogs(state.sportsLogs || {});
  const wechatSteps = normalizeWechatSteps(state.wechatSteps || {});
  const people = DEFAULT_STATE.people.map((defaultPerson) => {
    const person = {
      ...defaultPerson,
      ...(remotePeopleByName[defaultPerson.name] || {})
    };
    return {
      ...person,
      displayName: person.displayName || person.name,
      wechatId: person.wechatId || DEFAULT_STATE.people.find((item) => item.name === person.name)?.wechatId || "",
      openid: person.openid || "",
      wishBear: REMOVED_BEAR_NAMES.includes(person.wishBear) || !bears.some((bear) => bear.name === person.wishBear) ? fallbackBear : person.wishBear,
      image: normalizeAssetPath(person.image || PERSON_IMAGE_BY_NAME[person.name])
    };
  });
  const rules = normalizeRules(state.rules || DEFAULT_STATE.rules);
  const draw = isTodayState ? sanitizeDraw(state.draw, bears) : null;
  const drawHistory = normalizeDrawHistory(state.drawHistory || {}, bears);
  if (draw?.assignments && !drawHistory[todayId]) drawHistory[todayId] = draw;

  return {
    ...DEFAULT_STATE,
    ...state,
    todayId,
    draw,
    drawUsed: isTodayState ? Boolean(state.drawUsed && draw) : false,
    pendingRedraw: null,
    pendingExchange: null,
    pendingAuction: null,
    people: calculateChances(people, logs),
    bears,
    actions: state.actions || [],
    logs,
    drawHistory,
    sportsLogs,
    wechatSteps,
    sportRules: Array.isArray(state.sportRules) && state.sportRules.length ? state.sportRules : DEFAULT_STATE.sportRules,
    rules
  };
}

function activeBears(state) {
  return (state.bears || []).filter((bear) => bear.active !== false).slice(0, 6);
}

function shuffledPeople(people) {
  return [...people].sort(() => Math.random() - 0.5);
}

function takeBear(remainingBears, bearName) {
  const index = remainingBears.indexOf(bearName);
  if (index < 0) return null;
  const [picked] = remainingBears.splice(index, 1);
  return picked;
}

function takeRandomBear(remainingBears) {
  if (!remainingBears.length) return null;
  const index = Math.floor(Math.random() * remainingBears.length);
  const [picked] = remainingBears.splice(index, 1);
  return picked;
}

function drawBears(state) {
  const seed = `wx-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const remainingBears = activeBears(state).map((bear) => bear.name);
  const people = shuffledPeople(state.people || DEFAULT_STATE.people);
  const baseQuota = Math.floor(remainingBears.length / people.length);
  const extraQuota = remainingBears.length % people.length;
  const assignments = people.reduce((result, person) => {
    result[person.name] = [];
    return result;
  }, {});
  const quotaByPerson = people.reduce((result, person, personIndex) => {
    result[person.name] = baseQuota + (personIndex < extraQuota ? 1 : 0);
    return result;
  }, {});
  const shanshanyu = (state.people || DEFAULT_STATE.people).find((person) => person.name === "闪闪鱼");

  if (
    shanshanyu &&
    quotaByPerson[shanshanyu.name] > 0 &&
    remainingBears.includes(shanshanyu.wishBear) &&
    Math.random() < SHANSHANYU_WISH_HIT_RATE
  ) {
    assignments[shanshanyu.name].push(takeBear(remainingBears, shanshanyu.wishBear));
  }

  people.forEach((person, personIndex) => {
    const quota = quotaByPerson[person.name];
    for (let count = 0; count < quota && remainingBears.length; count += 1) {
      if ((assignments[person.name] || []).length >= quota) break;
      const selectedBear = takeRandomBear(remainingBears);
      if (!selectedBear) break;
      assignments[person.name].push(selectedBear);
    }
  });

  return {
    seed,
    shanshanyuWishHitRate: SHANSHANYU_WISH_HIT_RATE,
    rule: "shanshanyu-wish-70",
    assignments
  };
}

function addAction(state, person, action, detail = "", id = "") {
  const actions = state.actions || [];
  const now = new Date();
  return [
    {
      id: id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      date: formatDateKey(now),
      time: now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      person: person || "未登录",
      action,
      detail: detail || ""
    },
    ...actions
  ].slice(0, 80);
}

async function loadState() {
  try {
    const result = await callStateFunction("get");
    const payload = result.payload;
    if (!payload) {
      const initialState = normalizeState(readCachedState() || DEFAULT_STATE);
      await saveState(initialState);
      return initialState;
    }
    const state = normalizeState(payload);
    cacheState(state);
    return state;
  } catch (error) {
    if (String(error?.errMsg || "").includes("does not exist")) {
      await saveState(DEFAULT_STATE);
      return normalizeState(DEFAULT_STATE);
    }
    const cachedState = readCachedState();
    if (cachedState) {
      console.warn("[小熊云数据库读取失败，已使用本地缓存]", error);
      return normalizeState(cachedState);
    }
    console.warn("[小熊云数据库读取失败]", error);
    throw error;
  }
}

async function saveState(state, mergeOptions = {}) {
  const safeState = normalizeState(state);
  const payload = cleanForCloud({
    ...safeState,
    savedAt: new Date().toISOString(),
    source: "wechat-cloud-function"
  });

  try {
    await callStateFunction("save", {
      state: payload,
      mergeOptions
    });
    cacheState(payload);
  } catch (error) {
    console.warn("[小熊云函数保存失败]", error);
    throw error;
  }
}

module.exports = {
  DEFAULT_STATE,
  addAction,
  drawBears,
  formatDateKey,
  loadState,
  normalizeState,
  normalizeLog,
  normalizeSportsLog,
  saveState
};
