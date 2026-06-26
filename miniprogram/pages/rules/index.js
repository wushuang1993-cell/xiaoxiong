const { DEFAULT_STATE, loadState } = require("../../utils/state");

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
      this.setData({ state });
    } catch (error) {
      wx.showToast({ title: "读取失败", icon: "none" });
    }
  }
});
