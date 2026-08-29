const { DEFAULT_STATE, addAction, formatDateKey, loadState, normalizeState, saveState } = require("../../utils/state");

function scoreFor(sport, duration) {
  return Math.max(0, Math.round(Number(duration || 0) * Number(sport?.rate || 1)));
}

Page({
  data: {
    dateText: "",
    state: DEFAULT_STATE,
    selectedPerson: "",
    sportTypes: DEFAULT_STATE.sportRules,
    sportTypeIndex: 0,
    selectedSportLabel: DEFAULT_STATE.sportRules[0].label,
    duration: "30",
    todayLogs: [],
    sportRanking: [],
    stepRanking: [],
    stepsInput: "",
    sportsEditing: false,
    newSportName: "",
    newSportRate: "1"
  },

  onShow() {
    this.showShare();
    this.refresh();
  },

  onShareAppMessage() {
    return {
      title: "小熊运动排行",
      path: "/pages/sports/index"
    };
  },

  onShareTimeline() {
    return {
      title: "小熊运动排行"
    };
  },

  showShare() {
    if (!wx.showShareMenu) return;
    wx.showShareMenu({ menus: ["shareAppMessage", "shareTimeline"] });
  },

  async refresh() {
    try {
      this.renderState(await loadState());
    } catch (error) {
      console.warn("[小熊运动读取失败]", error);
      wx.showToast({ title: "读取失败", icon: "none" });
    }
  },

  renderState(state) {
    const safeState = normalizeState(state);
    const selectedPerson = this.data.selectedPerson || safeState.people[0]?.name || "";
    const sportTypes = safeState.sportRules || DEFAULT_STATE.sportRules;
    const sportTypeIndex = Math.min(this.data.sportTypeIndex, Math.max(0, sportTypes.length - 1));
    this.setData({
      dateText: this.formatDate(),
      state: safeState,
      selectedPerson,
      sportTypes,
      sportTypeIndex,
      selectedSportLabel: sportTypes[sportTypeIndex]?.label || "运动",
      todayLogs: this.logsForToday(safeState).map((log) => ({
        ...log,
        displayPerson: safeState.people.find((person) => person.name === log.person)?.displayName || log.person
      })),
      sportRanking: this.buildSportRanking(safeState),
      stepRanking: this.buildStepRanking(safeState)
    });
  },

  formatDate() {
    const date = new Date();
    const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 | ${week}`;
  },

  logsForToday(state) {
    const todayId = formatDateKey();
    return Object.values(state.sportsLogs || {}).flat().filter((log) => log.date === todayId);
  },

  buildSportRanking(state) {
    const logs = this.logsForToday(state);
    return (state.people || [])
      .map((person) => {
        const personLogs = logs.filter((log) => log.person === person.name);
        return {
          name: person.name,
          displayName: person.displayName || person.name,
          image: person.image,
          count: personLogs.length,
          duration: personLogs.reduce((sum, log) => sum + Number(log.duration || 0), 0),
          score: personLogs.reduce((sum, log) => sum + Number(log.score || 0), 0)
        };
      })
      .sort((a, b) => b.score - a.score || b.count - a.count);
  },

  buildStepRanking(state) {
    const todayId = formatDateKey();
    const steps = Object.values(state.wechatSteps || {}).flat().filter((item) => item.date === todayId);
    return (state.people || [])
      .map((person) => {
        const row = steps.find((item) => item.person === person.name || item.openid === person.openid);
        return {
          name: person.name,
          displayName: person.displayName || person.name,
          image: person.image,
          steps: Number(row?.steps || 0)
        };
      })
      .sort((a, b) => b.steps - a.steps);
  },

  selectPerson(event) {
    this.setData({ selectedPerson: event.currentTarget.dataset.name });
  },

  onSportTypeChange(event) {
    const index = Number(event.detail.value || 0);
    this.setData({ sportTypeIndex: index, selectedSportLabel: this.data.sportTypes[index].label });
  },

  onDurationInput(event) {
    this.setData({ duration: String(event.detail.value || "").replace(/[^\d]/g, "").slice(0, 3) });
  },

  onStepsInput(event) {
    this.setData({ stepsInput: String(event.detail.value || "").replace(/[^\d]/g, "").slice(0, 6) });
  },

  toggleSportsEditing() {
    this.setData({ sportsEditing: !this.data.sportsEditing });
  },

  onNewSportNameInput(event) {
    this.setData({ newSportName: String(event.detail.value || "").slice(0, 8) });
  },

  onNewSportRateInput(event) {
    this.setData({ newSportRate: String(event.detail.value || "").replace(/[^\d.]/g, "").slice(0, 4) });
  },

  async addSportRule() {
    const label = String(this.data.newSportName || "").trim();
    const rate = Number(this.data.newSportRate || 1);
    if (!label || !rate) {
      wx.showToast({ title: "填写运动名称和系数", icon: "none" });
      return;
    }
    const state = normalizeState(this.data.state);
    if ((state.sportRules || []).some((rule) => rule.label === label)) {
      wx.showToast({ title: "运动已存在", icon: "none" });
      return;
    }
    state.sportRules = [...(state.sportRules || []), { key: `sport-${Date.now()}`, label, rate }];
    state.actions = addAction(state, this.data.selectedPerson || "未登录", "新增运动项目", label);
    this.setData({ newSportName: "", newSportRate: "1" });
    await this.saveSportsState(state, "已新增运动");
  },

  async deleteSportRule(event) {
    const key = event.currentTarget.dataset.key;
    const label = event.currentTarget.dataset.label;
    const state = normalizeState(this.data.state);
    if ((state.sportRules || []).length <= 1) {
      wx.showToast({ title: "至少保留 1 项运动", icon: "none" });
      return;
    }
    state.sportRules = (state.sportRules || []).filter((rule) => (rule.key || rule.label) !== key);
    state.actions = addAction(state, this.data.selectedPerson || "未登录", "删除运动项目", label);
    await this.saveSportsState(state, "已删除运动", { deletedSportRules: [key] });
  },

  async saveSportsState(state, message, mergeOptions = {}) {
    try {
      await saveState(state, mergeOptions);
      this.renderState(state);
      wx.showToast({ title: message, icon: "none" });
    } catch (error) {
      console.warn("[小熊运动保存失败]", error);
      wx.showToast({ title: "保存失败", icon: "none" });
    }
  },

  async addSportLog() {
    if (!this.data.selectedPerson) {
      wx.showToast({ title: "先选择成员", icon: "none" });
      return;
    }
    const sport = this.data.sportTypes[this.data.sportTypeIndex] || this.data.sportTypes[0];
    const duration = Number(this.data.duration || 0);
    if (duration <= 0) {
      wx.showToast({ title: "填写运动时长", icon: "none" });
      return;
    }
    const now = new Date();
    const day = now.getDate();
    const state = normalizeState(this.data.state);
    state.sportsLogs = state.sportsLogs || {};
    state.sportsLogs[day] = state.sportsLogs[day] || [];
    state.sportsLogs[day].push({
      id: `sport-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      person: this.data.selectedPerson,
      type: sport.label,
      typeKey: sport.key,
      duration,
      score: scoreFor(sport, duration),
      date: formatDateKey(now),
      earnedDay: day,
      createdAt: now.toISOString()
    });
    state.actions = addAction(state, this.data.selectedPerson, "记录运动", sport.label);
    await this.saveSportsState(state, "已记录运动");
  },

  async saveManualSteps() {
    if (!this.data.selectedPerson) {
      wx.showToast({ title: "先选择成员", icon: "none" });
      return;
    }
    const steps = Number(this.data.stepsInput || 0);
    if (steps <= 0) {
      wx.showToast({ title: "填写微信步数", icon: "none" });
      return;
    }
    const now = new Date();
    const day = now.getDate();
    const state = normalizeState(this.data.state);
    const person = state.people.find((item) => item.name === this.data.selectedPerson);
    state.wechatSteps = state.wechatSteps || {};
    state.wechatSteps[day] = (state.wechatSteps[day] || []).filter((item) => item.person !== this.data.selectedPerson);
    state.wechatSteps[day].push({
      id: `steps-${formatDateKey(now)}-${this.data.selectedPerson}`,
      person: this.data.selectedPerson,
      openid: person?.openid || "",
      steps,
      date: formatDateKey(now),
      createdAt: now.toISOString()
    });
    state.actions = addAction(state, this.data.selectedPerson, "更新微信步数", `${steps}`);
    await this.saveSportsState(state, "步数已更新");
  },

  syncWechatSteps() {
    if (!wx.getWeRunData) {
      wx.showModal({
        title: "暂不支持",
        content: "当前微信版本不支持读取微信步数。",
        showCancel: false
      });
      return;
    }
    wx.showModal({
      title: "微信步数接入说明",
      content: "微信步数需要用户授权，并通过云函数解密后才能写入运动排行。本版先保留入口，可先手动填写步数。",
      confirmText: "去授权",
      success: (result) => {
        if (!result.confirm) return;
        wx.getWeRunData({
          success: () => wx.showToast({ title: "已获得授权，待云端解密接入", icon: "none" }),
          fail: () => wx.showToast({ title: "未授权微信步数", icon: "none" })
        });
      }
    });
  }
});
