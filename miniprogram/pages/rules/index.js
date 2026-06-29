const { DEFAULT_STATE, addAction, loadState, normalizeState, saveState } = require("../../utils/state");

const RULE_GROUPS = [
  { key: "base", label: "基础家务", title: "基础家务" },
  { key: "bonus", label: "增值家务", title: "增值家务" },
  { key: "penalty", label: "扣分", title: "扣分" },
  { key: "drink", label: "饮品", title: "饮品" }
];

function amountToValue(amount) {
  const value = Number(amount || 0);
  return `${value > 0 ? "+" : ""}${value} 金币`;
}

function decorateRules(rules = []) {
  return rules.map((rule) => ({
    ...rule,
    amount: Number(String(rule.value).match(/[-+]?\d+/)?.[0] || 0),
    tone: Number(String(rule.value).match(/[-+]?\d+/)?.[0] || 0) >= 0 ? "plus" : "minus"
  }));
}

Page({
  data: {
    state: DEFAULT_STATE,
    currentUser: "闪闪鱼",
    currentEmail: "",
    loginSummary: "闪闪鱼",
    loginEmail: "",
    ruleGroups: RULE_GROUPS,
    editingRuleGroupIndex: 0,
    selectedRuleGroupLabel: RULE_GROUPS[0].label,
    ruleName: "",
    ruleAmount: "",
    ruleSections: [],
    bearName: ""
  },

  onShow() {
    const app = getApp();
    this.setData({
      currentUser: app.globalData.currentUser || "闪闪鱼",
      currentEmail: app.globalData.currentEmail || "",
      loginSummary: app.globalData.currentEmail ? `${app.globalData.currentUser} · ${app.globalData.currentEmail}` : app.globalData.currentUser || "闪闪鱼",
      loginEmail: app.globalData.currentEmail || ""
    });
    this.refresh();
  },

  async refresh() {
    try {
      this.renderState(await loadState());
    } catch (error) {
      this.renderState(DEFAULT_STATE);
      wx.showToast({ title: "读取失败", icon: "none" });
    }
  },

  renderState(state) {
    const safeState = normalizeState(state);
    this.setData({
      state: safeState,
      ruleSections: RULE_GROUPS.map((group) => ({
        ...group,
        rules: decorateRules(safeState.rules[group.key] || [])
      }))
    });
  },

  async persist(nextState, message) {
    try {
      await saveState(normalizeState(nextState));
      this.renderState(nextState);
      wx.showToast({ title: message, icon: "none" });
    } catch (error) {
      wx.showToast({ title: "保存失败", icon: "none" });
    }
  },

  onEmailInput(event) {
    this.setData({ loginEmail: event.detail.value.trim() });
  },

  loginAs(event) {
    const userName = event.currentTarget.dataset.user;
    const email = this.data.loginEmail;
    if (!email || !email.includes("@")) {
      wx.showToast({ title: "请输入邮箱", icon: "none" });
      return;
    }
    const app = getApp();
    app.globalData.currentUser = userName;
    app.globalData.currentEmail = email;
    wx.setStorageSync("bearAppLogin", { userName, email });
    this.setData({ currentUser: userName, currentEmail: email, loginSummary: `${userName} · ${email}` });
    wx.showToast({ title: `已登录${userName}`, icon: "none" });
  },

  resetDefaultRules() {
    wx.showModal({
      title: "自动设置规则",
      content: "恢复默认基础家务、增值家务、扣分和饮品规则？",
      success: (res) => {
        if (!res.confirm) return;
        const currentUser = getApp().globalData.currentUser || "闪闪鱼";
        const nextState = normalizeState(this.data.state);
        nextState.rules = normalizeState(DEFAULT_STATE).rules;
        nextState.actions = addAction(nextState, currentUser, "自动设置规则", "恢复默认金币规则");
        this.persist(nextState, "已恢复默认");
      }
    });
  },

  onRuleGroupChange(event) {
    const index = Number(event.detail.value || 0);
    this.setData({ editingRuleGroupIndex: index, selectedRuleGroupLabel: RULE_GROUPS[index].label });
  },

  onRuleNameInput(event) {
    this.setData({ ruleName: event.detail.value });
  },

  onRuleAmountInput(event) {
    this.setData({ ruleAmount: event.detail.value });
  },

  addRule() {
    const name = this.data.ruleName.trim();
    const amount = Number(this.data.ruleAmount);
    if (!name || Number.isNaN(amount)) {
      wx.showToast({ title: "填写名称和金币", icon: "none" });
      return;
    }
    const groupKey = RULE_GROUPS[this.data.editingRuleGroupIndex].key;
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    const nextState = normalizeState(this.data.state);
    nextState.rules[groupKey] = nextState.rules[groupKey] || [];
    const exists = nextState.rules[groupKey].some((rule) => rule.label === name);
    if (exists) {
      wx.showToast({ title: "规则已存在", icon: "none" });
      return;
    }
    nextState.rules[groupKey].push({ label: name, value: amountToValue(amount) });
    nextState.actions = addAction(nextState, currentUser, "新增金币规则", name);
    this.setData({ ruleName: "", ruleAmount: "" });
    this.persist(nextState, "已新增规则");
  },

  deleteRule(event) {
    const { group, label } = event.currentTarget.dataset;
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    const nextState = normalizeState(this.data.state);
    nextState.rules[group] = (nextState.rules[group] || []).filter((rule) => rule.label !== label);
    nextState.actions = addAction(nextState, currentUser, "删除金币规则", label);
    this.persist(nextState, "已删除");
  },

  onBearNameInput(event) {
    this.setData({ bearName: event.detail.value });
  },

  addBear() {
    const name = this.data.bearName.trim();
    if (!name) {
      wx.showToast({ title: "填写小熊名称", icon: "none" });
      return;
    }
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    const nextState = normalizeState(this.data.state);
    if (nextState.bears.some((bear) => bear.name === name)) {
      wx.showToast({ title: "小熊已存在", icon: "none" });
      return;
    }
    nextState.bears.push({ name, image: "../../assets/tractor.png", active: false });
    nextState.actions = addAction(nextState, currentUser, "新增小熊", name);
    this.setData({ bearName: "" });
    this.persist(nextState, "已新增小熊");
  },

  toggleBear(event) {
    const name = event.currentTarget.dataset.name;
    const enabled = event.detail.value;
    const nextState = normalizeState(this.data.state);
    const activeCount = nextState.bears.filter((bear) => bear.active !== false).length;
    if (enabled && activeCount >= 6) {
      wx.showToast({ title: "最多开启 6 只", icon: "none" });
      this.renderState(nextState);
      return;
    }
    if (!enabled && activeCount <= 1) {
      wx.showToast({ title: "至少保留 1 只", icon: "none" });
      this.renderState(nextState);
      return;
    }
    const bear = nextState.bears.find((item) => item.name === name);
    if (bear) bear.active = enabled;
    nextState.actions = addAction(nextState, getApp().globalData.currentUser || "闪闪鱼", enabled ? "开启小熊" : "关闭小熊", name);
    this.persist(nextState, "已更新");
  }
});
