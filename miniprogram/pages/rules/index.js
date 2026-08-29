const { DEFAULT_STATE, addAction, loadState, normalizeState, saveState } = require("../../utils/state");

const RULE_GROUPS = [
  { key: "base", label: "基础家务", title: "基础家务" },
  { key: "bonus", label: "增值家务", title: "增值家务" },
  { key: "penalty", label: "扣分", title: "扣分" },
  { key: "drink", label: "饮品", title: "饮品" }
];

function amountToValue(amount, groupKey) {
  const value = Number(amount || 0);
  if (groupKey === "bonus") return "+1 申请兑换";
  if (groupKey === "penalty") return "-1 申请重抽";
  if (groupKey === "base") return "+1 申请重抽";
  return `${value > 0 ? "+" : ""}${value}`;
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
    currentOpenid: "",
    isLoggedIn: false,
    loginSummary: "闪闪鱼",
    loginAvatar: "../../assets/shanshanyu.png",
    displayNameInput: "",
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
    this.showShare();
    const app = getApp();
    const currentUser = app.globalData.currentUser || "闪闪鱼";
    const currentOpenid = app.globalData.currentOpenid || "";
    this.setData({
      currentUser,
      currentOpenid,
      isLoggedIn: Boolean(currentOpenid),
      loginSummary: currentOpenid ? `${this.displayNameForUser(currentUser)}已登录` : "微信登录",
      loginAvatar: this.avatarForUser(currentUser),
      displayNameInput: this.displayNameForUser(currentUser)
    });
    this.refresh();
  },

  onShareAppMessage() {
    return {
      title: "小熊 App 家庭设置",
      path: "/pages/rules/index"
    };
  },

  onShareTimeline() {
    return {
      title: "小熊 App 家庭设置"
    };
  },

  showShare() {
    if (!wx.showShareMenu) return;
    wx.showShareMenu({ menus: ["shareAppMessage", "shareTimeline"] });
  },

  avatarForUser(userName) {
    const person = this.data.state.people.find((item) => item.name === userName);
    return person?.image || (userName === "杰尼龟" ? "../../assets/jienigui.png" : "../../assets/shanshanyu.png");
  },

  displayNameForUser(userName) {
    const person = this.data.state.people.find((item) => item.name === userName);
    return person?.displayName || userName;
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
      displayNameInput: loginPerson?.displayName || this.data.currentUser,
      ruleSections: RULE_GROUPS.map((group) => ({
        ...group,
        rules: decorateRules(safeState.rules[group.key] || [])
      }))
    });
  },

  async persist(nextState, message, mergeOptions = {}) {
    try {
      await saveState(normalizeState(nextState), mergeOptions);
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

  callLoginFunction() {
    if (!wx.cloud?.callFunction) return Promise.reject(new Error("当前基础库不支持云开发登录"));
    return wx.cloud.callFunction({
      name: "state",
      data: { action: "login" }
    }).then((result) => {
      if (!result?.result?.ok || !result.result.openid) {
        throw new Error(result?.result?.message || "微信登录失败");
      }
      return result.result;
    });
  },

  chooseImagePath() {
    return new Promise((resolve, reject) => {
      wx.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        sourceType: ["album", "camera"],
        success: async (result) => {
          try {
            const tempFilePath = result.tempFilePaths?.[0];
            const tempFile = result.tempFiles?.[0];
            await this.validateImagePath(tempFilePath, tempFile?.size || 0);
            resolve(tempFilePath);
          } catch (error) {
            reject(error);
          }
        },
        fail: reject
      });
    });
  },

  validateImagePath(tempFilePath, size = 0) {
    if (!tempFilePath) return Promise.reject(new Error("未选择图片"));
    const extension = String(tempFilePath).match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1]?.toLowerCase();
    if (extension && !["png", "jpg", "jpeg"].includes(extension)) {
      wx.showModal({ title: "图片格式不支持", content: "请上传 PNG、JPG 或 JPEG 图片", showCancel: false });
      return Promise.reject(new Error("图片格式不支持"));
    }
    if (size > 2 * 1024 * 1024) {
      wx.showModal({ title: "图片太大", content: "图片不能超过 2MB", showCancel: false });
      return Promise.reject(new Error("图片太大"));
    }
    return new Promise((resolve) => {
      wx.getImageInfo({
        src: tempFilePath,
        success: (info) => {
          const width = Number(info.width || 0);
          const height = Number(info.height || 0);
          if (width && height) {
            const ratio = width > height ? width / height : height / width;
            if (ratio > 1.15) {
              wx.showToast({ title: "建议上传正方形图片", icon: "none" });
            }
          }
          resolve();
        },
        fail: () => resolve()
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

  saveDisplayName(displayName) {
    if (!this.data.isLoggedIn) return;
    const nextDisplayName = String(displayName || "").trim();
    if (!nextDisplayName) {
      wx.showToast({ title: "登录名不能为空", icon: "none" });
      return;
    }
    const nextState = normalizeState(this.data.state);
    const person = nextState.people.find((item) => item.name === this.data.currentUser);
    if (!person) return;
    person.displayName = nextDisplayName;
    nextState.actions = addAction(nextState, this.data.currentUser, "修改显示名", nextDisplayName);
    this.persist(nextState, "登录名已更新");
  },

  editDisplayName() {
    if (!this.data.isLoggedIn) return;
    wx.showModal({
      title: "修改登录名",
      editable: true,
      placeholderText: "最多 8 个字",
      content: this.data.displayNameInput || this.data.currentUser,
      success: (result) => {
        if (!result.confirm) return;
        this.saveDisplayName(String(result.content || "").slice(0, 8));
      }
    });
  },

  async submitWechatLogin() {
    try {
      wx.showLoading({ title: "登录中" });
      const login = await this.callLoginFunction();
      const safeState = normalizeState(this.data.state);
      const matched = safeState.people.find((person) => person.openid === login.openid);
      wx.hideLoading();
      if (matched) {
        this.loginAsPerson(matched.name, login.openid, safeState);
        return;
      }
      this.bindWechatIdentity(login.openid, safeState);
    } catch (error) {
      wx.hideLoading();
      console.warn("[微信登录失败]", error);
      wx.showToast({ title: error.message || "微信登录失败", icon: "none" });
    }
  },

  bindWechatIdentity(openid, state) {
    const candidates = (state.people || []).filter((person) => !person.openid);
    const itemList = [...candidates.map((person) => `绑定 ${person.displayName || person.name}`), "新增运动成员"];
    wx.showActionSheet({
      itemList,
      success: (result) => {
        const nextState = normalizeState(state);
        let userName = "";
        if (result.tapIndex < candidates.length) {
          const target = nextState.people.find((person) => person.name === candidates[result.tapIndex].name);
          if (!target) return;
          target.openid = openid;
          userName = target.name;
          nextState.actions = addAction(nextState, userName, "绑定微信登录", target.displayName || target.name);
        } else {
          const index = nextState.people.length + 1;
          userName = `成员${index}`;
          const firstBear = nextState.bears?.[0]?.name || "史迪奇";
          nextState.people.push({
            name: userName,
            displayName: userName,
            openid,
            coins: 0,
            wishBear: firstBear,
            image: "../../assets/shanshanyu.png"
          });
          nextState.actions = addAction(nextState, userName, "新增微信成员", userName);
        }
        this.persist(nextState, "微信已绑定");
        this.loginAsPerson(userName, openid, nextState);
      }
    });
  },

  loginAsPerson(userName, openid, state = this.data.state) {
    const app = getApp();
    app.globalData.currentUser = userName;
    app.globalData.currentOpenid = openid;
    wx.setStorageSync("bearAppLogin", { userName, openid });
    const person = normalizeState(state).people.find((item) => item.name === userName);
    this.setData({
      currentUser: userName,
      currentOpenid: openid,
      isLoggedIn: true,
      loginSummary: `${person?.displayName || userName}已登录`,
      loginAvatar: person?.image || this.avatarForUser(userName),
      displayNameInput: person?.displayName || userName
    });
    wx.showToast({ title: "微信登录成功", icon: "none" });
  },

  logout() {
    const app = getApp();
    app.globalData.currentUser = "闪闪鱼";
    app.globalData.currentOpenid = "";
    wx.removeStorageSync("bearAppLogin");
    this.setData({
      currentUser: "闪闪鱼",
      currentOpenid: "",
      isLoggedIn: false,
      loginSummary: "微信登录",
      loginAvatar: "../../assets/shanshanyu.png",
      displayNameInput: ""
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
      wx.showToast({ title: "填写名称和次数", icon: "none" });
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
    nextState.rules[groupKey].push({ label: name, value: amountToValue(amount, groupKey) });
    nextState.actions = addAction(nextState, currentUser, "新增机会规则", name);
    this.setData({ ruleName: "", ruleAmount: "" });
    this.persist(nextState, "已新增规则");
  },

  deleteRule(event) {
    const { group, label } = event.currentTarget.dataset;
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    const nextState = normalizeState(this.data.state);
    nextState.rules[group] = (nextState.rules[group] || []).filter((rule) => rule.label !== label);
    nextState.actions = addAction(nextState, currentUser, "删除机会规则", label);
    this.persist(nextState, "已删除", { deletedRules: [{ group, label }] });
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
        this.persist(latestState, "已删除小熊", { deletedBears: [name] });
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
