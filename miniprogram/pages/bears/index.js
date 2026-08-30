const { DEFAULT_STATE, addAction, drawBears, formatDateKey, loadState, normalizeState, saveState } = require("../../utils/state");

const AUCTION_FEE = 1;
const AUCTION_DURATION_MINUTES = 180;
const MANUAL_DRAW_HOUR = 23;
const MANUAL_DRAW_MINUTE = 30;

Page({
  data: {
    dateText: "",
    state: DEFAULT_STATE,
    assignments: {},
    bearMap: {},
    heroBear: {},
    todayActions: [],
    currentUser: "闪闪鱼",
    isLoggedIn: false,
    pendingNotice: null,
    exchangeChoices: [],
    showExchangePicker: false,
    exchangePickerMode: "request",
    exchangePickerTitle: "选择想兑换的小熊",
    exchangePending: null,
    auctionBid: 1,
    auctionTargetBear: "",
    auctionMaxBid: 1,
    auctionDeadlineText: "",
    wishChoices: [],
    showWishPicker: false,
    drawReminder: null,
    recentDrawDays: []
  },

  onShow() {
    this.showShare();
    this.refresh();
  },

  async refresh() {
    try {
      const state = await loadState();
      this.setState(state);
    } catch (error) {
      console.warn("[小熊读取失败]", error);
      wx.showToast({ title: "读取失败", icon: "none" });
    }
  },

  setState(state) {
    const safeState = normalizeState(state);
    safeState.people = (safeState.people || []).map((person) => ({
      ...person,
      chanceText: `重抽 ${Number(person.redrawChances || 0)} · 兑换 ${Number(person.exchangeChances || 0)}`
    }));
    const assignments = safeState.draw?.assignments || {};
    const bearMap = {};
    safeState.bears.forEach((bear) => {
      bearMap[bear.name] = bear;
    });
    const heroBear = safeState.bears[new Date().getDate() % safeState.bears.length] || safeState.bears[0] || {};
    const todayId = formatDateKey();
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    const isLoggedIn = Boolean(getApp().globalData.currentOpenid);
    this.setData({
      dateText: this.formatDate(),
      state: safeState,
      assignments,
      bearMap,
      heroBear,
      currentUser,
      isLoggedIn,
      pendingNotice: this.pendingNoticeForUser(safeState, currentUser),
      todayActions: (safeState.actions || [])
        .filter((action) => action.date === todayId)
        .map((action) => ({
          ...action,
          sourceLabel: this.sourceLabel(action)
        })),
      drawReminder: this.drawReminderForToday(safeState),
      recentDrawDays: this.recentDrawDays(safeState, bearMap)
    });
    this.expireAuctionIfNeeded(safeState);
  },

  drawReminderForToday(state) {
    const now = new Date();
    const reminderAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), MANUAL_DRAW_HOUR, MANUAL_DRAW_MINUTE, 0, 0);
    if (state.drawUsed || now.getTime() < reminderAt.getTime()) return null;
    return {
      title: "23:30 手动抽小熊",
      detail: "今天还没有完成抽小熊，需要现在手动抽签。"
    };
  },

  sourceLabel(item) {
    return item?.sourceType === "system" ? "系统结算" : "手动记录";
  },

  dateAtOffset(offset) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date;
  },

  drawForDate(state, dateKey) {
    if (state.drawHistory?.[dateKey]) return state.drawHistory[dateKey];
    if (state.todayId === dateKey && state.draw?.assignments) return state.draw;
    return null;
  },

  recentDrawDays(state, bearMap) {
    return [
      { label: "今天", date: this.dateAtOffset(0) },
      { label: "昨天", date: this.dateAtOffset(-1) }
    ].map((item) => {
      const dateKey = formatDateKey(item.date);
      const draw = this.drawForDate(state, dateKey);
      return {
        key: dateKey,
        label: item.label,
        dateText: `${item.date.getMonth() + 1}月${item.date.getDate()}日`,
        hasDraw: Boolean(draw?.assignments),
        people: (state.people || []).map((person) => ({
          name: person.name,
          displayName: person.displayName || person.name,
          image: person.image,
          bears: (draw?.assignments?.[person.name] || []).map((bearName) => ({
            name: bearName,
            image: bearMap[bearName]?.image || ""
          }))
        }))
      };
    });
  },

  requireLogin() {
    if (getApp().globalData.currentOpenid) return true;
    wx.showToast({ title: "请先登录", icon: "none" });
    wx.switchTab({ url: "/pages/rules/index" });
    return false;
  },

  pendingNoticeForUser(state, currentUser) {
    const personImage = (name) => state.people.find((person) => person.name === name)?.image || "";
    const displayName = (name) => state.people.find((person) => person.name === name)?.displayName || name;
    if (state.pendingRedraw) {
      return {
        type: "redraw",
        applicant: state.pendingRedraw.applicant,
        applicantDisplay: displayName(state.pendingRedraw.applicant),
        applicantImage: personImage(state.pendingRedraw.applicant),
        mine: state.pendingRedraw.applicant === currentUser,
        title: "重抽申请",
        detail: `${displayName(state.pendingRedraw.applicant)} 申请重新抽签`
      };
    }
    if (state.pendingAuction) {
      const expiresAt = new Date(state.pendingAuction.expiresAt);
      const minutesLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 60000));
      return {
        type: "auction",
        applicant: state.pendingAuction.applicant,
        applicantDisplay: displayName(state.pendingAuction.applicant),
        applicantImage: personImage(state.pendingAuction.applicant),
        targetBear: state.pendingAuction.targetBear,
        bid: state.pendingAuction.bid,
        mine: state.pendingAuction.applicant === currentUser,
        title: "小熊竞拍",
        detail: `${displayName(state.pendingAuction.applicant)} 出价 ${state.pendingAuction.bid} 金币竞拍 ${state.pendingAuction.targetBear} · 剩余约 ${minutesLeft} 分钟`
      };
    }
    if (state.pendingExchange) {
      return {
        type: "exchange",
        applicant: state.pendingExchange.applicant,
        applicantDisplay: displayName(state.pendingExchange.applicant),
        applicantImage: personImage(state.pendingExchange.applicant),
        targetBear: state.pendingExchange.targetBear,
        mine: state.pendingExchange.applicant === currentUser,
        title: "旧版兑换申请",
        detail: `${displayName(state.pendingExchange.applicant)} 想兑换 ${state.pendingExchange.targetBear}，请取消后重新发起竞拍`
      };
    }
    return null;
  },

  formatDate() {
    const date = new Date();
    const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 | ${week}`;
  },

  async persist(state, message, mergeOptions = {}) {
    try {
      await saveState(state, mergeOptions);
      this.setState(state);
      wx.showToast({ title: message, icon: "none" });
    } catch (error) {
      console.warn("[小熊保存失败]", error);
      wx.showToast({ title: "云端保存失败", icon: "none" });
    }
  },

  onShareAppMessage() {
    return {
      title: "今晚小熊抽签和运动日历",
      path: "/pages/bears/index"
    };
  },

  onShareTimeline() {
    return {
      title: "今晚小熊抽签和运动日历"
    };
  },

  showShare() {
    if (!wx.showShareMenu) return;
    wx.showShareMenu({ menus: ["shareAppMessage", "shareTimeline"] });
  },

  addChanceLog(state, personName, label, delta, creditType) {
    const day = new Date().getDate();
    const today = new Date();
    state.logs = state.logs || {};
    state.logs[day] = state.logs[day] || [];
    state.logs[day].push({
      id: `log-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      person: personName,
      type: label,
      detail: label,
      delta,
      creditType,
      date: formatDateKey(today),
      earnedDay: day,
      createdAt: today.toISOString()
    });
  },

  addCoinLog(state, personName, label, delta) {
    this.addChanceLog(state, personName, label, delta, null);
  },

  storeDrawHistory(state) {
    if (!state.draw?.assignments) return;
    state.drawHistory = {
      ...(state.drawHistory || {}),
      [formatDateKey()]: JSON.parse(JSON.stringify(state.draw))
    };
  },

  handleDraw() {
    if (!this.requireLogin()) return;
    const state = { ...this.data.state };
    if (state.drawUsed) {
      wx.showToast({ title: "今天已经抽过", icon: "none" });
      return;
    }
    state.draw = drawBears(state);
    state.drawUsed = true;
    this.storeDrawHistory(state);
    state.actions = addAction(state, getApp().globalData.currentUser, "今日已抽签", "", `action-${formatDateKey()}-draw-${getApp().globalData.currentUser}`);
    this.persist(state, "已抽签");
  },

  requestRedraw() {
    if (!this.requireLogin()) return;
    const state = normalizeState(this.data.state);
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    const currentPerson = state.people.find((person) => person.name === currentUser);
    if (!state.drawUsed) {
      wx.showToast({ title: "请先抽签", icon: "none" });
      return;
    }
    if (!currentPerson || Number(currentPerson.redrawChances || 0) < 1) {
      wx.showToast({ title: "没有重抽机会", icon: "none" });
      return;
    }
    state.draw = drawBears(state);
    state.drawUsed = true;
    this.storeDrawHistory(state);
    this.addChanceLog(state, currentUser, "重新抽签", -1, "redraw");
    state.actions = addAction(state, currentUser, "直接重抽", "消耗 1 次申请重抽机会");
    this.persist(state, "已重抽");
  },

  requestExchange() {
    if (!this.requireLogin()) return;
    const state = normalizeState(this.data.state);
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    const currentPerson = state.people.find((person) => person.name === currentUser);
    if (!currentPerson || Number(currentPerson.exchangeChances || 0) < 1) {
      wx.showToast({ title: "没有兑换机会", icon: "none" });
      return;
    }
    if (!state.drawUsed) {
      wx.showToast({ title: "请先抽签", icon: "none" });
      return;
    }
    const opponent = state.people.find((person) => person.name !== currentUser)?.name;
    const opponentBears = state.draw?.assignments?.[opponent] || [];
    if (!opponentBears.length) {
      wx.showToast({ title: "暂无可兑换小熊", icon: "none" });
      return;
    }
    this.setData({
      exchangeChoices: opponentBears.map((name) => ({ name, image: state.bears.find((bear) => bear.name === name)?.image || "" })),
      showExchangePicker: true,
      exchangePickerMode: "exchange",
      exchangePickerTitle: "申请兑换",
      exchangePending: null,
      auctionTargetBear: opponentBears[0],
      auctionBid: 1,
      auctionMaxBid: 1,
      auctionDeadlineText: this.auctionDeadlineText()
    });
  },

  closeExchangePicker() {
    this.setData({ showExchangePicker: false, exchangeChoices: [], exchangePending: null, auctionTargetBear: "" });
  },

  chooseExchangeBear(event) {
    if (!this.requireLogin()) return;
    const selectedBear = event.currentTarget.dataset.name;
    if (!selectedBear) return;
    this.setData({ auctionTargetBear: selectedBear });
  },

  changeAuctionBid(delta) {
    const nextBid = Math.min(this.data.auctionMaxBid, Math.max(1, Number(this.data.auctionBid || 1) + delta));
    this.setData({ auctionBid: nextBid });
  },

  increaseAuctionBid() {
    this.changeAuctionBid(1);
  },

  decreaseAuctionBid() {
    this.changeAuctionBid(-1);
  },

  onAuctionBidInput(event) {
    const value = Number(String(event.detail.value || "").replace(/[^\d]/g, ""));
    const bid = Math.min(this.data.auctionMaxBid, Math.max(1, value || 1));
    this.setData({ auctionBid: bid });
  },

  auctionDeadline() {
    const now = new Date();
    const durationEnd = new Date(now.getTime() + AUCTION_DURATION_MINUTES * 60000);
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0);
    return durationEnd.getTime() > dayEnd.getTime() ? dayEnd : durationEnd;
  },

  auctionDeadlineText() {
    const deadline = this.auctionDeadline();
    return `${deadline.getHours()}:${String(deadline.getMinutes()).padStart(2, "0")}`;
  },

  hasAuctionUsedToday(state, userName) {
    const todayId = formatDateKey();
    return (state.actions || []).some((action) => action.date === todayId && action.person === userName && action.action === "发起竞拍");
  },

  confirmExchange() {
    if (!this.requireLogin()) return;
    const nextState = normalizeState(this.data.state);
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    const currentPerson = nextState.people.find((person) => person.name === currentUser);
    const targetBear = this.data.auctionTargetBear;
    if (!targetBear) {
      wx.showToast({ title: "先选择小熊", icon: "none" });
      return;
    }
    if (!currentPerson || Number(currentPerson.exchangeChances || 0) < 1) {
      wx.showToast({ title: "没有兑换机会", icon: "none" });
      return;
    }
    const opponent = nextState.people.find((person) => person.name !== currentUser)?.name;
    const assignments = nextState.draw?.assignments || {};
    const mine = assignments[currentUser] || [];
    const theirs = assignments[opponent] || [];
    const targetIndex = theirs.indexOf(targetBear);
    if (targetIndex < 0) {
      wx.showToast({ title: "这只小熊不能兑换", icon: "none" });
      return;
    }
    const offerBear = mine[0] || "";
    if (offerBear) {
      mine[0] = targetBear;
      theirs[targetIndex] = offerBear;
    } else {
      theirs.splice(targetIndex, 1);
      mine.push(targetBear);
    }
    assignments[currentUser] = mine;
    assignments[opponent] = theirs;
    this.storeDrawHistory(nextState);
    this.addChanceLog(nextState, currentUser, "兑换小熊", -1, "exchange");
    nextState.actions = addAction(nextState, currentUser, "直接兑换", targetBear);
    this.setData({ showExchangePicker: false, exchangeChoices: [], auctionTargetBear: "" });
    this.persist(nextState, "已兑换");
  },

  confirmAuction() {
    if (!this.requireLogin()) return;
    const nextState = normalizeState(this.data.state);
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    const currentPerson = nextState.people.find((person) => person.name === currentUser);
    const bid = Number(this.data.auctionBid || 1);
    const targetBear = this.data.auctionTargetBear;
    if (!targetBear) {
      wx.showToast({ title: "先选择小熊", icon: "none" });
      return;
    }
    if (bid < 1) {
      wx.showToast({ title: "出价至少为 1 金币", icon: "none" });
      return;
    }
    if (!currentPerson || currentPerson.coins < bid + AUCTION_FEE) {
      wx.showToast({ title: "金币不足，无法发起竞拍", icon: "none" });
      return;
    }
    if (this.hasAuctionUsedToday(nextState, currentUser)) {
      wx.showToast({ title: "今天已经发起过竞拍了", icon: "none" });
      return;
    }
    const deadline = this.auctionDeadline();
    const now = new Date();
    nextState.pendingAuction = {
      applicant: currentUser,
      targetBear,
      bid,
      fee: AUCTION_FEE,
      date: formatDateKey(now),
      createdAt: now.toISOString(),
      expiresAt: deadline.toISOString()
    };
    this.addCoinLog(nextState, currentUser, "竞拍手续费", -AUCTION_FEE);
    this.addCoinLog(nextState, currentUser, "竞拍冻结", -bid);
    nextState.actions = addAction(nextState, currentUser, "发起竞拍", `${targetBear} · ${bid} 金币`);
    this.setData({ showExchangePicker: false, exchangeChoices: [], auctionTargetBear: "" });
    this.persist(nextState, "竞拍已发起");
  },

  approvePending() {
    if (!this.requireLogin()) return;
    const notice = this.data.pendingNotice;
    if (!notice || notice.mine) return;
    if (notice.type === "redraw") {
      this.approveRedraw();
      return;
    }
    if (notice.type === "exchange") {
      wx.showToast({ title: "请取消后重新竞拍", icon: "none" });
      return;
    }
    this.acceptAuction();
  },

  rejectPending() {
    if (!this.requireLogin()) return;
    const notice = this.data.pendingNotice;
    if (!notice || notice.mine) return;
    const state = normalizeState(this.data.state);
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    const detail = notice.type === "redraw" ? "重抽申请" : `竞拍 ${notice.targetBear}`;
    state.pendingRedraw = null;
    if (notice.type === "auction" && state.pendingAuction) {
      this.addCoinLog(state, state.pendingAuction.applicant, "竞拍退款", state.pendingAuction.bid);
      state.pendingAuction = null;
    }
    if (notice.type === "exchange") state.pendingExchange = null;
    state.actions = addAction(state, currentUser, "拒绝申请", detail);
    this.persist(state, "已拒绝", { clearPending: notice.type });
  },

  cancelPending() {
    if (!this.requireLogin()) return;
    const notice = this.data.pendingNotice;
    if (!notice || !notice.mine) return;
    const state = normalizeState(this.data.state);
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    if (notice.type === "redraw") {
      state.pendingRedraw = null;
      state.actions = addAction(state, currentUser, "取消重抽", "已取消申请");
      this.persist(state, "已取消", { clearPending: "redraw" });
      return;
    }
    if (notice.type === "auction" && state.pendingAuction) {
      this.addCoinLog(state, state.pendingAuction.applicant, "竞拍退款", state.pendingAuction.bid);
      state.pendingAuction = null;
    }
    if (notice.type === "exchange") state.pendingExchange = null;
    state.actions = addAction(state, currentUser, "取消竞拍", notice.targetBear || "");
    this.persist(state, "已取消", { clearPending: notice.type === "exchange" ? "exchange" : "auction" });
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

  acceptAuction() {
    const state = normalizeState(this.data.state);
    const pending = state.pendingAuction;
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    if (!pending || pending.applicant === currentUser) return;
    if (new Date(pending.expiresAt).getTime() <= Date.now()) {
      this.expireAuctionIfNeeded(state);
      return;
    }
    const assignments = state.draw?.assignments || {};
    if (!(assignments[currentUser] || []).includes(pending.targetBear)) {
      wx.showToast({ title: "小熊状态已变化", icon: "none" });
      state.pendingAuction = null;
      this.addCoinLog(state, pending.applicant, "竞拍退款", pending.bid);
      this.persist(state, "竞拍已取消", { clearPending: "auction" });
      return;
    }
    assignments[currentUser] = (assignments[currentUser] || []).filter((bear) => bear !== pending.targetBear);
    assignments[pending.applicant] = [...(assignments[pending.applicant] || []), pending.targetBear];
    this.addCoinLog(state, currentUser, "竞拍成交", pending.bid);
    state.pendingAuction = null;
    state.actions = addAction(state, currentUser, "接受竞拍", `${pending.targetBear} · ${pending.bid} 金币`);
    this.persist(state, "竞拍成交", { clearPending: "auction" });
  },

  expireAuctionIfNeeded(state) {
    const pending = state.pendingAuction;
    if (!pending || !pending.expiresAt || new Date(pending.expiresAt).getTime() > Date.now()) return;
    const nextState = normalizeState(state);
    this.addCoinLog(nextState, pending.applicant, "竞拍退款", pending.bid);
    nextState.pendingAuction = null;
    nextState.actions = addAction(nextState, pending.applicant, "竞拍流拍", pending.targetBear);
    this.persist(nextState, "竞拍已流拍", { clearPending: "auction" });
  },

  openWishPicker() {
    if (!this.requireLogin()) return;
    const state = normalizeState(this.data.state);
    const activeBears = state.bears.filter((bear) => bear.active !== false);
    this.setData({
      wishChoices: activeBears.map((bear) => ({
        name: bear.name,
        image: bear.image,
        active: state.people.find((person) => person.name === (getApp().globalData.currentUser || "闪闪鱼"))?.wishBear === bear.name
      })),
      showWishPicker: true
    });
  },

  closeWishPicker() {
    this.setData({ showWishPicker: false, wishChoices: [] });
  },

  chooseWishBear(event) {
    const selectedBear = event.currentTarget.dataset.name;
    if (!selectedBear) return;
    const currentUser = getApp().globalData.currentUser || "闪闪鱼";
    const nextState = normalizeState(this.data.state);
    const person = nextState.people.find((item) => item.name === currentUser);
    if (person) {
      person.wishBear = selectedBear;
      nextState.actions = addAction(nextState, currentUser, "设置心愿小熊", selectedBear);
      this.setData({ showWishPicker: false, wishChoices: [] });
      this.persist(nextState, "已设置心愿");
    }
  }
});
