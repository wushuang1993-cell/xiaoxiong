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
    quickRules: [],
    quickRuleRows: [[], []],
    selectedDateTitle: ""
  },

  onShow() {
    this.refresh();
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
      ...(safeState.rules?.base || []),
      ...(safeState.rules?.bonus || []),
      ...(safeState.rules?.penalty || [])
    ].map((rule) => ({
      label: rule.label,
      delta: Number(String(rule.value).match(/[-+]?\d+/)?.[0] || 0),
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
      todayLogs: this.logsForDay(safeState, selectedDay, calendarYear, calendarMonth),
      selectedDateTitle: `${calendarMonth + 1}月${selectedDay}日记录`,
      quickRules,
      quickRuleRows: this.splitQuickRules(quickRules)
    });
  },

  splitQuickRules(rules) {
    const middle = Math.ceil((rules || []).length / 2);
    return [(rules || []).slice(0, middle), (rules || []).slice(middle)];
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
        hasLogs: this.logsForDay(state, day, year, month).length > 0
      });
    }

    return days;
  },

  logsForDay(state, selectedDay, year, month) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
    return Object.keys(state.logs || {}).reduce((items, day) => {
      const logs = state.logs[day] || [];
      logs.forEach((log) => {
        if (log.date === dateKey) items.push(log);
      });
      return items;
    }, []);
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
    const day = new Date().getDate();
    const label = event.currentTarget.dataset.label;
    const delta = Number(event.currentTarget.dataset.delta || 0);
    const today = new Date();
    const state = { ...this.data.state };
    state.logs = state.logs || {};
    state.logs[day] = state.logs[day] || [];
    state.logs[day].push({
      person: this.data.selectedPerson,
      type: label,
      detail: label,
      delta,
      date: formatDateKey(today),
      earnedDay: day,
      createdAt: today.toISOString()
    });
    state.actions = addAction(state, this.data.selectedPerson, "记录家务", label);
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
