const { DEFAULT_STATE, addAction, loadState, normalizeState, saveState } = require("../../utils/state");

Page({
  data: {
    dateText: "",
    selectedPerson: "闪闪鱼",
    selectedDay: new Date().getDate(),
    weekDays: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
    calendarDays: [],
    state: { people: [], logs: {}, rules: {} },
    todayLogs: [],
    quickRules: []
  },

  onShow() {
    this.refresh();
  },

  async refresh() {
    try {
      const state = await loadState();
      this.renderState(state);
    } catch (error) {
      this.renderState(normalizeState(DEFAULT_STATE));
      wx.showToast({ title: "读取失败", icon: "none" });
    }
  },

  renderState(state) {
    const safeState = normalizeState(state);
    const selectedDay = this.data.selectedDay || new Date().getDate();
    const quickRules = [
      ...(safeState.rules?.base || []),
      ...(safeState.rules?.bonus || []),
      ...(safeState.rules?.penalty || [])
    ].map((rule) => ({
      label: rule.label,
      delta: Number(String(rule.value).match(/[-+]?\d+/)?.[0] || 0)
    }));
    this.setData({
      dateText: this.formatDate(),
      selectedDay,
      calendarDays: this.buildCalendarDays(safeState, selectedDay),
      state: safeState,
      todayLogs: safeState.logs?.[selectedDay] || [],
      quickRules
    });
  },

  buildCalendarDays(state, selectedDay) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const today = now.getDate();
    const days = [];

    for (let index = 0; index < firstDay; index += 1) {
      days.push({ key: `empty-${index}`, day: 0, isEmpty: true });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      days.push({
        key: `day-${day}`,
        day,
        isToday: day === today,
        isSelected: day === selectedDay,
        hasLogs: Boolean(state.logs?.[day]?.length)
      });
    }

    return days;
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

  async addLog(event) {
    const day = new Date().getDate();
    const label = event.currentTarget.dataset.label;
    const delta = Number(event.currentTarget.dataset.delta || 0);
    const state = { ...this.data.state };
    state.logs = state.logs || {};
    state.logs[day] = state.logs[day] || [];
    state.logs[day].push({
      person: this.data.selectedPerson,
      type: label,
      detail: label,
      delta
    });
    const person = state.people.find((item) => item.name === this.data.selectedPerson);
    if (person) person.coins += delta;
    state.actions = addAction(state, this.data.selectedPerson, "记录家务", label);
    try {
      await saveState(state);
      this.renderState(state);
      wx.showToast({ title: "已记录", icon: "none" });
    } catch (error) {
      wx.showToast({ title: "保存失败", icon: "none" });
    }
  }
});
