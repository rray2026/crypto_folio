# CryptoFolio 部署文档

我们为您选择了 `folio.xxlabs.xyz` 作为该项目的子域名。

由于本项目是一个基于 React + Vite 的单页应用 (SPA)，且所有用户数据均加密存储于浏览器的本地数据库 (`IndexedDB`) 中，**无需依靠任何后端数据库或 API 服务器**，因此部署到 Cloudflare 是最完美、最零成本的解决方案。

Cloudflare 为静态前端项目提供了两种部署方式：
1. **Cloudflare Pages** (推荐！专门针对纯前端 SPA 优化，底层依然由 Workers 提供极速分发体验)
2. **Cloudflare Workers Sites** 

配置文档 (`wrangler.toml`) 已在项目中生成，默认使用 **Cloudflare Pages** 规范进行构建输出配置。

---

## 方式一：使用 Wrangler 命令行直接部署 (推荐)

### 1. 安装 Wrangler
在项目中运行以下命令安装 Cloudflare 的官方 CLI 工具：
```bash
npm install -D wrangler
```

### 2. 登录 Cloudflare 账号
```bash
npx wrangler login
```
*这会打开浏览器，引导您授权 Wrangler CLI 访问您的 Cloudflare 账户。*

### 3. 构建并部署
首先构建生产环境代码：
```bash
npm run build
```
然后通过 Pages 发布构建后的 `dist` 目录：
```bash
npx wrangler pages deploy dist --project-name crypto-folio
```
*注意：如果是第一次运行，命令行会询问您是否创建一个新项目，选择 `Create a new project`，然后在后续配置中均按回车默认即可。*

### 4. 绑定自定义子域名 `folio.xxlabs.xyz`
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)。
2. 进入刚刚创建的 **Workers & Pages** -> **crypto-folio**项目。
3. 点击 **Custom domains (自定义域)** 选项卡。
4. 点击 **Set up a custom domain**，输入 `folio.xxlabs.xyz`。
5. CLoudflare 会自动在您的 `xxlabs.xyz` DNS 区域中添加一个 CNAME 记录，点击确认即可。

---

## 方式二：通过 GitHub Actions 持续集成部署 (全自动)

由于您希望通过代码仓库全自动控制部署流程，我们可以利用 `GitHub Actions` 结合 `cloudflare/wrangler-action` 每次在推送代码到 `main` 或 `master` 分支时自动打包并发布到 Cloudflare 的全球边缘网络 (Worker 原生设施)。

### 1. 获取 Cloudflare 凭证
在自动化部署前，GitHub 需要权限来操作您的 Cloudflare 账户：
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)。
2. 获取 **Account ID (账户 ID)**：在您的域名概览页面右侧或 Workers & Pages 侧边栏的右侧拷贝 Account ID。
3. 创建 **API Token**：点击右上角 "My Profile" -> "API Tokens" -> "Create Token"。选择 `Edit Cloudflare Workers` 模板，给与您的账户相应的编辑权限。生成并保存该 Token。

### 2. 配置 GitHub Repository Secrets
1. 进入该项目的 GitHub 仓库页面。
2. 转到 **Settings** -> **Secrets and variables** -> **Actions**。
3. 点击 **New repository secret**，添加以下两个机密信息：
   - `CLOUDFLARE_ACCOUNT_ID`: 填入刚才获取的 Account ID。
   - `CLOUDFLARE_API_TOKEN`: 填入刚才获取的 API Token。

### 3. GitHub Actions 配置文件
我们已经在项目的 `.github/workflows/deploy.yml` 下为您生成了自动化部署脚本。每当您提交并 `git push` 到主分支时，GitHub Actions 就会：
1. 拉取最新代码
2. 安装环境并执行 `npm run build`
3. 通过 `wrangler-action` 将打好的 `dist` 前端包部署至 Cloudflare。

### 4. 绑定自定义子域名 `folio.xxlabs.xyz`
首次通过 GitHub Actions 部署成功后，项目会在 Cloudflare 自动创建。
1. 回到 **Workers & Pages** -> 点击 **crypto-folio**。
2. 并在 **Custom domains (自定义域)** 标签页里绑定 `folio.xxlabs.xyz` 即可。云服务会自动为您处理该域名的 CNAME 解析与 HTTPS 证书。

---

## 路由重定向配置 (SPA 退回策略)
由于是单页应用 (SPA)，所有找不到的路径都需要指向 `index.html` 交由 React Router 处理页面路由跳转。

为了让 Cloudflare 知道这是一个单页应用，在您的 `public/` 目录下我们可以创建一个 `_routes.json` （Vite 打包时默认会将 public 的文件放在 dist 根目录）。但对于大多数 Cloudflare Pages 的预设，平台现在通常会自动进行单页应用的降级处理（SPA Fallback）。

*(注：如果您选择传统 Workers Sites 方式，则需要在 worker.js 脚本中用代码拦截 fetch event 并改写请求)*
