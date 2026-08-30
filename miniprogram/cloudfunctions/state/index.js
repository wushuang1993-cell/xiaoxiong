const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const STATE_COLLECTION = "app_states";
const STATE_DOC_ID = "main";
const REMOVED_BEAR_NAMES = [];
const ALLOWED_PERSON_META = {
  闪闪鱼: { wechatId: "shuang_wu83", openid: "oARbkxZvJaqo4ZvUb7cYzebpxi2k" },
  杰尼龟: { wechatId: "Alan0Xu", openid: "oARbkxXMLbBTgt1PtABedW2BhwFk" }
};
const ALLOWED_PERSON_NAMES = Object.keys(ALLOWED_PERSON_META);
const DEFAULT_SPORT_RULES = [
  { key: "walk", label: "散步", rate: 1 },
  { key: "run", label: "跑步", rate: 1 },
  { key: "badminton", label: "羽毛球", rate: 1 },
  { key: "tennis", label: "网球", rate: 1 },
  { key: "strength", label: "力量", rate: 1 },
  { key: "ride", label: "骑行", rate: 1 }
];

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function preferLatestItem(currentItem, nextItem) {
  const currentTime = new Date(currentItem?.createdAt || 0).getTime();
  const nextTime = new Date(nextItem?.createdAt || 0).getTime();
  return nextTime >= currentTime ? nextItem : currentItem;
}

function mergeItems(remoteItems = [], localItems = [], keyForItem, mergeItem = (remoteItem, localItem) => ({ ...remoteItem, ...localItem })) {
  const map = new Map();
  remoteItems.forEach((item) => {
    const key = keyForItem(item);
    if (key) map.set(key, clone(item));
  });
  localItems.forEach((item) => {
    const key = keyForItem(item);
    if (!key) return;
    map.set(key, map.has(key) ? mergeItem(map.get(key), item) : clone(item));
  });
  return Array.from(map.values());
}

function logKey(log, fallbackDay) {
  if (log.date && log.person && log.type) {
    return [
      log.date,
      log.person,
      log.type,
      log.detail || "",
      log.delta || 0,
      log.creditType || "",
      fallbackDay || ""
    ].join("|");
  }
  return log.id || [
    log.person || "",
    log.type || "",
    log.detail || "",
    log.delta || 0,
    log.date || "",
    log.createdAt || "",
    fallbackDay || ""
  ].join("|");
}

function withLogSource(log) {
  return {
    ...log,
    sourceType: log.sourceType || (log.type === "运动" && log.detail === "步数胜者" ? "system" : "manual")
  };
}

function mergeLogs(localLogs = {}, remoteLogs = {}) {
  const days = new Set([...Object.keys(remoteLogs || {}), ...Object.keys(localLogs || {})]);
  const merged = {};
  days.forEach((day) => {
    merged[day] = mergeItems(
      (remoteLogs[day] || []).map(withLogSource),
      (localLogs[day] || []).map(withLogSource),
      (log) => logKey(log, day),
      preferLatestItem
    );
  });
  return merged;
}

function actionKey(action) {
  if (action.action === "今日已抽签") {
    return `draw:${action.date || ""}:${action.person || ""}`;
  }
  if (action.action === "更新步数") {
    return `steps:${action.date || action.day || ""}:${action.person || ""}`;
  }
  if (action.action === "步数胜者") {
    return `steps-winner:${action.date || action.day || ""}:${action.person || ""}`;
  }
  if (["记录家务", "记录运动"].includes(action.action)) {
    return `${action.action}:${action.date || action.day || ""}:${action.person || ""}:${action.detail || ""}`;
  }
  return action.id || `${action.date || action.day}-${action.time}-${action.person}-${action.action}-${action.detail}`;
}

function mergeActions(localActions = [], remoteActions = []) {
  const map = new Map();
  const order = [];
  [...(localActions || []), ...(remoteActions || [])].map((action) => ({
    ...action,
    sourceType: action.sourceType || (action.action === "步数胜者" ? "system" : "manual")
  })).forEach((action) => {
    const key = actionKey(action);
    if (!key || map.has(key)) return;
    map.set(key, clone(action));
    order.push(key);
  });
  return order.map((key) => map.get(key)).slice(0, 80);
}

function sanitizeBears(bears = []) {
  return (bears || []).filter((bear) => bear?.name && !REMOVED_BEAR_NAMES.includes(bear.name));
}

function sanitizePeople(people = []) {
  return (people || [])
    .filter((person) => ALLOWED_PERSON_NAMES.includes(person.name))
    .map((person) => ({
      ...person,
      wechatId: person.wechatId || ALLOWED_PERSON_META[person.name]?.wechatId || "",
      openid: person.openid || ALLOWED_PERSON_META[person.name]?.openid || ""
    }));
}

