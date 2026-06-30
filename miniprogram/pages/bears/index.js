const { DEFAULT_STATE, addAction, drawBears, formatDateKey, loadState, normalizeState, saveState } = require("../../utils/state");

Page({
  data: {
    dateText: "",
    state: DEFAULT_STATE,
    assignments: {},
    bearMap: {},
    heroBear: {},
    todayActions: [],
    currentUser: "闪闪鱼",
    pendingNotice: null
  },

  onShow() {
    this.refresh();
  },

  async refresh() {
    try {
      const state = await loadState();
      this.setState(state);
    } catch (error) {
      this.setState(normalizeState(DEFAULT_STATE));
      wx.showToast({ title: "读取失败", icon: "none" });
    }
  },

  setState(state) {
    const safeState = normalizeState(state);
    const assignments = safeState.draw?.assignments || {};
    const bearMap = {};
    safeState.bears.forEach((bear) => {
      bearMap[bear.name] = bear;
    });
    const heroBear = safeState.bears[new Date().getDate() % safeState.bears.length] || safeState.bears[0] || {};
    const todayId = formatDateKey();
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    this.setData({
      dateText: this.formatDate(),
      state: safeState,
      assignments,
      bearMap,
      heroBear,
      currentUser,
      pendingNotice: this.pendingNoticeForUser(safeState, currentUser),
      todayActions: (safeState.actions || []).filter((action) => action.date === todayId)
    });
  },

  pendingNoticeForUser(state, currentUser) {
    if (state.pendingRedraw) {
      return {
        type: "redraw",
        applicant: state.pendingRedraw.applicant,
        mine: state.pendingRedraw.applicant === currentUser,
        title: "重抽申请",
        detail: `${state.pendingRedraw.applicant} 申请重新抽签`
      };
    }
    if (state.pendingExchange) {
      return {
        type: "exchange",
        applicant: state.pendingExchange.applicant,
        targetBear: state.pendingExchange.targetBear,
        mine: state.pendingExchange.applicant === currentUser,
        title: "兑换申请",
        detail: `${state.pendingExchange.applicant} 想兑换 ${state.pendingExchange.targetBear}`
      };
    }
    return null;
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

  addCoinLog(state, personName, label, delta) {
    const day = new Date().getDate();
    const today = new Date();
    state.logs = state.logs || {};
    state.logs[day] = state.logs[day] || [];
    state.logs[day].push({
      person: personName,
      type: label,
      detail: label,
      delta,
      date: formatDateKey(today),
      earnedDay: day,
      createdAt: today.toISOString()
    });
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
    const state = normalizeState(this.data.state);
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    if (state.pendingRedraw || state.pendingExchange) {
      wx.showToast({ title: "已有待处理申请", icon: "none" });
      return;
    }
    state.pendingRedraw = { applicant: currentUser, date: formatDateKey() };
    state.actions = addAction(state, getApp().globalData.currentUser, "申请重抽", "等待对方同意");
    this.persist(state, "已申请");
  },

  requestExchange() {
    const state = normalizeState(this.data.state);
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    if (!state.drawUsed) {
      wx.showToast({ title: "请先抽签", icon: "none" });
      return;
    }
    if (state.pendingRedraw || state.pendingExchange) {
      wx.showToast({ title: "已有待处理申请", icon: "none" });
      return;
    }
    const opponent = state.people.find((person) => person.name !== currentUser)?.name;
    const opponentBears = state.draw?.assignments?.[opponent] || [];
    if (!opponentBears.length) {
      wx.showToast({ title: "暂无可兑换小熊", icon: "none" });
      return;
    }
    wx.showActionSheet({
      itemList: opponentBears,
      success: (res) => {
        const targetBear = opponentBears[res.tapIndex];
        if (!targetBear) return;
        const nextState = normalizeState(this.data.state);
        nextState.pendingExchange = { applicant: currentUser, targetBear, date: formatDateKey() };
        nextState.actions = addAction(nextState, currentUser, "申请兑换", targetBear);
        this.persist(nextState, "已申请兑换");
      }
    });
  },

  approvePending() {
    const notice = this.data.pendingNotice;
    if (!notice || notice.mine) return;
    if (notice.type === "redraw") {
      this.approveRedraw();
      return;
    }
    this.approveExchange();
  },

  rejectPending() {
    const notice = this.data.pendingNotice;
    if (!notice || notice.mine) return;
    const state = normalizeState(this.data.state);
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    const detail = notice.type === "redraw" ? "重抽申请" : `兑换 ${notice.targetBear}`;
    state.pendingRedraw = null;
    state.pendingExchange = null;
    state.actions = addAction(state, currentUser, "拒绝申请", detail);
    this.persist(state, "已拒绝");
  },

  approveRedraw() {
    const state = normalizeState(this.data.state);
    const pending = state.pendingRedraw;
    if (!pending) return;
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    if (pending.applicant === currentUser) return;
    state.draw = drawBears(state);
    state.drawUsed = true;
    state.pendingRedraw = null;
    this.addCoinLog(state, pending.applicant, "重抽", -3);
    state.actions = addAction(state, currentUser, "同意重抽", pending.applicant);
    this.persist(state, "已同意重抽");
  },

  approveExchange() {
    const state = normalizeState(this.data.state);
    const pending = state.pendingExchange;
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    if (!pending || pending.applicant === currentUser) return;
    const applicantBears = state.draw?.assignments?.[pending.applicant] || [];
    if (!applicantBears.length) {
      wx.showToast({ title: "对方没有可交换小熊", icon: "none" });
      return;
    }
    wx.showActionSheet({
      itemList: applicantBears,
      success: (res) => {
        const exchangeBear = applicantBears[res.tapIndex];
        if (!exchangeBear) return;
        const nextState = normalizeState(this.data.state);
        const assignments = nextState.draw.assignments;
        assignments[pending.applicant] = (assignments[pending.applicant] || []).map((bear) =>
          bear === exchangeBear ? pending.targetBear : bear
        );
        assignments[currentUser] = (assignments[currentUser] || []).map((bear) =>
          bear === pending.targetBear ? exchangeBear : bear
        );
        nextState.pendingExchange = null;
        this.addCoinLog(nextState, pending.applicant, "兑换小熊", -2);
        nextState.actions = addAction(nextState, currentUser, "同意兑换", `${pending.targetBear} ↔ ${exchangeBear}`);
        this.persist(nextState, "已完成兑换");
      }
    });
  },

  openWishPicker() {
    const state = normalizeState(this.data.state);
    const activeBears = state.bears.filter((bear) => bear.active !== false);
    wx.showActionSheet({
      itemList: activeBears.map((bear) => bear.name),
      success: (res) => {
        const selectedBear = activeBears[res.tapIndex]?.name;
        if (!selectedBear) return;
        const currentUser = getApp().globalData.currentUser || "闪闪鱼";
        const nextState = normalizeState(state);
        const person = nextState.people.find((item) => item.name === currentUser);
        if (person) {
          person.wishBear = selectedBear;
          nextState.actions = addAction(nextState, currentUser, "设置心愿小熊", selectedBear);
          this.persist(nextState, "已设置心愿");
        }
      }
    });
  }
});
