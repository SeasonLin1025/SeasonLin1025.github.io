/**
 * PDF 构建脚本
 * 用法：
 *   node pdf/build-pdf.js
 *   node pdf/build-pdf.js --data=data/resume-bytedance.json --out=简历-字节-林熙哲.pdf
 *
 * 流程：
 *   1. 读取 JSON 数据（默认 data/resume.json）
 *   2. 注入到 HTML 模板字符串
 *   3. 写出临时 _rendered.html
 *   4. Puppeteer 打开 → 打印 A4 PDF
 */

const fs = require('fs');
const path = require('path');
// 优先使用 puppeteer-core（本地用系统浏览器），CI 上若装了完整 puppeteer 就用它
let puppeteer;
try { puppeteer = require('puppeteer'); }
catch { puppeteer = require('puppeteer-core'); }

// ---------- 1. 解析参数 ----------
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.resolve(ROOT, args.data || 'data/resume.json');
const OUT_FILE  = path.resolve(ROOT, args.out  || 'resume.pdf');

// ---------- 2. 读取数据 ----------
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const css  = fs.readFileSync(path.join(__dirname, 'resume-print.css'), 'utf8');

// ---------- 3. 渲染辅助 ----------
const esc = s => String(s ?? '')
  .replace(/&/g, '&' + 'amp;')
  .replace(/</g, '&' + 'lt;')
  .replace(/>/g, '&' + 'gt;');

function renderEducation(edus) {
  return edus.map(e => `
    <div class="edu-row">
      <span class="period">${esc(e.period)}</span>
      <span class="school">${esc(e.school)}</span>
      <span class="major">${esc(e.major)}</span>
      <span class="degree">${esc(e.degree)}</span>
    </div>
    ${(e.details || []).map(d => `<div class="bullet">${esc(d)}</div>`).join('')}
  `).join('');
}

function renderInternships(list) {
  return list.map(i => `
    <div class="exp-row">
      <span class="company">${esc(i.company)}</span>
      <span class="role">${esc(i.role)}</span>
      <span class="period">${esc(i.period)}</span>
    </div>
    ${i.highlights.map(h => `
      <div class="highlight">【<span class="tag">${esc(h.title)}</span>】：${esc(h.content)}</div>
    `).join('')}
  `).join('');
}

function renderProjects(list) {
  return list.map(p => `
    <div class="exp-row">
      <span class="company">${esc(p.name)}</span>
      <span class="role">${esc(p.role)}</span>
      <span class="period">${esc(p.period)}</span>
    </div>
    <div class="proj-desc">【<span class="tag">项目描述</span>】：${esc(p.description)}</div>
    <div class="proj-resp">【<span class="tag">核心职责</span>】：${p.responsibilities.map((r, idx) => `${idx + 1}、${esc(r)}`).join(' ')}</div>
  `).join('');
}

function renderCampus(list) {
  return list.map(c => `
    <div class="exp-row">
      <span class="company">${esc(c.org)}</span>
      <span class="role">${esc(c.role)}</span>
      <span class="period">${esc(c.period)}</span>
    </div>
    ${c.highlights.map(h => `
      <div class="highlight">【<span class="tag">${esc(h.title)}</span>】：${esc(h.content)}</div>
    `).join('')}
  `).join('');
}

function renderSkillsBullet(skills) {
  return `<div class="bullet">个人技能：${skills.join('；')}。</div>`;
}

// ---------- 4. 拼接 HTML ----------
const b = data.basic;
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${esc(b.name)} - 简历</title>
<style>${css}</style>
</head>
<body>

<h1 class="name">${esc(b.name)}</h1>
<div class="basic-line">年龄：${esc(b.age)}  |  电话：${esc(b.phone)}  |  邮箱：${esc(b.email)}</div>
<div class="basic-line">政治面貌：${esc(b.party)}  |  求职意向：${esc(b.target)}</div>

<div class="section">
  <div class="section-title">教育背景</div>
  ${renderEducation(data.education)}
  ${renderSkillsBullet(data.skills)}
</div>

<div class="section">
  <div class="section-title">实习经历</div>
  ${renderInternships(data.internships)}
</div>

<div class="section">
  <div class="section-title">项目经历</div>
  ${renderProjects(data.projects)}
</div>

<div class="section">
  <div class="section-title">校园经历</div>
  ${renderCampus(data.campus)}
</div>

</body>
</html>`;

// ---------- 5. 写临时 HTML 并打印 ----------
const tmpHtml = path.join(__dirname, '_rendered.html');
fs.writeFileSync(tmpHtml, html, 'utf8');

// 自动探测系统已安装的浏览器（Edge / Chrome），避免 Puppeteer 下载 Chromium
function findSystemBrowser() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  return candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
}

(async () => {
  console.log(`[build-pdf] data: ${DATA_FILE}`);
  console.log(`[build-pdf] out : ${OUT_FILE}`);
  const browserPath = findSystemBrowser();
  if (browserPath) console.log(`[build-pdf] use browser: ${browserPath}`);
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: browserPath || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('file://' + tmpHtml, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: OUT_FILE,
    format: 'A4',
    printBackground: true,
    margin: { top: '16mm', right: '14mm', bottom: '14mm', left: '14mm' }
  });
  await browser.close();
  console.log(`[build-pdf] ✔ done -> ${OUT_FILE}`);
})().catch(err => {
  console.error('[build-pdf] ✖ failed:', err);
  process.exit(1);
});