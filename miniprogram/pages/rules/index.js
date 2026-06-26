const { DEFAULT_STATE, loadState, normalizeState } = require("../../utils/state");

Page({
  data: {
    state: DEFAULT_STATE
  },

  onShow() {
    this.refresh();
  },

  async refresh() {
    try {
      const state = await loadState();
      this.setData({ state: normalizeState(state) });
    } catch (error) {
      this.setData({ state: normalizeState(DEFAULT_STATE) });
      wx.showToast({ title: "读取失败", icon: "none" });
    }
  }
});
