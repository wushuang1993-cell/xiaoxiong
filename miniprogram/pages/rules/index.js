const { DEFAULT_STATE, addAction, loadState, normalizeState, saveState } = require("../../utils/state");

const RULE_GROUPS = [
  { key: "base", label: "基础家务", title: "基础家务" },
  { key: "bonus", label: "增值家务", title: "增值家务" },
  { key: "penalty", label: "扣分", title: "扣分" },
  { key: "drink", label: "饮品", title: "饮品" }
];

const EMAIL_LOGIN_MAP = {
  "shuang@xyyws.cn": "闪闪鱼",
  "alan@xyyws.cn": "杰尼龟"
};

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
    isLoggedIn: false,
    loginSummary: "闪闪鱼",
    loginAvatar: "../../assets/shanshanyu.png",
    loginEmailText: "",
    loginEmail: "",
    ruleGroups: RULE_GROUPS,
    editingRuleGroupIndex: 0,
    selectedRuleGroupLabel: RULE_GROUPS[0].label,
    ruleName: "",
    ruleAmount: "",
    ruleSections: [],
    rulesEditing: false,
    bearName: "",
    newBearImage: "",
    bearsEditing: false
  },

  onShow() {
    const app = getApp();
    const currentUser = app.globalData.currentUser || "闪闪鱼";
    const currentEmail = app.globalData.currentEmail || "";
    this.setData({
      currentUser,
      currentEmail,
      isLoggedIn: Boolean(currentEmail),
      loginSummary: currentEmail ? `${currentUser}已登录` : "输入固定邮箱登录",
      loginAvatar: this.avatarForUser(currentUser),
      loginEmailText: currentEmail,
      loginEmail: currentEmail
    });
    this.refresh();
  },

  avatarForUser(userName) {
    const person = this.data.state.people.find((item) => item.name === userName);
    return person?.image || (userName === "杰尼龟" ? "../../assets/jienigui.png" : "../../assets/shanshanyu.png");
  },

  async refresh() {
    try {
      this.renderState(await loadState());
    } catch (error) {
      console.warn("[小熊读取失败]", error);
      wx.showToast({ title: "读取失败", icon: "none" });
    }
  },

  renderState(state) {
    const safeState = normalizeState(state);
    const loginPerson = safeState.people.find((person) => person.name === this.data.currentUser);
    this.setData({
      state: safeState,
      loginAvatar: this.data.isLoggedIn ? loginPerson?.image || this.avatarForUser(this.data.currentUser) : this.data.loginAvatar,
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
      this.syncLoginAvatar(nextState);
      wx.showToast({ title: message, icon: "none" });
    } catch (error) {
      console.warn("[小熊保存失败]", error);
      wx.showToast({ title: "保存失败", icon: "none" });
    }
  },

  syncLoginAvatar(state = this.data.state) {
    if (!this.data.isLoggedIn) return;
    const person = normalizeState(state).people.find((item) => item.name === this.data.currentUser);
    this.setData({ loginAvatar: person?.image || this.avatarForUser(this.data.currentUser) });
  },

  chooseImagePath() {
    return new Promise((resolve, reject) => {
      wx.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        sourceType: ["album", "camera"],
        success: (result) => resolve(result.tempFilePaths?.[0]),
        fail: reject
      });
    });
  },

  uploadAvatarImage(tempFilePath, folder) {
    if (!tempFilePath) return Promise.reject(new Error("未选择图片"));
    if (!wx.cloud?.uploadFile) return Promise.resolve(tempFilePath);
    const extension = String(tempFilePath).match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1] || "png";
    const cloudPath = `avatars/${folder}/${Date.now()}-${Math.floor(Math.random() * 100000)}.${extension}`;
    return wx.cloud.uploadFile({ cloudPath, filePath: tempFilePath }).then((result) => result.fileID || tempFilePath);
  },

  async pickAndUploadAvatar(folder) {
    const tempFilePath = await this.chooseImagePath();
    wx.showLoading({ title: "上传中" });
    try {
      return await this.uploadAvatarImage(tempFilePath, folder);
    } finally {
      wx.hideLoading();
    }
  },

  async changeCurrentUserAvatar() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }
    try {
      const currentUser = this.data.currentUser;
      const image = await this.pickAndUploadAvatar(`people-${Date.now()}`);
      const nextState = normalizeState(this.data.state);
      const person = nextState.people.find((item) => item.name === currentUser);
      if (!person) {
        wx.showToast({ title: "没有找到身份", icon: "none" });
        return;
      }
      person.image = image;
      nextState.actions = addAction(nextState, currentUser, "修改头像", currentUser);
      this.persist(nextState, "头像已更新");
    } catch (error) {
      if (!String(error?.errMsg || "").includes("cancel")) {
        console.warn("[头像更新失败]", error);
        wx.showToast({ title: "头像更新失败", icon: "none" });
      }
    }
  },

  async changeBearAvatar(event) {
    if (!this.data.bearsEditing) return;
    const name = event.currentTarget.dataset.name;
    if (!name) return;
    try {
      const image = await this.pickAndUploadAvatar(`bears-${Date.now()}`);
      const nextState = normalizeState(this.data.state);
      const bear = nextState.bears.find((item) => item.name === name);
      if (!bear) {
        wx.showToast({ title: "没有找到小熊", icon: "none" });
        return;
      }
      bear.image = image;
      nextState.actions = addAction(nextState, getApp().globalData.currentUser || "未登录", "修改小熊头像", name);
      this.persist(nextState, "小熊头像已更新");
    } catch (error) {
      if (!String(error?.errMsg || "").includes("cancel")) {
        console.warn("[小熊头像更新失败]", error);
        wx.showToast({ title: "头像更新失败", icon: "none" });
      }
    }
  },

  async changeNewBearAvatar() {
    try {
      const image = await this.pickAndUploadAvatar(`bears-new-${Date.now()}`);
      this.setData({ newBearImage: image });
    } catch (error) {
      if (!String(error?.errMsg || "").includes("cancel")) {
        console.warn("[新增小熊头像更新失败]", error);
        wx.showToast({ title: "头像更新失败", icon: "none" });
      }
    }
  },

  onEmailInput(event) {
    const email = event.detail.value.trim().toLowerCase();
    this.setData({ loginEmail: email });
  },

  submitLogin() {
    const email = String(this.data.loginEmail || "").trim().toLowerCase();
    if (!EMAIL_LOGIN_MAP[email]) {
      wx.showToast({ title: "邮箱未绑定", icon: "none" });
      return;
    }
    this.loginWithEmail(email);
  },

  loginWithEmail(email) {
    const userName = EMAIL_LOGIN_MAP[email];
    const app = getApp();
    app.globalData.currentUser = userName;
    app.globalData.currentEmail = email;
    wx.setStorageSync("bearAppLogin", { userName, email });
    this.setData({
      currentUser: userName,
      currentEmail: email,
      isLoggedIn: true,
      loginSummary: `${userName}已登录`,
      loginAvatar: this.avatarForUser(userName),
      loginEmailText: email
    });
    wx.showToast({ title: `已登录${userName}`, icon: "none" });
  },

  logout() {
    const app = getApp();
    app.globalData.currentUser = "闪闪鱼";
    app.globalData.currentEmail = "";
    wx.removeStorageSync("bearAppLogin");
    this.setData({
      currentUser: "闪闪鱼",
      currentEmail: "",
      isLoggedIn: false,
      loginSummary: "输入固定邮箱登录",
      loginAvatar: "../../assets/shanshanyu.png",
      loginEmailText: "",
      loginEmail: ""
    });
    wx.showToast({ title: "已退出", icon: "none" });
  },

  toggleRulesEditing() {
    this.setData({ rulesEditing: !this.data.rulesEditing });
  },

  onRuleGroupChange(event) {
    const index = Number(event.detail.value || 0);
    this.setData({ editingRuleGroupIndex: index, selectedRuleGroupLabel: RULE_GROUPS[index].label });
  },

  onRuleNameInput(event) {
    this.setData({ ruleName: String(event.detail.value || "").slice(0, 10) });
  },

  onRuleAmountInput(event) {
    const value = String(event.detail.value || "").replace(/[^\d-]/g, "").replace(/(?!^)-/g, "").slice(0, 3);
    this.setData({ ruleAmount: value });
  },

  addRule() {
    const name = this.data.ruleName.trim();
    const amountText = String(this.data.ruleAmount).trim();
    const amount = Number(amountText);
    if (!name || !/^-?\d+$/.test(amountText) || amount === 0) {
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

  toggleBearsEditing() {
    this.setData({ bearsEditing: !this.data.bearsEditing });
  },

  renameBearEverywhere(state, oldName, newName) {
    state.people = (state.people || []).map((person) => ({
      ...person,
      wishBear: person.wishBear === oldName ? newName : person.wishBear
    }));

    if (state.draw?.assignments) {
      Object.keys(state.draw.assignments).forEach((personName) => {
        state.draw.assignments[personName] = (state.draw.assignments[personName] || []).map((bearName) =>
          bearName === oldName ? newName : bearName
        );
      });
    }

    if (state.pendingExchange?.targetBear === oldName) state.pendingExchange.targetBear = newName;
    if (state.pendingExchange?.exchangeBear === oldName) state.pendingExchange.exchangeBear = newName;
    return state;
  },

  removeBearEverywhere(state, name) {
    const fallbackBear = (state.bears || []).find((bear) => bear.name !== name && bear.active !== false)
      || (state.bears || []).find((bear) => bear.name !== name);

    state.people = (state.people || []).map((person) => ({
      ...person,
      wishBear: person.wishBear === name ? fallbackBear?.name || "" : person.wishBear
    }));

    if (state.draw?.assignments) {
      Object.keys(state.draw.assignments).forEach((personName) => {
        state.draw.assignments[personName] = (state.draw.assignments[personName] || []).filter((bearName) => bearName !== name);
      });
    }

    if (state.pendingExchange?.targetBear === name || state.pendingExchange?.exchangeBear === name) {
      state.pendingExchange = null;
    }
    return state;
  },

  renameBear(event) {
    const oldName = event.currentTarget.dataset.name;
    const newName = String(event.detail.value || "").trim();
    if (!oldName || oldName === newName) return;
    if (!newName) {
      wx.showToast({ title: "小熊名称不能为空", icon: "none" });
      this.renderState(this.data.state);
      return;
    }
    const nextState = normalizeState(this.data.state);
    if (nextState.bears.some((bear) => bear.name === newName)) {
      wx.showToast({ title: "小熊已存在", icon: "none" });
      this.renderState(nextState);
      return;
    }
    const bear = nextState.bears.find((item) => item.name === oldName);
    if (!bear) return;
    bear.name = newName;
    this.renameBearEverywhere(nextState, oldName, newName);
    nextState.actions = addAction(nextState, getApp().globalData.currentUser || "未登录", "修改小熊名称", `${oldName} → ${newName}`);
    this.persist(nextState, "名称已更新");
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
    nextState.bears.push({ name, image: this.data.newBearImage || "", active: false });
    nextState.actions = addAction(nextState, currentUser, "新增小熊", name);
    this.setData({ bearName: "", newBearImage: "" });
    this.persist(nextState, "已新增小熊");
  },

  deleteBear(event) {
    const name = event.currentTarget.dataset.name;
    const nextState = normalizeState(this.data.state);
    const bear = nextState.bears.find((item) => item.name === name);
    if (!bear) return;
    if (nextState.bears.length <= 1) {
      wx.showToast({ title: "至少保留 1 只", icon: "none" });
      return;
    }
    const activeCount = nextState.bears.filter((item) => item.active !== false).length;
    if (bear.active !== false && activeCount <= 1) {
      wx.showToast({ title: "至少保留 1 只参与", icon: "none" });
      return;
    }
    wx.showModal({
      title: "删除小熊",
      content: `确定删除${name}吗？`,
      confirmText: "删除",
      confirmColor: "#c76578",
      success: (result) => {
        if (!result.confirm) return;
        const latestState = normalizeState(this.data.state);
        latestState.bears = latestState.bears.filter((item) => item.name !== name);
        this.removeBearEverywhere(latestState, name);
        latestState.actions = addAction(latestState, getApp().globalData.currentUser || "未登录", "删除小熊", name);
        this.persist(latestState, "已删除小熊");
      }
    });
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
