const DEFAULT_STATE = {
  people: [
    { name: "闪闪鱼", coins: 0, wishBear: "史迪奇", image: "../../assets/shanshanyu.png" },
    { name: "杰尼龟", coins: 0, wishBear: "卢卡斯", image: "../../assets/jienigui.png" }
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
  todayId: "",
  actions: [],
  logs: {},
  rules: {
    base: [
      { label: "做饭", value: "+1 金币" },
      { label: "洗衣服", value: "+1 金币" },
      { label: "倒垃圾", value: "+1 金币" }
    ],
    bonus: [
      { label: "帮对方设计封面图", value: "+3 金币" },
      { label: "帮对方提供工作建议", value: "+2 金币" },
      { label: "运动", value: "+1 金币" }
    ],
    penalty: [
      { label: "未完成基础家务", value: "-1 金币" }
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

const PERSON_IMAGE_BY_NAME = {
  闪闪鱼: "../../assets/shanshanyu.png",
  杰尼龟: "../../assets/jienigui.png"
};

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
  return {
    ...log,
    date: log.date || dateKey,
    earnedDay: log.earnedDay || logDate.getDate(),
    createdAt: log.createdAt || new Date().toISOString()
  };
}

function normalizeLogs(logs = {}) {
  return Object.keys(logs).reduce((nextLogs, day) => {
    nextLogs[day] = (logs[day] || []).map((log) => normalizeLog(log, day));
    return nextLogs;
  }, {});
}

function calculateCoins(people, logs) {
  const today = new Date();
  const totals = people.reduce((result, person) => {
    result[person.name] = 0;
    return result;
  }, {});

  Object.keys(logs || {}).forEach((day) => {
    (logs[day] || []).forEach((log) => {
      const logDate = parseLogDate(log, day);
      if (!isLogActive(logDate, today)) return;
      if (!Object.prototype.hasOwnProperty.call(totals, log.person)) return;
      totals[log.person] += Number(log.delta || 0);
    });
  });

  return people.map((person) => ({
    ...person,
    coins: totals[person.name] || 0
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

function normalizeState(state = DEFAULT_STATE) {
  const todayId = formatDateKey();
  const remotePeople = Array.isArray(state.people) && state.people.length ? state.people : DEFAULT_STATE.people;
  const remoteBears = Array.isArray(state.bears) && state.bears.length ? state.bears : DEFAULT_STATE.bears;
  const isTodayState = !state.todayId || state.todayId === todayId;
  const mergedBears = [
    ...remoteBears,
    ...DEFAULT_STATE.bears.filter(
      (defaultBear) => !remoteBears.some((bear) => bear.name === defaultBear.name)
    )
  ];

  const logs = normalizeLogs(state.logs || {});
  const people = remotePeople.map((person) => ({
    ...person,
    image: normalizeAssetPath(person.image || PERSON_IMAGE_BY_NAME[person.name])
  }));

  return {
    ...DEFAULT_STATE,
    ...state,
    todayId,
    draw: isTodayState ? state.draw || null : null,
    drawUsed: isTodayState ? Boolean(state.drawUsed && state.draw) : false,
    pendingRedraw: isTodayState ? state.pendingRedraw || null : null,
    pendingExchange: isTodayState ? state.pendingExchange || null : null,
    people: calculateCoins(people, logs),
    bears: mergedBears.map((bear) => ({
      ...bear,
      image: normalizeAssetPath(bear.image || BEAR_IMAGE_BY_NAME[bear.name]),
      active: bear.active !== false
    })),
    actions: state.actions || [],
    logs,
    rules: {
      ...DEFAULT_STATE.rules,
      ...(state.rules || {})
    }
  };
}

function activeBears(state) {
  return (state.bears || []).filter((bear) => bear.active !== false).slice(0, 6);
}

function randomIndexByWeight(items, weightForItem) {
  const weights = items.map((item) => Math.max(0, Number(weightForItem(item)) || 0));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = Math.random() * totalWeight;

  for (let index = 0; index < items.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return index;
  }

  return items.length - 1;
}

function shuffledPeople(people) {
  return [...people].sort(() => Math.random() - 0.5);
}

function drawBears(state) {
  const seed = `wx-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const wishBoost = 1.12;
  const remainingBears = activeBears(state).map((bear) => bear.name);
  const people = shuffledPeople(state.people || DEFAULT_STATE.people);
  const baseQuota = Math.floor(remainingBears.length / people.length);
  const extraQuota = remainingBears.length % people.length;
  const assignments = people.reduce((result, person) => {
    result[person.name] = [];
    return result;
  }, {});

  people.forEach((person, personIndex) => {
    const quota = baseQuota + (personIndex < extraQuota ? 1 : 0);
    for (let count = 0; count < quota && remainingBears.length; count += 1) {
      const selectedIndex = randomIndexByWeight(remainingBears, (bearName) =>
        bearName === person.wishBear ? wishBoost : 1
      );
      const [selectedBear] = remainingBears.splice(selectedIndex, 1);
      assignments[person.name].push(selectedBear);
    }
  });

  return {
    seed,
    wishBoost,
    rule: "weighted-random",
    assignments
  };
}

function addAction(state, person, action, detail = "") {
  const actions = state.actions || [];
  return [
    {
      id: `${Date.now()}`,
      date: formatDateKey(),
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
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

async function saveState(state) {
  const safeState = normalizeState(state);
  const payload = cleanForCloud({
    ...safeState,
    savedAt: new Date().toISOString(),
    source: "wechat-cloud-function"
  });

  try {
    await callStateFunction("save", payload);
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
  saveState
};
