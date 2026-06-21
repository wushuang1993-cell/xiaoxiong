# 小熊 App

家庭小熊分配、金币规则、家务日历、积分统计的手机端原型。

当前版本是可部署的前端原型：

- 前端：静态 HTML/CSS/JavaScript，已补充 Vite/Vercel 配置。
- 数据：当前仍使用 mock 数据和浏览器本地存储。
- 下一步：接入 Supabase Auth、Postgres、Storage，把两个人的登录和真实数据存储上线。

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

也可以继续直接打开 `index.html` 预览原型。

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

创建 Supabase 项目后，在 SQL Editor 里运行这个文件。它会创建家庭、成员、小熊、心愿小熊、金币规则、日历记录、抽签、兑换申请和金币流水等表。

## 下一步开发顺序

1. 接入 Supabase Auth，让闪闪鱼和杰尼龟分别登录。
2. 建立家庭空间和邀请码，让两个账号加入同一个家庭。
3. 把成员、小熊目录、金币规则从 mock 数据迁移到 Supabase。
4. 把家务日历和积分记录写入 `daily_logs` 与 `coin_ledger`。
5. 把每日抽签移动到服务端函数，保证每天只能抽一次。
6. 把兑换申请写入 `exchange_requests`，由对方登录后同意。
