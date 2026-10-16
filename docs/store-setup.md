# 商店上架凭据配置指南

`publish-store.yml` 读取 7 个 GitHub Secrets。本文说明每个值的**从哪拿**、**在哪配**，以及配置完成后如何自检。

---

## 0. 配置位置

所有凭据统一配置在：

```
https://github.com/liqiuqiui/modheader2/settings/secrets/actions
```

路径：仓库首页 → 顶部 `Settings` → 左侧 `Secrets and variables` → `Actions` → `Secrets` 标签页 →右上角 `New repository secret`。

> 用 CLI 配置更方便（值不回显）：
>
> ```bash
> gh secret set CHROME_EXTENSION_ID
> gh secret set CHROME_CLIENT_ID
> ...
> ```

**注意仓库无本地环境要求**：这些值只在 GitHub Actions 运行时使用，不要写进 `.env` 提交到仓库。

---

## 1. 前置条件：首次发布必须手动上传一次

**API 只能更新已存在的商店条目，没有「创建新条目」的端点。** 所以两个商店都要先各自手动走一遍上架流程，才能拿到 ID 并让 API 接管后续版本。

| 商店             | 手动上架入口                                          | 费用      |
| ---------------- | ----------------------------------------------------- | --------- |
| Chrome Web Store | https://chrome.google.com/webstore/devconsole         | 一次性 $5 |
| Edge Add-ons     | https://partner.microsoft.com/dashboard/microsoftedge | 免费      |

两个商店都要求：填完 **Store listing**（描述、图标、截图）和 **Privacy**（隐私政策）标签页，API 才能发布新版本。

---

## 2. Chrome Web Store（4 个值）

### 2.1 `CHROME_EXTENSION_ID`

**从哪拿**：手动上传一次后，开发者后台每个条目的 URL 里就是 ID：

```
https://chrome.google.com/webstore/devconsole/<这就是扩展 ID>
```

也可以在后台条目详情的「扩展程序 ID」一栏直接复制。

**性质**：公开标识，不是机密。首次发布时由 Google 分配。

### 2.2 启用 API 与创建 OAuth 客户端

需要先在 Google Cloud Console 里操作：

| 步骤                      | URL                                                                         |
| ------------------------- | --------------------------------------------------------------------------- |
| 新建/选择项目             | https://console.cloud.google.com/                                           |
| 启用 Chrome Web Store API | https://console.cloud.google.com/apis/library/chromewebstore.googleapis.com |
| 配置 OAuth 同意屏幕       | https://console.cloud.google.com/apis/credentials/consent                   |
| 创建客户端凭据            | https://console.cloud.google.com/apis/credentials                           |

**配置同意屏幕时**：

- 用户类型选 `External`
- 填应用名称、支持邮箱、开发者联系邮箱
- Scopes 页面可以跳过
- **`Test users` 必须把自己的Google 账号加进去** —— 加了才能立即使用，无需等 Google 的正式审核

**创建凭据时**：

- 应用类型选 **`Web application`**（不是 Desktop app —— 用 Playground 换 token 时必须是这个类型，否则报 `unauthorized_client`）
- 授权重定向 URI 填：`https://developers.google.com/oauthplayground`

### 2.3 `CHROME_CLIENT_ID` / `CHROME_CLIENT_SECRET`

**从哪拿**：上一步创建凭据后弹窗显示，或在 https://console.cloud.google.com/apis/credentials 列表里点进该凭据查看。

**性质**：机密。三个 Chrome 值必须来自**同一个 OAuth 客户端**，混用会失败。

### 2.4 `CHROME_REFRESH_TOKEN`

**从哪拿**：在 OAuth Playground 用上面的 client id/secret 换一次。

1. 打开 https://developers.google.com/oauthplayground
2. 点右上角齿轮图标 → 勾选 `Use your own OAuth credentials`
3. 填入刚才的 Client ID 与 Client Secret
4. 在 `Input your own scopes` 填：
   ```
   https://www.googleapis.com/auth/chromewebstore
   ```
5. 点 `Authorize APIs`，用**拥有该商店条目的那个 Google 账号**登录并同意
6. 点 `Exchange authorization code for tokens`
7. 展开响应 JSON，取 `refresh_token` 字段

**性质**：机密，且是长期有效的核心凭据。只在本地换一次，之后 CI 靠它自动续期 access token。

> 登录账号必须**拥有该扩展条目**。用别的账号换取 token，上传时会返回 `Unauthorized`。

