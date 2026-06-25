# 小熊 App

家庭小熊分配、金币规则、家务日历、积分统计的手机端原型。

当前版本是可部署的前端原型：

- 前端：静态 HTML/CSS/JavaScript，已补充 Vite/Vercel 配置。
- 数据：登录后使用 Supabase `app_states` 保存共享线上状态；未登录/未配置时只做临时预览，不再写入本地存储。
- 登录：已经预留 Supabase Auth 入口。未配置环境变量时显示本地原型模式；配置后可以用邮箱 magic link 登录。
- 下一步：把成员、小熊目录、金币规则、家务记录、抽签结果逐步从 mock 数据迁移到 Supabase。

## 本地运行

首次运行：

```bash
corepack enable
pnpm install
pnpm run dev
```

打开终端显示的本地地址，通常是：

```bash
http://127.0.0.1:5173/
```

正式使用请通过 Vite/Vercel 地址打开；`file://` 只适合静态视觉预览，不能用于线上同步。

## 构建

```bash
pnpm run build
pnpm run preview
```

构建产物会输出到 `dist/`。

## 环境变量

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

填入 Supabase 项目里的：

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

配置完成后重新启动本地服务：

```bash
pnpm run dev
```

点击 App 左上角身份胶囊，可以看到登录状态。闪闪鱼和杰尼龟后续应分别使用自己的邮箱登录；登录后仍能切换“当前操作身份”，方便在同一台手机上演示双方视角。

## 部署

推荐使用 Vercel：

1. 把这个项目推送到 GitHub。
2. 在 Vercel 新建项目，选择这个 GitHub 仓库。
3. Framework 选择 Vite。
4. Build Command 使用 `pnpm run build`。
5. Output Directory 使用 `dist`。
6. 如果已经创建 Supabase，在 Vercel 的 Environment Variables 填入 `.env.example` 里的两个变量。

## Supabase

数据库草案在：

```bash
supabase/schema.sql
```

创建 Supabase 项目后，在 SQL Editor 里运行这个文件。它会创建家庭、成员、小熊、心愿小熊、金币规则、日历记录、抽签、兑换申请、金币流水，以及当前线上共享状态 `app_states`。

## 下一步开发顺序

1. 建立家庭空间和邀请码，让两个账号加入同一个家庭。
2. 把成员、小熊目录、金币规则从 mock 数据迁移到 Supabase。
3. 把家务日历和积分记录写入 `daily_logs` 与 `coin_ledger`。
4. 把每日抽签移动到服务端函数，保证每天只能抽一次。
5. 把兑换申请写入 `exchange_requests`，由对方登录后同意。
