# SeasonLin1025.github.io · 个人简历与作品集

> 一份数据源 → 同步驱动「在线网站」+「像素级 PDF」双形态简历系统
> 配合 vibe coding 工作流，针对每个目标岗位 5 分钟生成定制版本

🌐 在线访问：<https://seasonlin1025.github.io>
https://vscode.dev/github/deanpeters/Product-Manager-Skills/blob/main

---

## ✨ 特性

- **单一数据源**：所有简历内容集中在 [`data/resume.json`](data/resume.json:1)，改一处两端同步
- **清新简历风站点**：三栏布局 + 浅绿白卡片 + 滚动联动高亮导航
- **像素级 PDF**：Puppeteer 打印 A4，中文字体清晰，可直接投递 HR 系统
- **Vibe Coding 作品集**：作品 iframe 内嵌可在线体验，作品库持续扩充
- **针对岗位定制**：复制 JSON 文件即可生成不同版本简历（AI PM / 策略产品 / 数据产品…）
- **自动部署**：push 到 main 分支 → GitHub Actions 自动构建 PDF + 发布 Pages

---

## 🖼️ 站点结构（三栏布局）

```
┌─────────────┬───────────────────────────┬────────────┐
│             │                           │            │
│  左侧卡片    │     中间主内容            │  右侧导航  │
│  · 头像     │     · 首页 / 关于我        │  🏠 首页    │
│  · 基本信息 │     · 实习经历            │  💼 实习    │
│  · 联系图标 │     · 项目经历            │  📐 项目    │
│             │     · 作品集              │  📷 作品    │
│ （sticky）  │     · 联系方式            │  🌐 联系    │
│             │     · Footer              │            │
│             │                           │  标签云     │
└─────────────┴───────────────────────────┴────────────┘
```

- 整页连续可滚动浏览完整内容
- 右侧 5 个导航按钮随滚动位置 **实时高亮**当前所在区块
- 点击导航按钮 → 平滑滚动到对应板块
- 1080px / 720px 两档响应式，移动端导航自动变横向

---

## 📁 目录结构

```
SeasonLin1025.github.io/
├── data/
│   └── resume.json              # ⭐ 主数据源（你只需改这个文件）
├── pdf/
│   ├── resume-print.css         # PDF 专用打印样式
│   └── build-pdf.js             # Puppeteer 打印脚本（动态渲染 _rendered.html）
├── site/                        # 在线简历站（GitHub Pages 部署目录）
│   ├── index.html               # 三栏骨架
│   ├── assets/
│   │   ├── style.css            # 清新简历风样式系统
│   │   └── main.js              # 数据渲染 + 滚动联动高亮
│   ├── data/                    # 由 sync 脚本自动同步
│   └── works/
│       └── med-manager/         # Vibe Coding 作品 1：用药管理工具
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

以字节 AI 产品实习为例：

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

**Step 4.** 投递。在线版仍然是通用版（左侧卡片 PDF 按钮指向 `resume.pdf`），HR 看到链接进站点能看到全貌。

---

## 🛠 部署到 GitHub Pages

1. 仓库命名为 `SeasonLin1025/SeasonLin1025.github.io`（Pages 自动识别）
2. 仓库 Settings → Pages → Source 选 **GitHub Actions**
3. 推送代码到 main 分支：
   ```bash
   git add .
   git commit -m "update resume"
   git push origin main
   ```
4. 等 1–2 分钟，访问 <https://seasonlin1025.github.io>

---

## 📝 修改简历内容指南

1. **改文字** → 编辑 [`data/resume.json`](data/resume.json:1)
2. **改 PDF 排版** → 编辑 [`pdf/resume-print.css`](pdf/resume-print.css:1)
3. **改网站样式** → 编辑 [`site/assets/style.css`](site/assets/style.css:1)
4. **改渲染 / 交互逻辑** → 编辑 [`site/assets/main.js`](site/assets/main.js:1)
5. **加新作品**：
   - 在 `site/works/` 下新建子目录，放静态资源
   - 在 `data/resume.json` 的 `works` 数组里加一项（`name / tagline / stack / highlights / demoPath / sourceUrl`）
6. **改主题色 / 圆角 / 字体** → 编辑 [`site/assets/style.css`](site/assets/style.css:1) 顶部 `:root` 里的 CSS 变量

---

## 🎨 设计 Token（清新简历风）

| 变量 | 值 | 用途 |
|------|------|------|
| `--bg` | `#f3f4f2` | 页面背景（米灰） |
| `--panel` | `#ffffff` | 左侧/导航/作品卡片底色 |
| `--panel-soft` | `#f1f3f1` | 中间内容卡片底色 |
| `--accent` | `#2f9e6b` | 主绿（标题、链接、选中态） |
| `--accent-soft` | `#e8f4ec` | 淡绿背景（hover、tag） |
| `--accent-dark` | `#1f7a52` | 深绿（数据指标加粗） |
| `--radius` | `14px` | 卡片圆角 |
| `--font-sans` | PingFang / Microsoft YaHei | 全站中文无衬线 |

数字指标（`18.2%`、`9500笔`、`1.6%` 等）在 [`site/assets/main.js`](site/assets/main.js:1) 中由 `highlight()` 正则自动加粗为深绿色。

---

## 🔗 关键文件

- [`data/resume.json`](data/resume.json:1) — 简历数据源
- [`site/index.html`](site/index.html:1) — 三栏骨架
- [`site/assets/main.js`](site/assets/main.js:1) — 数据渲染 + 滚动联动
- [`site/assets/style.css`](site/assets/style.css:1) — 清新简历风样式
- [`pdf/build-pdf.js`](pdf/build-pdf.js:1) — PDF 构建脚本
- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml:1) — CI/CD 配置

---

## 🪪 License

MIT · © 林熙哲
