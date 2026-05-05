# SeasonLin1025.github.io · 个人简历与作品集

> 一份数据源 → 同步驱动「在线网站」+「像素级 PDF」双形态简历系统  
> 配合 vibe coding 工作流，针对每个目标岗位 5 分钟生成定制版本

🌐 在线访问：<https://seasonlin1025.github.io>

---

## ✨ 特性

- **单一数据源**：所有简历内容都在 [`data/resume.json`](data/resume.json:1)，改一处两端同步
- **科技极客风网站**：霓虹色 + 终端感 + 时间轴 + 数据指标自动高亮
- **像素级 PDF**：Puppeteer 打印 A4，中文字体清晰，可直接投递 HR 系统
- **Vibe Coding 作品集**：作品 iframe 内嵌可在线体验
- **针对岗位定制**：复制 JSON 文件即可生成不同版本简历
- **自动部署**：push 到 main 分支 → GitHub Actions 自动构建 PDF + 发布 Pages

---

## 📁 目录结构

```
SeasonLin1025.github.io/
├── data/
│   └── resume.json              # ⭐ 主数据源（你只需改这个文件）
├── pdf/
│   ├── resume-print.css         # PDF 专用打印样式
│   ├── resume-print.html        # （由脚本动态生成 _rendered.html）
│   └── build-pdf.js             # Puppeteer 打印脚本
├── site/                        # 在线简历站（GitHub Pages 部署目录）
│   ├── index.html
│   ├── assets/
│   │   ├── style.css
│   │   └── main.js
│   ├── data/                    # 由 sync 脚本自动同步
│   └── works/
│       └── med-manager/         # Vibe Coding 作品 1
├── scripts/
│   └── sync-data.js             # 同步 data/ 与 PDF 到 site/
├── .github/workflows/
│   └── deploy.yml               # 自动部署
├── package.json
└── resume.pdf                   # 生成的 PDF（投递用）
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

> 首次安装 Puppeteer 会下载约 170MB 的 Chromium，耐心等待。

### 2. 本地预览网站

```bash
npm run dev
```
浏览器打开 <http://localhost:5173>。

### 3. 生成 PDF（默认通用版）

```bash
npm run build:pdf
# 输出：./resume.pdf
```

### 4. 一键全量构建（PDF + 同步到 site）

```bash
npm run build
```

---

## 🎯 Vibe Coding 工作流：针对岗位定制简历

假设你要投字节跳动 AI 产品实习：

**Step 1.** 复制数据文件：
```bash
cp data/resume.json data/resume-bytedance-aipm.json
```

**Step 2.** 把 JD 和 `resume.json` 一起贴给 AI 助手：
> "这是字节 AI 产品实习 JD：[粘贴]，请基于 resume.json 改写每段 internships.highlights，让关键词更贴合，保留所有数据，不要造假。输出完整新 JSON。"

**Step 3.** 保存为 `data/resume-bytedance-aipm.json`，然后构建：
```bash
node pdf/build-pdf.js --data=data/resume-bytedance-aipm.json --out=简历-字节AI-林熙哲.pdf
```

**Step 4.** 投递。在线版仍然是通用版（首页 PDF 按钮指向 `resume.pdf`），HR 看到链接进站点能看到全貌。

---

## 🛠 部署到 GitHub Pages

1. 仓库已经是 `SeasonLin1025/SeasonLin1025.github.io` 命名（Pages 自动识别）
2. 仓库 Settings → Pages → Source 选 **GitHub Actions**
3. 推送代码到 main 分支：
   ```bash
   git add .
   git commit -m "init resume site"
   git push origin main
   ```
4. 等 1-2 分钟，访问 <https://seasonlin1025.github.io>

---

## 📝 修改简历内容指南

1. **改文字**：直接编辑 [`data/resume.json`](data/resume.json:1)
2. **改 PDF 排版**：编辑 [`pdf/resume-print.css`](pdf/resume-print.css:1)
3. **改网站样式**：编辑 [`site/assets/style.css`](site/assets/style.css:1)
4. **加新作品**：
   - 在 `site/works/` 下新建子目录，放静态资源
   - 在 `data/resume.json` 的 `works` 数组里加一项
5. **改主题色**：编辑 [`site/assets/style.css`](site/assets/style.css:1) 顶部 `:root` 里的 CSS 变量

---

## 🎨 设计 Token

| 变量 | 值 | 用途 |
|------|------|------|
| `--bg` | `#0a0e14` | 深空背景 |
| `--accent` | `#39ff14` | 霓虹绿（主色） |
| `--accent-alt` | `#00d9ff` | 青蓝（次色） |
| `--accent-warm` | `#ff6b35` | 暖橙（数据指标高亮） |
| `--font-mono` | JetBrains Mono | 代码/数据/标签 |

---

## 🔗 相关文件

- [`data/resume.json`](data/resume.json:1) — 简历数据源
- [`pdf/build-pdf.js`](pdf/build-pdf.js:1) — PDF 构建脚本
- [`site/assets/main.js`](site/assets/main.js:1) — 站点渲染逻辑
- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml:1) — CI/CD 配置

---

## 🪪 License

MIT · © 林熙哲