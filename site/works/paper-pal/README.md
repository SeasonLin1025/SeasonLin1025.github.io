# Paper Pal · AI 论文阅读伴侣

> 三句话精华 + 6 维结构卡片 + PM 视角解读,让每篇论文 30 秒读懂。

[![demo](https://img.shields.io/badge/demo-live-2f9e6b)](https://seasonlin1025.github.io/site/works/paper-pal/)
[![stack](https://img.shields.io/badge/stack-Vanilla%20JS%20%2B%20Gemini-blue)]()
[![license](https://img.shields.io/badge/license-MIT-lightgrey)]()

## 🎯 它解决什么

研究生读论文最痛的三件事:
1. **看不进去** — 30 页英文,半小时读不完摘要
2. **抓不住重点** — 哪是创新点?数据多大?和 baseline 比怎样?
3. **不知道有啥用** — 这玩意儿到底能落地什么产品?

Paper Pal **30 秒**给你答案。

## ✨ 核心功能(MVP)

| 模块 | 说明 |
|---|---|
| ⚡ 三句话精华 | 问题 / 方法 / 结果,200 字读懂全篇 |
| 🧱 6 维结构卡 | 问题 · 方法 · 数据 · 结果 · 不足 · 启示 |
| 🎯 PM 视角 | 这篇论文能做成什么产品?面向哪类用户? |
| 💬 对论文提问 | 自由问答,带原文引用 |
| 📚 历史记录 | 本地存储,随时回看 |

## 🏗️ 架构

```
浏览器                         按需选择
┌──────────────────┐    ┌──────────────────────┐
│ Paper Pal (静态) │ ─► │ A. 用户自己的 Key     │
│  - PDF.js 解析   │    │   localStorage 存储   │
│  - LLM Client    │    │   ↓ 直连              │
│  - Prompts 模板  │    │   Gemini / DeepSeek   │
└──────────────────┘    └──────────────────────┘
                       ┌──────────────────────┐
                       │ B. 试用模式(陌生访客)│
                       │   ↓ 走作者部署的代理   │
                       │   Cloudflare Workers │
                       │   ↓ IP 限频 5次/天     │
                       │   Gemini(作者 Key)   │
                       └──────────────────────┘
```

**为什么这么设计**:
- ✅ 极客 / 你自己 → BYOK,无限用,Key 不上传
- ✅ HR / 同学 → 无需注册,5 次免费体验
- ✅ Cloudflare Workers + Gemini Pro 配额 → **作者零成本**

## 📂 目录

```
paper-pal/
├── index.html              # 主界面
├── app.js                  # 主逻辑(状态机 + 事件)
├── style.css               # 样式
├── lib/
│   ├── llm-client.js       # 多 Provider OpenAI 兼容客户端 + 流式
│   ├── pdf-parser.js       # PDF.js 封装
│   └── prompts.js          # Prompt 模板库 ← 调产品的关键面板
├── workers/
│   ├── proxy.js            # Cloudflare Workers 试用代理
│   ├── wrangler.toml       # 部署配置
│   └── README.md           # 5 分钟部署指南
├── PRD.md                  # 完整 PRD(22 功能 / 11 章 / 4500 字)
└── README.md               # 你正在看的
```

## 🚀 本地运行

```bash
# 1. 用任意静态服务器跑(因为用了 ESM)
cd site/works/paper-pal
python -m http.server 8080
# 或 npx serve .
```

打开 http://localhost:8080,点 ⚙️ 贴入 Gemini Key 即可。

## 📖 完整文档

- [`PRD.md`](./PRD.md) — 产品需求文档(完整版)
- [`workers/README.md`](./workers/README.md) — 试用代理部署指南

## 🎓 这是谁做的

**林熙哲** · 武汉大学 · 京东产品实习 · 目标 AI 产品经理岗
[seasonlin1025.github.io](https://seasonlin1025.github.io)