function findAuthorizedPerson(payload, wxContext) {
  const openid = wxContext.OPENID || "";
  const unionid = wxContext.UNIONID || "";
  const configuredPeople = ALLOWED_PERSON_NAMES.map((name) => {
    const savedPerson = sanitizePeople(payload?.people || []).find((person) => person.name === name) || {};
    return {
      name,
      displayName: name,
      ...ALLOWED_PERSON_META[name],
      ...savedPerson
    };
  });
  return configuredPeople.find((person) => {
    if (person.openid && person.openid === openid) return true;
    if (person.unionid && unionid && person.unionid === unionid) return true;
    return false;
  });
}

function mergeDrawHistory(localHistory = {}, remoteHistory = {}) {
  return { ...(remoteHistory || {}), ...(localHistory || {}) };
}

function mergeSportsLogs(localLogs = {}, remoteLogs = {}) {
  const days = new Set([...Object.keys(remoteLogs || {}), ...Object.keys(localLogs || {})]);
  const merged = {};
  days.forEach((day) => {
    merged[day] = mergeItems(
      (remoteLogs[day] || []).map((log) => ({ ...log, sourceType: log.sourceType || "manual" })),
      (localLogs[day] || []).map((log) => ({ ...log, sourceType: log.sourceType || "manual" })),
      (log) => {
        if (log.date && log.person && log.type) {
          return [log.date, log.person, log.type, log.detail || "", day || ""].join("|");
        }
        return log.id || [log.person || "", log.type || "", log.createdAt || "", day || ""].join("|");
      },
      preferLatestItem
    );
  });
  return merged;
}

function mergeWechatSteps(localSteps = {}, remoteSteps = {}) {
  const days = new Set([...Object.keys(remoteSteps || {}), ...Object.keys(localSteps || {})]);
  const merged = {};
  days.forEach((day) => {
    merged[day] = mergeItems(
      (remoteSteps[day] || []).map((item) => ({ ...item, sourceType: item.sourceType || "manual" })),
      (localSteps[day] || []).map((item) => ({ ...item, sourceType: item.sourceType || "manual" })),
      (item) => `${item.date || day}|${item.person || item.openid || item.id}`,
      (remoteItem, localItem) => ({ ...remoteItem, ...localItem, steps: Number(localItem.steps || remoteItem.steps || 0) })
    );
  });
  return merged;
}

function mergeRules(localRules = {}, remoteRules = {}, options = {}) {
  const groups = new Set([...Object.keys(remoteRules || {}), ...Object.keys(localRules || {})]);
  const deleted = options.deletedRules || [];
  return Array.from(groups).reduce((result, group) => {
    const remoteItems = (remoteRules[group] || []).filter(
      (rule) => !deleted.some((item) => item.group === group && item.label === rule.label)
    );
    result[group] = mergeItems(remoteItems, localRules[group] || [], (rule) => rule.label);
    return result;
  }, {});
}

function mergeSportRules() {
  return DEFAULT_SPORT_RULES.map((rule) => ({ ...rule }));
}

function mergeBears(localBears = [], remoteBears = [], options = {}) {
  const deletedNames = new Set(options.deletedBears || []);
  return mergeItems(
    sanitizeBears(remoteBears).filter((bear) => !deletedNames.has(bear.name)),
    sanitizeBears(localBears),
    (bear) => bear.name
  ).map((bear) => ({ ...bear, active: bear.active !== false }));
}

function mergeState(localPayload, remotePayload, options = {}) {
  if (!remotePayload) return localPayload;
  const sameDay = localPayload.todayId && remotePayload.todayId === localPayload.todayId;
  const drawHistory = mergeDrawHistory(localPayload.drawHistory || {}, remotePayload.drawHistory || {});
  if (remotePayload.draw?.assignments && remotePayload.todayId) drawHistory[remotePayload.todayId] = remotePayload.draw;
  if (localPayload.draw?.assignments && localPayload.todayId) drawHistory[localPayload.todayId] = localPayload.draw;
  return {
    ...remotePayload,
    ...localPayload,
    draw: localPayload.draw || (sameDay ? remotePayload.draw : null) || null,
    drawUsed: Boolean((localPayload.draw || (sameDay ? remotePayload.draw : null)) && (localPayload.drawUsed || (sameDay && remotePayload.drawUsed))),
    pendingRedraw: null,
    pendingExchange: null,
    pendingAuction: null,
    people: sanitizePeople(mergeItems(remotePayload.people || [], localPayload.people || [], (person) => person.name)),
    bears: mergeBears(localPayload.bears || [], remotePayload.bears || [], options),
    rules: mergeRules(localPayload.rules || {}, remotePayload.rules || {}, options),
    sportRules: mergeSportRules(localPayload.sportRules || [], remotePayload.sportRules || [], options),
    logs: mergeLogs(localPayload.logs || {}, remotePayload.logs || {}),
    drawHistory,
    sportsLogs: mergeSportsLogs(localPayload.sportsLogs || {}, remotePayload.sportsLogs || {}),
    wechatSteps: mergeWechatSteps(localPayload.wechatSteps || {}, remotePayload.wechatSteps || {}),
    actions: mergeActions(localPayload.actions || [], remotePayload.actions || []),
    savedAt: localPayload.savedAt
  };
}