---

## 3. Microsoft Edge Add-ons（3 个值）

### 3.1 手动创建产品

先在 Partner Center 手动提交一次，拿到产品页面：

```
https://partner.microsoft.com/dashboard/microsoftedge
```

导航：左侧 `Microsoft Edge` → `Overview` → 选择你的扩展 → 进入扩展概览页。

### 3.2 `EDGE_PRODUCT_ID`

**从哪拿**：在上述扩展概览页，「Extension identity」区域的 **Product ID**。

也就是浏览器地址栏里 `microsoftedge/` 和 `/packages` 之间那段 GUID：

```
https://partner.microsoft.com/dashboard/microsoftedge/<Product ID 就是这段>/packages
```

**性质**：公开标识，不是机密。

### 3.3 `EDGE_CLIENT_ID` / `EDGE_API_KEY`

**从哪拿**：Partner Center 左侧 `Microsoft Edge` → **`Publish API`**：

```
https://partner.microsoft.com/dashboard/microsoftedge/publishapi
```

先点 `Enable API`，再点 `Create API credentials`，会得到 Client ID 和一串 API key。

**性质**：机密。

> ⚠️ **API key 有有效期**，需要记录到期日，到期前重新生成并更新 secret。

### 3.4 Edge 的两条硬性限制

1. **只有 v1.1 可用。** 旧的 v1 流程（用 client secret 换 access token）已于 2024 年底停止支持。网上不少文章还在讲 v1，照抄会拿到 401。`publish-store.yml` 用的正是 v1.1 方式。
2. **包内不能含压缩文件。** Edge 校验器读文件头魔数，zip 里若含 gzip（`1f8b`）或嵌套 zip（`504b`）会被拒。Chrome 和 Mozilla 允许，**只有 Edge 拒绝**。

   已验证：当前 `.output/modheader-v2-1.0.0-edge.zip` 的 15 个条目中**无嵌套压缩文件**，可通过校验。以后若引入 gzipped 数据文件，需在构建期展开。

---

## 4. 需要清理的旧值

代码已移除 Firefox 支持（规则下发依赖 `declarativeNetRequest`，是 MV3 能力，MV2 产物无法工作），以下 secrets 已无人引用，建议在 Secrets 页面删除：

- `FIREFOX_EXTENSION_ID`
- `FIREFOX_JWT_ISSUER`
- `FIREFOX_JWT_SECRET`

---

## 5. 配置完成后自检

### 5.1 干跑验证凭据

在 https://github.com/liqiuqiui/modheader2/actions/workflows/publish-store.yml 点`Run workflow`：

- `tag`：填一个**已发布**的 tag，例如 `v1.0.0`
- `dry_run`：勾选true

干跑会验证凭据和产物，但不会真正提交审核。

### 5.2 确认 secrets 已存在

```bash
gh secret list
```

应看到 7 个条目。**GitHub 不会显示 secret 的值**，只能确认存在性。

### 5.3 常见报错对照

| 报错                       | 原因                                                     | 处理                                         |
| -------------------------- | -------------------------------------------------------- | -------------------------------------------- |
| `invalid_grant`            | refresh token 过期或被吊销                               | 重新走2.4 换取                               |
| `unauthorized_client`      | 客户端不是 `Web application` 类型，或三个Chrome 值不配套 | 用同一 Web application 客户端重新生成三项    |
| `Unauthorized`（上传阶段） | 登录账号不拥有该条目；或后台改动后未手动发布过           | 用条目所有者账号换 token；在后台手动发布一次 |
| `publisherId is required`  | 误用了 v2 API                                            | 本仓库走 v1.1，不涉及                        |
| Edge 返回 200 但校验失败   | 包内含压缩文件                                           | 展开压缩文件后重新打包                       |

---

## 6. 完整发布流程

```
① 配置 7 个 secrets（需先在两个商店各手动上架一次）
② 确认 .github/RELEASE_NOTES.md 文案无误
③ git tag v1.0.0 && git push --follow-tags
④ release.yml：构建 chrome/edge/opera 三端 zip → 建草稿 Release
⑤ 在 GitHub Release 页面核对正文，点 Publish
⑥ publish-store.yml 自动触发 → 提交 Chrome/Edge 审核
⑦ 商店审核通过后，在README 补商店链接
```

第 ⑤ 步是本次流水线重构的核心收益：**发布说明在提交商店审核之前有人核对过一遍**。
