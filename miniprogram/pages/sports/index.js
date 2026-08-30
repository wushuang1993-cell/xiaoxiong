const { DEFAULT_STATE, addAction, formatDateKey, loadState, normalizeState, saveState } = require("../../utils/state");

const SPORT_TYPES = ["散步", "跑步", "羽毛球", "网球", "力量", "骑行"];
const STEP_PK_CUTOFF_HOUR = 23;
const STEP_PK_CUTOFF_TEXT = "23:00";

function dateKeyFor(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

Page({
  data: {
    dateText: "",
    selectedPerson: "",
    selectedDay: new Date().getDate(),
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth(),
    calendarMonthText: "",
    touchStartX: 0,
    weekDays: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
    calendarDays: [],
    state: DEFAULT_STATE,
    sportTypes: SPORT_TYPES,
    stepCutoffText: STEP_PK_CUTOFF_TEXT,
    todayLogs: [],
    selectedDateTitle: "",
    stepsInput: "",
    stepRows: []
  },

  onShow() {
    this.showShare();
    this.refresh();
  },

  onShareAppMessage() {
    return {
      title: "小熊运动日历",
      path: "/pages/sports/index"
    };
  },

  onShareTimeline() {
    return {
      title: "小熊运动日历"
    };
  },

  showShare() {
    if (!wx.showShareMenu) return;
    wx.showShareMenu({ menus: ["shareAppMessage", "shareTimeline"] });
  },

  async refresh() {
    try {
      const state = normalizeState(await loadState());
      const hasStepWinnerUpdate = this.awardStepWinnerIfReady(state, formatDateKey());
      if (hasStepWinnerUpdate) {
        await saveState(state);
      }
      this.renderState(state);
    } catch (error) {
      console.warn("[小熊运动读取失败]", error);
      wx.showToast({ title: "读取失败", icon: "none" });
    }
  },

  renderState(state) {
    const safeState = normalizeState(state);
    const selectedPerson = this.data.selectedPerson || safeState.people[0]?.name || "";
    const selectedDay = this.data.selectedDay || new Date().getDate();
    const calendarYear = this.data.calendarYear;
    const calendarMonth = this.data.calendarMonth;
    const selectedDateKey = dateKeyFor(calendarYear, calendarMonth, selectedDay);
    const logs = this.logsForDay(safeState, selectedDay, calendarYear, calendarMonth);
    this.setData({
      dateText: this.formatDate(),
      selectedPerson,
      selectedDay,
      calendarYear,
      calendarMonth,
      calendarMonthText: `${calendarYear}年${calendarMonth + 1}月`,
      calendarDays: this.buildCalendarDays(safeState, selectedDay, calendarYear, calendarMonth),
      state: safeState,
      todayLogs: logs.map((log) => ({
        ...log,
        displayPerson: safeState.people.find((person) => person.name === log.person)?.displayName || log.person,
        sourceLabel: this.sourceLabel(log)
      })),
      selectedDateTitle: `${calendarMonth + 1}月${selectedDay}日运动`,
      stepRows: this.stepRowsForDay(safeState, selectedDateKey)
    });
  },

  buildCalendarDays(state, selectedDay, year, month) {
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
    const days = [];

    for (let index = 0; index < firstDay; index += 1) {
      days.push({ key: `empty-${index}`, day: 0, isEmpty: true });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const dateKey = dateKeyFor(year, month, day);
      days.push({
        key: `day-${day}`,
        day,
        isToday: isCurrentMonth && day === now.getDate(),
        isSelected: day === selectedDay,
        hasLogs: this.logsForDay(state, day, year, month).length > 0,
        hasSteps: this.stepsForDate(state, dateKey).length > 0
      });
    }

    return days;
  },

  logsForDay(state, selectedDay, year, month) {
    const dateKey = dateKeyFor(year, month, selectedDay);
    return Object.keys(state.sportsLogs || {}).reduce((items, day) => {
      (state.sportsLogs[day] || []).forEach((log) => {
        if (log.date === dateKey) items.push(log);
      });
      return items;
    }, []);
  },

  stepsForDate(state, dateKey) {
    return Object.keys(state.wechatSteps || {}).reduce((items, day) => {
      (state.wechatSteps[day] || []).forEach((item) => {
        if (item.date === dateKey) items.push(item);
      });
      return items;
    }, []);
  },

  stepRowsForDay(state, dateKey) {
    const rows = this.stepsForDate(state, dateKey);
    const maxSteps = Math.max(0, ...rows.map((item) => Number(item.steps || 0)));
    const winnerCount = rows.filter((item) => Number(item.steps || 0) === maxSteps && maxSteps > 0).length;
    return (state.people || []).map((person) => {
      const item = rows.find((row) => row.person === person.name || row.openid === person.openid);
      const steps = Number(item?.steps || 0);
      return {
        name: person.name,
        displayName: person.displayName || person.name,
        image: person.image,
        steps,
        isWinner: steps > 0 && steps === maxSteps && winnerCount === 1
      };
    });
  },

  formatDate() {
    const date = new Date();
    const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 | ${week}`;
  },

  sourceLabel(item) {
    return item?.sourceType === "system" ? "系统结算" : "手动记录";
  },

  selectPerson(event) {
    this.setData({ selectedPerson: event.currentTarget.dataset.name });
  },

  selectDay(event) {
    const selectedDay = Number(event.currentTarget.dataset.day || 0);
    if (!selectedDay) return;
    this.setData({ selectedDay });
    this.renderState(this.data.state);
  },

  shiftMonth(offset) {
    const nextDate = new Date(this.data.calendarYear, this.data.calendarMonth + offset, 1);
    const today = new Date();
    const isCurrentMonth = nextDate.getFullYear() === today.getFullYear() && nextDate.getMonth() === today.getMonth();
    this.setData({
      calendarYear: nextDate.getFullYear(),
      calendarMonth: nextDate.getMonth(),
      selectedDay: isCurrentMonth ? today.getDate() : 1
    });
    this.renderState(this.data.state);
  },

  prevMonth() {
    this.shiftMonth(-1);
  },

  nextMonth() {
    this.shiftMonth(1);
  },

  onCalendarTouchStart(event) {
    this.setData({ touchStartX: event.touches?.[0]?.clientX || 0 });
  },

  onCalendarTouchEnd(event) {
    const endX = event.changedTouches?.[0]?.clientX || 0;
    const diff = endX - this.data.touchStartX;
    if (Math.abs(diff) < 48) return;
    this.shiftMonth(diff > 0 ? -1 : 1);
  },

  async saveSportsState(state, message, mergeOptions = {}) {
    try {
      const nextState = normalizeState(state);
      await saveState(nextState, mergeOptions);
      this.renderState(nextState);
      wx.showToast({ title: message, icon: "none" });
    } catch (error) {
      console.warn("[小熊运动保存失败]", error);
      wx.showToast({ title: "保存失败", icon: "none" });
    }
  },

  addRedrawChanceLog(state, personName, detail, id, dateKey = formatDateKey(), sourceType = "manual") {
    const now = new Date();
    const day = Number(dateKey.slice(-2)) || now.getDate();
    state.logs = state.logs || {};
    state.logs[day] = state.logs[day] || [];
    if (id && state.logs[day].some((log) => log.id === id)) return false;
    state.logs[day].push({
      id: id || `sport-chance-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      person: personName,
      type: "运动",
      detail,
      delta: 1,
      creditType: "redraw",
      date: dateKey,
      earnedDay: day,
      sourceType,
      createdAt: now.toISOString()
    });
    return true;
  },

  async addSportLog(event) {
    if (!this.data.selectedPerson) {
      wx.showToast({ title: "请先选择人物", icon: "none" });
      return;
    }
    const label = event.currentTarget.dataset.label;
    const now = new Date();
    const day = now.getDate();
    const dateKey = formatDateKey(now);
    const id = `sport-${dateKey}-${this.data.selectedPerson}-${label}`;
    const chanceId = `sport-chance-${dateKey}-${this.data.selectedPerson}-${label}`;
    const state = normalizeState(this.data.state);
    state.sportsLogs = state.sportsLogs || {};
    state.sportsLogs[day] = state.sportsLogs[day] || [];
    state.sportsLogs[day] = state.sportsLogs[day].filter((log) => log.id !== id);
    state.sportsLogs[day].push({
      id,
      person: this.data.selectedPerson,
      type: label,
      detail: label,
      date: dateKey,
      earnedDay: day,
      sourceType: "manual",
      createdBy: getApp().globalData.currentUser || this.data.selectedPerson,
      createdAt: now.toISOString()
    });
    this.addRedrawChanceLog(state, this.data.selectedPerson, label, chanceId, dateKey, "manual");
    state.actions = addAction(state, this.data.selectedPerson, "记录运动", `${label}，+1 申请重抽`, `action-${id}`);
    await this.saveSportsState(state, "已记录运动");
  },

  onStepsInput(event) {
    this.setData({ stepsInput: String(event.detail.value || "").replace(/[^\d]/g, "").slice(0, 6) });
  },

  isStepPkClosed(dateKey) {
    const todayKey = formatDateKey();
    if (dateKey < todayKey) return true;
    if (dateKey > todayKey) return false;
    return new Date().getHours() >= STEP_PK_CUTOFF_HOUR;
  },

  awardStepWinnerIfReady(state, dateKey) {
    if (!this.isStepPkClosed(dateKey)) return false;
    const people = state.people || [];
    const rows = this.stepRowsForDay(state, dateKey);
    const rewardPrefix = `steps-winner-${dateKey}-`;
    const existingRewardIds = Object.keys(state.logs || {}).reduce((ids, day) => {
      (state.logs[day] || []).forEach((log) => {
        if (String(log.id || "").startsWith(rewardPrefix)) ids.push(log.id);
      });
      return ids;
    }, []);
    const clearStepWinnerReward = () => {
      state.logs = Object.keys(state.logs || {}).reduce((nextLogs, day) => {
        nextLogs[day] = (state.logs[day] || []).filter((log) => !String(log.id || "").startsWith(rewardPrefix));
        return nextLogs;
      }, {});
      state.actions = (state.actions || []).filter((action) => !String(action.id || "").startsWith(`action-${rewardPrefix}`));
    };
    const allRecorded = people.length > 0 && rows.every((row) => Number(row.steps || 0) > 0);
    if (!allRecorded) {
      if (!existingRewardIds.length) return false;
      clearStepWinnerReward();
      return true;
    }
    const winners = rows.filter((row) => row.isWinner);
    if (winners.length !== 1) {
      if (!existingRewardIds.length) return false;
      clearStepWinnerReward();
      return true;
    }
    const winner = winners[0];
    const id = `steps-winner-${dateKey}-${winner.name}`;
    if (existingRewardIds.length === 1 && existingRewardIds[0] === id) return false;
    clearStepWinnerReward();
    const added = this.addRedrawChanceLog(state, winner.name, "步数胜者", id, dateKey, "system");
    if (added) {
      state.actions = addAction(state, winner.name, "步数胜者", "+1 申请重抽", `action-${id}`);
    }
    return true;
  },

  async saveManualSteps() {
    if (!this.data.selectedPerson) {
      wx.showToast({ title: "请先选择人物", icon: "none" });
      return;
    }
    const steps = Number(this.data.stepsInput || 0);
    if (steps <= 0) {
      wx.showToast({ title: "填写步数", icon: "none" });
      return;
    }
    const now = new Date();
    const day = now.getDate();
    const dateKey = formatDateKey(now);
    const state = normalizeState(this.data.state);
    const person = state.people.find((item) => item.name === this.data.selectedPerson);
    state.wechatSteps = state.wechatSteps || {};
    state.wechatSteps[day] = (state.wechatSteps[day] || []).filter((item) => item.person !== this.data.selectedPerson);
    state.wechatSteps[day].push({
      id: `steps-${dateKey}-${this.data.selectedPerson}`,
      person: this.data.selectedPerson,
      openid: person?.openid || "",
      steps,
      date: dateKey,
      sourceType: "manual",
      createdBy: getApp().globalData.currentUser || this.data.selectedPerson,
      createdAt: now.toISOString()
    });
    state.actions = addAction(state, this.data.selectedPerson, "更新步数", `${steps}`, `action-steps-${dateKey}-${this.data.selectedPerson}`);
    const awarded = this.awardStepWinnerIfReady(state, dateKey);
    this.setData({ stepsInput: "" });
    await this.saveSportsState(state, awarded ? "步数已结算" : "步数已更新");
  },

  syncWechatSteps() {
    if (!wx.getWeRunData) {
      wx.showModal({
        title: "暂不支持",
        content: "当前微信版本不支持读取微信步数，可以先手动记录。",
        showCancel: false
      });
      return;
    }
    wx.getWeRunData({
      success: () => {
        wx.showModal({
          title: "已授权微信步数",
          content: "微信返回的是加密步数，后续接入云端解密后会自动写入。现在可以先手动记录。",
          showCancel: false
        });
      },
      fail: () => wx.showToast({ title: "未授权微信步数", icon: "none" })
    });
  }
});