async function getState() {
  try {
    const result = await db.collection(STATE_COLLECTION).doc(STATE_DOC_ID).get();
    let payload = result.data && result.data.payload ? result.data.payload : null;
    if (result.data && result.data.payloadJson) {
      try {
        payload = JSON.parse(result.data.payloadJson);
      } catch (error) {
        payload = result.data.payload || null;
      }
    }
    return {
      ok: true,
      payload,
      updatedAt: result.data && result.data.updatedAt ? result.data.updatedAt : null
    };
  } catch (error) {
    if (String(error?.errMsg || "").includes("does not exist")) {
      return {
        ok: true,
        payload: null,
        updatedAt: null
      };
    }
    throw error;
  }
}

async function saveState(payload, mergeOptions = {}) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Missing state payload");
  }

  const wxContext = cloud.getWXContext();
  const current = await getState();
  const safeIncoming = cleanForCloud(payload);
  const safePayload = cleanForCloud(mergeState(safeIncoming, current.payload, mergeOptions));
  const data = {
    payloadJson: JSON.stringify(safePayload),
    payloadSummary: {
      todayId: safePayload.todayId || "",
      drawUsed: Boolean(safePayload.drawUsed),
      hasAuction: Boolean(safePayload.pendingAuction),
      peopleCount: Array.isArray(safePayload.people) ? safePayload.people.length : 0,
      bearCount: Array.isArray(safePayload.bears) ? safePayload.bears.length : 0,
      sportsDayCount: safePayload.sportsLogs ? Object.keys(safePayload.sportsLogs).length : 0,
      wechatStepsDayCount: safePayload.wechatSteps ? Object.keys(safePayload.wechatSteps).length : 0,
      actionCount: Array.isArray(safePayload.actions) ? safePayload.actions.length : 0
    },
    updatedAt: db.serverDate(),
    updatedBy: wxContext.OPENID || ""
  };

  try {
    await db.collection(STATE_COLLECTION).doc(STATE_DOC_ID).update({
      data
    });
  } catch (error) {
    if (String(error?.errMsg || "").includes("does not exist")) {
      await db.collection(STATE_COLLECTION).add({
        data: {
          _id: STATE_DOC_ID,
          ...data
        }
      });
    } else {
      throw error;
    }
  }

  return {
    ok: true
  };
}

exports.main = async (event = {}) => {
  try {
    const action = event.action || "get";

    if (action === "get") {
      return getState();
    }

    if (action === "login") {
      const wxContext = cloud.getWXContext();
      const current = await getState();
      const person = findAuthorizedPerson(current.payload, wxContext);
      if (!person) {
        console.warn("[xiaoxiong-login-denied]", {
          openid: wxContext.OPENID || "",
          appid: wxContext.APPID || "",
          unionid: wxContext.UNIONID || ""
        });
        return {
          ok: false,
          message: "联系管理员获得授权",
          openid: wxContext.OPENID || "",
          appid: wxContext.APPID || "",
          unionid: wxContext.UNIONID || ""
        };
      }
      return {
        ok: true,
        userName: person.name,
        displayName: person.displayName || person.name,
        wechatId: person.wechatId || ALLOWED_PERSON_META[person.name]?.wechatId || "",
        openid: wxContext.OPENID || "",
        appid: wxContext.APPID || "",
        unionid: wxContext.UNIONID || ""
      };
    }

    if (action === "save") {
      const incoming = event.payload?.state || event.payload;
      const mergeOptions = event.payload?.mergeOptions || {};
      return saveState(incoming, mergeOptions);
    }

    throw new Error(`Unsupported state action: ${action}`);
  } catch (error) {
    return {
      ok: false,
      message: error.message || error.errMsg || "state cloud function failed"
    };
  }
};
