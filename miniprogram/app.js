App({
  globalData: {
    apiBaseUrl: "https://xiaoxiong-opal.vercel.app",
    currentUser: "闪闪鱼",
    currentEmail: ""
  },

  onLaunch() {
    const login = wx.getStorageSync("bearAppLogin");
    if (login?.userName) {
      this.globalData.currentUser = login.userName;
      this.globalData.currentEmail = login.email || "";
    }
  }
});
