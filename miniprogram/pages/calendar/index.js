const { DEFAULT_STATE, addAction, formatDateKey, loadState, normalizeState, saveState } = require("../../utils/state");

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
    state: { people: [], logs: {}, rules: {} },
    todayLogs: [],
    todaySportsLogs: [],
    quickRules: [],
    selectedDateTitle: ""
  },

  onShow() {
    this.showShare();
    this.refresh();
  },

  onShareAppMessage() {
    return {
      title: "小熊家务日历",
      path: "/pages/calendar/index"
    };
  },

  onShareTimeline() {
    return {
      title: "小熊家务日历"
    };
  },

  showShare() {
    if (!wx.showShareMenu) return;
    wx.showShareMenu({ menus: ["shareAppMessage", "shareTimeline"] });
  },

  async refresh() {
    try {
      const state = await loadState();
      this.renderState(state);
    } catch (error) {
      console.warn("[小熊读取失败]", error);
      wx.showToast({ title: "读取失败", icon: "none" });
    }
  },

  renderState(state) {
    const safeState = normalizeState(state);
    const selectedDay = this.data.selectedDay || new Date().getDate();
    const calendarYear = this.data.calendarYear;
    const calendarMonth = this.data.calendarMonth;
    const quickRules = [
      ...(safeState.rules?.base || []).map((rule) => ({ ...rule, creditType: "redraw" })),
      ...(safeState.rules?.bonus || []).map((rule) => ({ ...rule, creditType: "exchange" })),
      ...(safeState.rules?.penalty || []).map((rule) => ({ ...rule, creditType: "redraw" }))
    ].map((rule) => ({
      label: rule.label,
      delta: Number(String(rule.value).match(/[-+]?\d+/)?.[0] || 0),
      creditType: rule.creditType,
      tone: Number(String(rule.value).match(/[-+]?\d+/)?.[0] || 0) < 0 ? "minus" : "plus"
    }));
    this.setData({
      dateText: this.formatDate(),
      selectedDay,
      calendarYear,
      calendarMonth,
      calendarMonthText: `${calendarYear}年${calendarMonth + 1}月`,
      calendarDays: this.buildCalendarDays(safeState, selectedDay, calendarYear, calendarMonth),
      state: safeState,
      todayLogs: this.logsForDay(safeState, selectedDay, calendarYear, calendarMonth).map((log) => ({
        ...log,
        displayPerson: safeState.people.find((person) => person.name === log.person)?.displayName || log.person,
        deltaText: this.formatDelta(log)
      })),
      todaySportsLogs: this.sportsLogsForDay(safeState, selectedDay, calendarYear, calendarMonth).map((log) => ({
        ...log,
        displayPerson: safeState.people.find((person) => person.name === log.person)?.displayName || log.person
      })),
      selectedDateTitle: `${calendarMonth + 1}月${selectedDay}日`,
      quickRules
    });
  },

  drawForDay(state, selectedDay, year, month) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
    if (state.drawHistory?.[dateKey]) return state.drawHistory[dateKey];
    if (state.todayId === dateKey && state.draw?.assignments) return state.draw;
    return null;
  },

  formatDelta(log) {
    const amount = Number(log.delta || 0);
    const creditType = log.creditType || (log.type === "增值家务" || log.type === "兑换小熊" ? "exchange" : "redraw");
    const label = creditType === "exchange" ? "申请兑换" : "申请重抽";
    return `${amount > 0 ? "+" : ""}${amount} ${label}`;
  },

  buildCalendarDays(state, selectedDay, year, month) {
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const now = new Date();
    const today = now.getDate();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
    const days = [];

    for (let index = 0; index < firstDay; index += 1) {
      days.push({ key: `empty-${index}`, day: 0, isEmpty: true });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      days.push({
        key: `day-${day}`,
        day,
        isToday: isCurrentMonth && day === today,
        isSelected: day === selectedDay,
        hasLogs: this.logsForDay(state, day, year, month).length > 0,
        hasDraw: Boolean(this.drawForDay(state, day, year, month))
      });
    }

    return days;
  },

  logsForDay(state, selectedDay, year, month) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
    return Object.keys(state.logs || {}).reduce((items, day) => {
      const logs = state.logs[day] || [];
      logs.forEach((log) => {
        if (log.date === dateKey && log.type !== "运动") items.push(log);
      });
      return items;
    }, []);
  },

  sportsLogsForDay(state, selectedDay, year, month) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
    const manualLogs = Object.keys(state.sportsLogs || {}).reduce((items, day) => {
      const logs = state.sportsLogs[day] || [];
      logs.forEach((log) => {
        if (log.date === dateKey) items.push({ ...log, rewardText: "+1 申请重抽" });
      });
      return items;
    }, []);
    const stepWinnerLogs = Object.keys(state.logs || {}).reduce((items, day) => {
      const logs = state.logs[day] || [];
      logs.forEach((log) => {
        if (log.date === dateKey && log.type === "运动" && log.detail === "步数胜者") {
          items.push({ ...log, type: "步数胜者", rewardText: "+1 申请重抽" });
        }
      });
      return items;
    }, []);
    return [...manualLogs, ...stepWinnerLogs];
  },

  formatDate() {
    const date = new Date();
    const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 | ${week}`;
  },

  selectPerson(event) {
    const selectedPerson = event.currentTarget.dataset.name;
    getApp().globalData.currentUser = selectedPerson;
    this.setData({ selectedPerson });
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

  async addLog(event) {
    if (!this.data.selectedPerson) {
      wx.showToast({ title: "请先选择人物", icon: "none" });
      return;
    }
    const label = event.currentTarget.dataset.label;
    const delta = Number(event.currentTarget.dataset.delta || 0);
    const creditType = event.currentTarget.dataset.creditType || "";
    const today = new Date();
    const day = today.getDate();
    const dateKey = formatDateKey(today);
    const id = `log-${dateKey}-${this.data.selectedPerson}-${label}`;
    const state = { ...this.data.state };
    state.logs = state.logs || {};
    state.logs[day] = state.logs[day] || [];
    state.logs[day] = state.logs[day].filter((log) => log.id !== id);
    state.logs[day].push({
      id,
      person: this.data.selectedPerson,
      type: label,
      detail: label,
      delta,
      creditType,
      date: dateKey,
      earnedDay: day,
      createdAt: today.toISOString()
    });
    state.actions = addAction(state, this.data.selectedPerson, "记录家务", label, `action-${id}`);
    try {
      const nextState = normalizeState(state);
      await saveState(nextState);
      this.renderState(nextState);
      wx.showToast({ title: "已记录", icon: "none" });
    } catch (error) {
      console.warn("[小熊保存失败]", error);
      wx.showToast({ title: "保存失败", icon: "none" });
    }
  }
});
