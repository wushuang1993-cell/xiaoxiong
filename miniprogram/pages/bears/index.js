const { addAction, drawBears, loadState, saveState } = require("../../utils/state");

Page({
  data: {
    dateText: "",
    state: { people: [], bears: [], actions: [] },
    assignments: {},
    bearMap: {},
    heroBear: {}
  },

  onShow() {
    this.refresh();
  },

  async refresh() {
    try {
      const state = await loadState();
      this.setState(state);
    } catch (error) {
      wx.showToast({ title: "读取失败", icon: "none" });
    }
  },

  setState(state) {
    const bearMap = {};
    state.bears.forEach((bear) => {
      bearMap[bear.name] = bear;
    });
    const heroBear = state.bears[new Date().getDate() % state.bears.length] || state.bears[0];
    this.setData({
      dateText: this.formatDate(),
      state,
      assignments: state.draw?.assignments || {},
      bearMap,
      heroBear
    });
  },

  formatDate() {
    const date = new Date();
    const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 | ${week}`;
  },

  async persist(state, message) {
    try {
      await saveState(state);
      this.setState(state);
      wx.showToast({ title: message, icon: "none" });
    } catch (error) {
      wx.showToast({ title: "保存失败", icon: "none" });
    }
  },

  handleDraw() {
    const state = { ...this.data.state };
    if (state.drawUsed) {
      wx.showToast({ title: "今天已经抽过", icon: "none" });
      return;
    }
    state.draw = drawBears(state);
    state.drawUsed = true;
    state.actions = addAction(state, getApp().globalData.currentUser, "今日已抽签", "");
    this.persist(state, "已抽签");
  },

  requestRedraw() {
    const state = { ...this.data.state };
    state.pendingRedraw = { applicant: getApp().globalData.currentUser };
    state.actions = addAction(state, getApp().globalData.currentUser, "申请重抽", "等待对方同意");
    this.persist(state, "已申请");
  },

  requestExchange() {
    wx.showToast({ title: "兑换选择下一版接入", icon: "none" });
  }
});
