# Paper Pal · 试用代理部署指南

让陌生访客(HR / 同学)无需注册任何 Key,点开你的简历就能直接体验 Paper Pal。

**总耗时:5 分钟。完全免费。**

---

## 🎯 这个 Worker 干什么

```
访客浏览器 → 你的 Worker → Google Gemini API
```

- Worker 在请求里**注入你的 Gemini Key**(前端永远拿不到)
- 每个 IP **每天只能用 5 次**(防止被薅羊毛)
- 用 **Cloudflare KV** 存计数,免费额度 10 万次/天足够

---

## 📋 准备工作(5 分钟)

### 1️⃣ 申请 Gemini API Key(免费)

1. 用 Gemini Pro 会员的 Google 账号登录 https://aistudio.google.com/apikey
2. 点 **Create API key** → 复制 `AIza...` 开头的字符串

### 2️⃣ 注册 Cloudflare 账号(免费)

1. https://dash.cloudflare.com/sign-up
2. 不需要域名,直接用 `*.workers.dev` 子域

### 3️⃣ 安装 wrangler(Cloudflare 官方 CLI)

```bash
npm install -g wrangler
wrangler login    # 浏览器授权
```

---

## 🚀 部署步骤

### 步骤 1:创建 KV 命名空间

```bash
cd site/works/paper-pal/workers
wrangler kv:namespace create RATE_KV
```

输出会包含一行 `id = "xxxxx..."`,**复制这个 id**。

打开 [`wrangler.toml`](./wrangler.toml),把 `REPLACE_WITH_YOUR_KV_ID` 替换成刚才的 id。

### 步骤 2:注入 Gemini Key(secret)

```bash
wrangler secret put GEMINI_KEY
```

粘贴你的 Gemini Key,回车。它会被加密存储,代码里看不到。

### 步骤 3:部署

```bash
wrangler deploy
```

输出会告诉你 Worker 的 URL,形如:
```
https://paper-pal-proxy.你的用户名.workers.dev
```

### 步骤 4:测试是否工作

```bash
curl https://paper-pal-proxy.你的用户名.workers.dev/health
# 应返回 {"ok":true,"service":"Paper Pal Trial Proxy",...}
```

### 步骤 5:接入前端

打开 [`../lib/llm-client.js`](../lib/llm-client.js),把:
```js
export const TRIAL_PROXY_URL = '';
```
改成:
```js
export const TRIAL_PROXY_URL = 'https://paper-pal-proxy.你的用户名.workers.dev';
```

提交 push,GitHub Pages 自动更新。**搞定。**

---

## 🔧 调整配置

| 参数 | 位置 | 说明 |
|---|---|---|
| `DAILY_LIMIT` | wrangler.toml | 每 IP 每天调用次数,默认 5 |
| `MODEL` | wrangler.toml | 默认模型,可改 `gemini-2.5-pro` |
| `GEMINI_KEY` | secret | `wrangler secret put GEMINI_KEY` 重置 |

修改后重新 `wrangler deploy` 即可。

---

## 💰 成本

| 项 | 免费额度 | Paper Pal 实际用量 |
|---|---|---|
| Workers 请求 | **10 万次/天** | <100/天 |
| KV 读写 | **10万读/1000写 每天** | <500读 / <100写 |
| Gemini 2.5 Flash | **几乎无限** | 由你的 Pro 配额承担 |
| **月成本** | | **¥0** |

---

## 🛡️ 安全说明

- ✅ Gemini Key 存在 Cloudflare Secret 里,前端 F12 也偷不到
- ✅ 每 IP 每天 5 次,防止被恶意刷
- ✅ 单次请求体限制 200KB,防止超大 prompt
- ✅ KV 计数 24h 自动过期,无需维护

---

## 🐛 故障排查

- **CORS 报错**:确认 Worker 已部署最新版,代码里有 `Access-Control-Allow-Origin: *`
- **429 Too Many**:正常,该 IP 今日额度已用完
- **500 错误**:打开 Cloudflare Dashboard → Workers → Logs,看具体错误
- **流式不生效**:Worker 已透传上游 stream,如果不工作多半是浏览器端问题