# 小熊 App 微信小程序适配说明

## 当前适配内容

仓库已新增 `miniprogram/` 原生小程序工程，可以用微信开发者工具打开。

第一版包含：

- 小熊摇奖页：显示双方金币、今日抽签结果、防作弊操作记录。
- 家务日历页：按人记录家务、增值家务和扣分。
- 金币规则页：读取线上规则。
- Vercel API：`api/state.js` 作为小程序和 Supabase 之间的桥接层。

## 为什么需要 Vercel API

微信小程序不能直接复用网页的邮箱 Magic Link 登录流程。小程序端也不应该暴露 Supabase service role key。

因此第一版小程序请求：

```text
https://xiaoxiong-opal.vercel.app/api/state
```

Vercel API 再使用服务端环境变量写入 Supabase `app_states`。

## 你需要在 Vercel 增加的变量

进入 Vercel 项目：

```text
Settings -> Environment Variables
```

保留已有变量：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

新增服务端变量：

```text
SUPABASE_SERVICE_ROLE_KEY
```

这个值在 Supabase 项目设置里找。它是服务端密钥，不能写进小程序，也不要发给别人。

新增后需要重新部署 Vercel。

## 你需要在微信公众平台设置

进入微信公众平台小程序后台：

```text
开发管理 -> 开发设置 -> 服务器域名
```

在 `request 合法域名` 增加：

```text
https://xiaoxiong-opal.vercel.app
```

## 微信开发者工具

1. 安装微信开发者工具。
2. 导入项目，目录选择：

```text
/Users/wushuangmacmini/Desktop/小熊App/miniprogram
```

3. 把 `project.config.json` 里的 `appid` 从 `touristappid` 改成你的小程序 AppID。
4. 点击编译。

## 后续正式版建议

当前小程序第一版复用 Supabase `app_states` 共享状态。上线后建议继续升级为：

- 微信登录：使用 `wx.login` 换取 openid，并绑定闪闪鱼/杰尼龟身份。
- 服务端权限：Vercel API 校验 openid 后才能写数据。
- 数据结构：从单一 `app_states` JSON 拆成抽签、金币流水、规则、成员、小熊目录等独立表。
- 审计：抽签、重抽、兑换、同意操作全部写入不可编辑流水表。
