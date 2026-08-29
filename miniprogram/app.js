const ALLOWED_USERS = ["闪闪鱼", "杰尼龟"];

App({
  globalData: {
    currentUser: "闪闪鱼",
    currentOpenid: ""
  },

  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: "cloud1-d0g62en3l2c5703f1",
        traceUser: true
      });
    }

    const login = wx.getStorageSync("bearAppLogin");
    if (login?.userName && ALLOWED_USERS.includes(login.userName)) {
      this.globalData.currentUser = login.userName;
      this.globalData.currentOpenid = login.openid || "";
    } else if (login?.userName) {
      wx.removeStorageSync("bearAppLogin");
    }
  },

  onError(error) {
    console.warn("[小熊全局错误]", error);
  },

  onUnhandledRejection(event) {
    console.warn("[小熊未处理 Promise]", event?.reason || event);
  }
});
