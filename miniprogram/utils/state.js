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

function request(path, method = "GET", data = undefined) {
  const app = getApp();
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBaseUrl}${path}`,
      method,
      data,
      timeout: 60000,
      header: { "content-type": "application/json" },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error(res.data?.error || `请求失败 ${res.statusCode}`));
        }
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

function normalizeAssetPath(path) {
  if (!path || path.startsWith("http") || path.startsWith("data:")) return path;
  if (path.startsWith("../../")) return path;
  return path.replace(/^\/?assets\//, "../../assets/");
}

function normalizeState(state = DEFAULT_STATE) {
  return {
    ...DEFAULT_STATE,
    ...state,
    people: (state.people || DEFAULT_STATE.people).map((person) => ({
      ...person,
      image: normalizeAssetPath(person.image || PERSON_IMAGE_BY_NAME[person.name])
    })),
    bears: (state.bears || DEFAULT_STATE.bears).map((bear) => ({
      ...bear,
      image: normalizeAssetPath(bear.image || BEAR_IMAGE_BY_NAME[bear.name]),
      active: bear.active !== false
    })),
    actions: state.actions || [],
    logs: state.logs || {},
    rules: {
      ...DEFAULT_STATE.rules,
      ...(state.rules || {})
    }
  };
}

function activeBears(state) {
  return (state.bears || []).filter((bear) => bear.active !== false).slice(0, 6);
}

function drawBears(state) {
  const bears = activeBears(state).map((bear) => bear.name);
  const midpoint = Math.ceil(bears.length / 2);
  return {
    seed: `wx-${Date.now()}`,
    assignments: {
      闪闪鱼: bears.slice(0, midpoint),
      杰尼龟: bears.slice(midpoint)
    }
  };
}

function addAction(state, person, action, detail = "") {
  const actions = state.actions || [];
  return [
    {
      id: `${Date.now()}`,
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      person,
      action,
      detail
    },
    ...actions
  ].slice(0, 80);
}

async function loadState() {
  const data = await request("/api/state");
  return normalizeState(data.payload || DEFAULT_STATE);
}

async function saveState(state) {
  await request("/api/state", "POST", {
    payload: {
      ...state,
      savedAt: new Date().toISOString(),
      source: "wechat-miniprogram"
    }
  });
}

module.exports = {
  DEFAULT_STATE,
  addAction,
  drawBears,
  loadState,
  normalizeState,
  saveState
};
