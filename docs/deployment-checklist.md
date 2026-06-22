# 部署操作清单

## 你需要准备的账号

- GitHub：存放代码。
- Vercel：部署前端 App。
- Supabase：登录、数据库、图片存储。

## 第一步：安装本地依赖

在项目目录运行：

```bash
corepack enable
pnpm install
```

然后本地启动：

```bash
pnpm run dev
```

如果能打开本地地址并看到小熊 App，说明部署前端的基础配置没问题。

## 第二步：推送到 GitHub

```bash
git add .
git commit -m "Prepare app for deployment"
git branch -M main
git remote add origin <你的 GitHub 仓库地址>
git push -u origin main
```

如果已经有 remote，就只需要：

```bash
git add .
git commit -m "Prepare app for deployment"
git push
```

## 第三步：部署到 Vercel

1. 打开 Vercel。
2. New Project。
3. Import GitHub Repository。
4. 选择小熊 App 仓库。
5. 确认：
   - Framework Preset: Vite
   - Build Command: `pnpm run build`
   - Output Directory: `dist`
6. Deploy。

部署完成后，Vercel 会给你一个线上链接。

## 第四步：创建 Supabase 项目

1. 打开 Supabase。
2. New Project。
3. 创建项目后进入 SQL Editor。
4. 打开本项目的 `supabase/schema.sql`。
5. 复制全部 SQL 到 Supabase SQL Editor。
6. Run。

## 第五步：设置环境变量

在 Supabase Project Settings 里找到：

- Project URL
- anon public key

在 Vercel 项目设置里添加：

```bash
VITE_SUPABASE_URL=<Project URL>
VITE_SUPABASE_ANON_KEY=<anon public key>
```

本地开发时，把同样的值填入 `.env.local`。

## 第六步：后续真实登录和数据接入

登录入口已经在 App 左上角身份胶囊里预留：

1. 没有配置 Supabase 环境变量时，显示“本地原型模式”。
2. 配置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 后，显示邮箱登录。
3. 闪闪鱼和杰尼龟分别用自己的邮箱登录。
4. 登录后，App 仍然显示共同家庭数据；每条记录后续会写入当前登录账号的 `user_id`。

后续还需要继续开发的数据接入顺序：

1. 家庭初始化：闪闪鱼创建家庭，杰尼龟通过邀请码加入。
2. 读取数据库：替换当前 mock `state.people`、`state.bears`、`state.rules`。
3. 写入数据库：日历记录、金币流水、心愿小熊、小熊目录。
4. 抽签服务端化：用 Supabase Edge Function 保证每天只能抽一次。
