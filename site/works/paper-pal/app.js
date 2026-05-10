/**
 * Paper Pal · 主逻辑(Notebook 多文档版)
 * --------------------------------------------------
 * 核心模型:Notebook = { sources[], chatHistory, ... }
 * 解读结果挂在 source 上;PDF doc 仅运行时缓存,不持久化。
 */
import {
  PROVIDERS, loadConfig, saveConfig, getRuntime, chat,
} from './lib/llm-client.js';
import {
  loadPdf, extractText, renderPage, guessTitle, truncateForLLM,
} from './lib/pdf-parser.js';
import {
  summaryPrompt, cardsPrompt, pmViewPrompt, chatPrompt,
  crossChatPrompt, synthesisPrompt, comparePrompt, safeParseJSON,
} from './lib/prompts.js';
import {
  saveNotebook, loadNotebook, listNotebooks, deleteNotebook,
  newNotebook, newSource,
} from './lib/storage.js';

// ============ 全局状态 ============
const state = {
  notebook: null,           // 当前 notebook(null 表示尚未创建)
  pdfDocs: new Map(),       // sourceId -> pdfDoc(运行时)
  currentPage: 1,
  chatMode: 'single',       // 'single' | 'cross'
};

// ============ DOM ============
const $ = (id) => document.getElementById(id);
const els = {
  uploadZone: $('uploadZone'), reader: $('reader'),
  fileInput: $('fileInput'), uploadInner: document.querySelector('.upload-inner'),
  trialBanner: $('trialBanner'), linkSetKey: $('linkSetKey'),

  nbBar: $('nbBar'), nbName: $('nbName'), btnNewNotebook: $('btnNewNotebook'),
  sourcesList: $('sourcesList'), sourceCount: $('sourceCount'),
  addSourceInput: $('addSourceInput'),

  pdfTitle: $('pdfTitle'), pdfCanvas: $('pdfCanvas'), pdfEmpty: $('pdfEmpty'),
  restorePdfInput: $('restorePdfInput'),
  pageInfo: $('pageInfo'), btnPrevPage: $('btnPrevPage'), btnNextPage: $('btnNextPage'),
  btnNewPaper: $('btnNewPaper'),

  tabs: document.querySelectorAll('.tab'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  readerGrid: $('readerGrid'),
  summaryContent: $('summaryContent'),
  cardsContent: $('cardsContent'),
  pmContent: $('pmContent'),
  compareContent: $('compareContent'),
  synthesisContent: $('synthesisContent'),
  btnAnalyze: $('btnAnalyze'),
  analyzeStatus: $('analyzeStatus'),

  chatList: $('chatList'), chatInput: $('chatInput'), btnSend: $('btnSend'),
  chatModeBtns: document.querySelectorAll('.chat-mode-btn'),

  btnHistory: $('btnHistory'), btnSettings: $('btnSettings'),
  settingsDrawer: $('settingsDrawer'), historyDrawer: $('historyDrawer'),
  providerSelect: $('providerSelect'), apiKeyInput: $('apiKeyInput'),
  baseUrlInput: $('baseUrlInput'), modelInput: $('modelInput'),
  customGroup: $('customGroup'), keyHint: $('keyHint'),
  btnSaveKey: $('btnSaveKey'), btnUseTrial: $('btnUseTrial'),
  historyList: $('historyList'),

  toast: $('toast'),
};

// ============ 工具 ============
function showToast(msg, ms = 2400) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.hidden = true, ms);
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function labelOf(idx) { return `Paper ${LETTERS[idx] || (idx + 1)}`; }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function md2html(md) {
  if (!md) return '';
  const AMP = String.fromCharCode(38), LT = String.fromCharCode(60), GT = String.fromCharCode(62);
  let html = md
    .split(AMP).join(AMP + 'amp;')
    .split(LT).join(AMP + 'lt;')
    .split(GT).join(AMP + 'gt;');
  html = html
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // [Paper A] / [Paper A, B] 高亮
    .replace(/\[Paper ([A-Z](?:,\s*[A-Z])*)\]/g, '<span class="paper-ref">📄 $1</span>');
  html = html.replace(/(^- .+(?:\n- .+)*)/gm, (m) => {
    const items = m.split('\n').map(l => `<li>${l.replace(/^- /, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });
  html = html.split(/\n{2,}/).map(b => {
    if (/^<(h3|ul|blockquote|table)/.test(b.trim())) return b;
    return `<p>${b.replace(/\n/g, '<br>')}</p>`;
  }).join('');
  return html;
}

function updateTrialBanner() {
  const cfg = loadConfig();
  els.trialBanner.style.display = (cfg && cfg.apiKey) ? 'none' : 'flex';
}

// 防抖持久化
let _saveTimer = null;
function persist() {
  if (!state.notebook) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    saveNotebook(state.notebook).catch(err => console.warn('保存失败', err));
  }, 400);
}

// ============ Notebook / Source 操作 ============
function ensureNotebook() {
  if (!state.notebook) state.notebook = newNotebook();
  return state.notebook;
}

function activeSource() {
  if (!state.notebook) return null;
  const id = state.notebook.activeSourceId;
  return state.notebook.sources.find(s => s.id === id) || null;
}

function setActiveSource(sourceId) {
  if (!state.notebook) return;
  state.notebook.activeSourceId = sourceId;
  state.currentPage = 1;
  renderSourcesList();
  renderActiveSource();
  persist();
}

async function handleFile(file, opts = {}) {
  if (!file || file.type !== 'application/pdf') {
    showToast('请选择 PDF 文件');
    return null;
  }
  showToast('正在解析 PDF…');
  try {
    const pdfDoc = await loadPdf(file);
    const { fullText, truncated } = await extractText(pdfDoc);
    const title = await guessTitle(pdfDoc, file);

    ensureNotebook();
    const src = newSource({
      title, fileName: file.name, fileSize: file.size, fullText, truncated,
    });
    state.notebook.sources.push(src);
    state.pdfDocs.set(src.id, pdfDoc);

    // 第一篇:自动作为 active 并切换到阅读视图
    if (state.notebook.sources.length === 1 || !opts.silent) {
      state.notebook.activeSourceId = src.id;
    }
    showReader();
    renderSourcesList();
    renderNbBar();
    renderActiveSource();
    persist();

    if (truncated) {
      showToast(`已添加《${title.slice(0, 24)}》(已截断)`);
    } else {
      showToast(`已添加《${title.slice(0, 24)}》· ${pdfDoc.numPages} 页`);
    }
    return src;
  } catch (err) {
    console.error(err);
    showToast('PDF 解析失败:' + err.message);
    return null;
  }
}

// 历史恢复:把已有 notebook 设为当前 state(无 PDF 文件)
function adoptNotebook(nb) {
  state.notebook = nb;
  state.pdfDocs.clear();
  if (!nb.activeSourceId && nb.sources.length) {
    nb.activeSourceId = nb.sources[0].id;
  }
  showReader();
  renderNbBar();
  renderSourcesList();
  renderActiveSource();
  renderChatHistory();
}

function showReader() {
  els.uploadZone.hidden = true;
  els.reader.hidden = false;
  els.nbBar.hidden = false;
}

// ============ 渲染:Notebook 顶栏 ============
function renderNbBar() {
  if (!state.notebook) { els.nbBar.hidden = true; return; }
  els.nbBar.hidden = false;
  els.nbName.textContent = state.notebook.name;
}

// ============ 渲染:Sources 列表 ============
function renderSourcesList() {
  if (!state.notebook) { els.sourcesList.innerHTML = ''; els.sourceCount.textContent = '0'; return; }
  const srcs = state.notebook.sources;
  els.sourceCount.textContent = String(srcs.length);
  els.sourcesList.innerHTML = srcs.map((s, i) => {
    const active = s.id === state.notebook.activeSourceId ? 'active' : '';
    const dis = s.enabled ? '' : 'disabled';
    return `
      <div class="source-item ${active} ${dis}" data-id="${s.id}">
        <input type="checkbox" class="source-item-toggle" ${s.enabled ? 'checked' : ''} title="是否参与跨论文问答" />
        <span class="source-item-label">${LETTERS[i] || (i + 1)}</span>
        <span class="source-item-title" title="${escapeAttr(s.title)}">${escapeHtml(s.title)}</span>
        <span class="source-item-del" title="移除">✕</span>
      </div>
    `;
  }).join('');
  // 绑定事件
  els.sourcesList.querySelectorAll('.source-item').forEach(el => {
    const id = el.dataset.id;
    el.addEventListener('click', (e) => {
      // 忽略勾选/删除按钮
      if (e.target.classList.contains('source-item-toggle')) return;
      if (e.target.classList.contains('source-item-del')) {
        e.stopPropagation(); removeSource(id); return;
      }
      setActiveSource(id);
    });
    el.querySelector('.source-item-toggle').addEventListener('change', (e) => {
      const s = state.notebook.sources.find(x => x.id === id);
      if (s) { s.enabled = e.target.checked; renderSourcesList(); persist(); }
    });
  });
}

function removeSource(id) {
  if (!state.notebook) return;
  if (!confirm('移除这篇论文?(其解读结果也会一并删除)')) return;
  state.notebook.sources = state.notebook.sources.filter(s => s.id !== id);
  state.pdfDocs.delete(id);
  if (state.notebook.activeSourceId === id) {
    state.notebook.activeSourceId = state.notebook.sources[0]?.id || null;
  }
  renderSourcesList();
  renderActiveSource();
  persist();
  if (state.notebook.sources.length === 0) {
    showToast('论文集已空,可继续追加或返回');
  }
}

function escapeHtml(s) {
  const AMP = String.fromCharCode(38), LT = String.fromCharCode(60), GT = String.fromCharCode(62);
  return String(s || '')
    .split(AMP).join(AMP + 'amp;')
    .split(LT).join(AMP + 'lt;')
    .split(GT).join(AMP + 'gt;');
}
function escapeAttr(s) {
  return escapeHtml(s).split('"').join(String.fromCharCode(38) + 'quot;');
}

// ============ 渲染:激活的 source(PDF + 已有解读结果) ============
async function renderActiveSource() {
  const src = activeSource();
  if (!src) {
    els.pdfTitle.textContent = '未选择论文';
    els.pdfCanvas.style.display = 'none';
    els.pdfEmpty.hidden = false;
    resetResultPanes();
    return;
  }
  els.pdfTitle.textContent = src.title.length > 40 ? src.title.slice(0, 40) + '…' : src.title;
  els.pdfTitle.title = src.title;

  // PDF 展示
  const pdfDoc = state.pdfDocs.get(src.id);
  if (pdfDoc) {
    els.pdfEmpty.hidden = true;
    els.pdfCanvas.style.display = '';
    state.currentPage = 1;
    await renderCurrentPage();
  } else {
    // 历史恢复,没有原 PDF
    els.pdfCanvas.style.display = 'none';
    els.pdfEmpty.hidden = false;
    els.pageInfo.textContent = '- / -';
  }

  // 已存在的解读结果显示
  els.summaryContent.innerHTML = src.summary
    ? `<div class="result-content">${md2html(src.summary)}</div>`
    : '<div class="placeholder">点击下方"开始解读",AI 将生成这篇论文的三句话精华。</div>';
  els.cardsContent.innerHTML = src.cards
    ? renderCards(src.cards)
    : '<div class="placeholder">结构卡片将以 6 个维度拆解论文。</div>';
  els.pmContent.innerHTML = src.pm
    ? `<div class="result-content">${md2html(src.pm)}</div>`
    : '<div class="placeholder">从产品经理视角,分析这篇论文能落地什么产品、面向哪类用户。</div>';
}

async function renderCurrentPage() {
  const src = activeSource();
  if (!src) return;
  const pdfDoc = state.pdfDocs.get(src.id);
  if (!pdfDoc) return;
  await renderPage(pdfDoc, state.currentPage, els.pdfCanvas, 'auto');
  els.pageInfo.textContent = `${state.currentPage} / ${pdfDoc.numPages}`;
}

function resetResultPanes() {
  els.summaryContent.innerHTML = '<div class="placeholder">点击下方"开始解读",AI 将生成这篇论文的三句话精华。</div>';
  els.cardsContent.innerHTML = '<div class="placeholder">结构卡片将以 6 个维度拆解论文。</div>';
  els.pmContent.innerHTML = '<div class="placeholder">从产品经理视角,分析这篇论文能落地什么产品、面向哪类用户。</div>';
}

function renderCards(cards) {
  const dict = [
    ['problem', '🎯 问题'], ['method', '🛠 方法'], ['data', '📦 数据'],
    ['result', '📊 结果'], ['limitation', '⚠️ 不足'], ['takeaway', '💡 启示'],
  ];
  const items = dict.map(([k, label]) => `
    <div class="card-item">
      <div class="card-item-title">${label}</div>
      <div class="card-item-body">${escapeHtml(cards[k] || '论文未提及').replace(/\n/g, '<br>')}</div>
    </div>`).join('');
  return `<div class="cards-grid">${items}</div>`;
}

// ============ 解读三件套(单文档) ============
async function runAnalyze() {
  // 跨文档 tab 时另跑
  const activeTab = document.querySelector('.tab.active')?.dataset.tab;
  if (activeTab === 'compare') return runCompare();
  if (activeTab === 'synthesis') return runSynthesis();

  const src = activeSource();
  if (!src) { showToast('先选择一篇论文'); return; }
  if (!getRuntime()) {
    showToast('请先在设置中配置 API Key');
    openDrawer('settingsDrawer');
    return;
  }

  els.btnAnalyze.disabled = true;
  els.analyzeStatus.textContent = '⏳ AI 思考中…';

  const text = truncateForLLM(src.fullText);

  // 1) 三句话精华
  try {
    els.summaryContent.innerHTML = '<div class="result-content"></div>';
    const target = els.summaryContent.querySelector('.result-content');
    let buf = '';
    await chat({
      messages: summaryPrompt(text),
      temperature: 0.3,
      onToken: (delta) => { buf += delta; target.innerHTML = md2html(buf); },
    });
    src.summary = buf;
    persist();
  } catch (err) {
    els.summaryContent.innerHTML = `<div class="placeholder">⚠️ ${err.message}</div>`;
    els.btnAnalyze.disabled = false; els.analyzeStatus.textContent = '';
    return;
  }

  // 2) 6 维卡片
  try {
    await sleep(1500); // 留出 RPM 间隔
    els.cardsContent.innerHTML = '<div class="placeholder">生成结构卡片中…</div>';
    const raw = await chat({ messages: cardsPrompt(text), temperature: 0.2 });
    const cards = safeParseJSON(raw);
    src.cards = cards;
    persist();
    if (cards) {
      els.cardsContent.innerHTML = renderCards(cards);
    } else {
      els.cardsContent.innerHTML = `<div class="result-content">${md2html(raw)}</div>`;
    }
  } catch (err) {
    els.cardsContent.innerHTML = `<div class="placeholder">⚠️ ${err.message}</div>`;
  }

  // 3) PM 视角
  try {
    await sleep(1500);
    els.pmContent.innerHTML = '<div class="result-content"></div>';
    const target = els.pmContent.querySelector('.result-content');
    let buf = '';
    await chat({
      messages: pmViewPrompt(text),
      temperature: 0.4,
      onToken: (delta) => { buf += delta; target.innerHTML = md2html(buf); },
    });
    src.pm = buf;
    persist();
  } catch (err) {
    els.pmContent.innerHTML = `<div class="placeholder">⚠️ ${err.message}</div>`;
  }

  els.btnAnalyze.disabled = false;
  els.analyzeStatus.textContent = '✅ 解读完成';
  setTimeout(() => els.analyzeStatus.textContent = '', 3000);
}

// ============ 跨文档:对比 / 综述 ============
function getEnabledSources() {
  if (!state.notebook) return [];
  return state.notebook.sources
    .filter(s => s.enabled)
    .map(s => ({ ...s, fullText: truncateForLLM(s.fullText) }));
}

async function runCompare() {
  const srcs = getEnabledSources();
  if (srcs.length < 2) { showToast('至少勾选 2 篇论文'); return; }
  if (!getRuntime()) { showToast('请先配置 API Key'); openDrawer('settingsDrawer'); return; }
  els.btnAnalyze.disabled = true; els.analyzeStatus.textContent = '⏳ 生成对比中…';
  els.compareContent.innerHTML = '<div class="placeholder">AI 思考中…</div>';
  try {
    const raw = await chat({ messages: comparePrompt(srcs), temperature: 0.2 });
    const data = safeParseJSON(raw);
    if (data && data.papers && data.dimensions) {
      els.compareContent.innerHTML = renderCompareTable(data);
    } else {
      els.compareContent.innerHTML = `<div class="result-content">${md2html(raw)}</div>`;
    }
  } catch (err) {
    els.compareContent.innerHTML = `<div class="placeholder">⚠️ ${err.message}</div>`;
  }
  els.btnAnalyze.disabled = false; els.analyzeStatus.textContent = '';
}

function renderCompareTable(data) {
  const headers = data.papers.map(p =>
    `<th title="${escapeAttr(p.title)}">${escapeHtml(p.label)}<br/><small style="font-weight:400;color:var(--text-muted)">${escapeHtml(p.title.slice(0, 18))}${p.title.length > 18 ? '…' : ''}</small></th>`
  ).join('');
  const rows = data.dimensions.map(dim => {
    const cells = data.papers.map(p => `<td>${escapeHtml(p.cells?.[dim] || '—')}</td>`).join('');
    return `<tr><th>${escapeHtml(dim)}</th>${cells}</tr>`;
  }).join('');
  return `<table class="compare-table"><thead><tr><th></th>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
}

async function runSynthesis() {
  const srcs = getEnabledSources();
  if (srcs.length < 2) { showToast('至少勾选 2 篇论文'); return; }
  if (!getRuntime()) { showToast('请先配置 API Key'); openDrawer('settingsDrawer'); return; }
  els.btnAnalyze.disabled = true; els.analyzeStatus.textContent = '⏳ 生成综述中…';
  els.synthesisContent.innerHTML = '<div class="result-content"></div>';
  const target = els.synthesisContent.querySelector('.result-content');
  try {
    let buf = '';
    await chat({
      messages: synthesisPrompt(srcs),
      temperature: 0.4,
      onToken: (delta) => { buf += delta; target.innerHTML = md2html(buf); },
    });
  } catch (err) {
    els.synthesisContent.innerHTML = `<div class="placeholder">⚠️ ${err.message}</div>`;
  }
  els.btnAnalyze.disabled = false; els.analyzeStatus.textContent = '';
}

// ============ 对话问答 ============
async function sendChat(question) {
  if (!question.trim()) return;
  if (!state.notebook || state.notebook.sources.length === 0) {
    showToast('先上传一篇论文'); return;
  }
  if (!getRuntime()) { showToast('请先配置 API Key'); openDrawer('settingsDrawer'); return; }

  // 移除建议
  els.chatList.querySelectorAll('.chat-tip,.chat-suggests').forEach(n => n.remove());

  appendMsg('user', question);
  const aiBody = appendMsg('ai', '');
  els.chatInput.value = '';
  els.btnSend.disabled = true;

  try {
    let messages;
    if (state.chatMode === 'cross') {
      const srcs = getEnabledSources();
      if (!srcs.length) throw new Error('请至少勾选 1 篇论文');
      messages = crossChatPrompt(srcs, state.notebook.chatHistory, question);
    } else {
      const src = activeSource();
      if (!src) throw new Error('未选择当前论文');
      messages = chatPrompt(truncateForLLM(src.fullText), state.notebook.chatHistory, question);
    }

    let buf = '';
    await chat({
      messages, temperature: 0.4,
      onToken: (delta) => { buf += delta; aiBody.innerHTML = md2html(buf); els.chatList.scrollTop = els.chatList.scrollHeight; },
    });
    state.notebook.chatHistory.push({ role: 'user', content: question });
    state.notebook.chatHistory.push({ role: 'assistant', content: buf });
    if (state.notebook.chatHistory.length > 16) state.notebook.chatHistory.splice(0, 4);
    persist();
  } catch (err) {
    aiBody.innerHTML = `<p>⚠️ ${err.message}</p>`;
  }
  els.btnSend.disabled = false;
}

function appendMsg(role, content) {
  const wrap = document.createElement('div');
  wrap.className = `chat-msg chat-msg-${role}`;
  wrap.innerHTML = `<div class="chat-msg-role">${role === 'user' ? '你' : 'Paper Pal'}</div><div class="chat-msg-body">${md2html(content) || '<span style="color:#888">…</span>'}</div>`;
  els.chatList.appendChild(wrap);
  els.chatList.scrollTop = els.chatList.scrollHeight;
  return wrap.querySelector('.chat-msg-body');
}

function renderChatHistory() {
  els.chatList.innerHTML = '';
  if (!state.notebook || !state.notebook.chatHistory.length) {
    showSuggests();
    return;
  }
  state.notebook.chatHistory.forEach(m => {
    appendMsg(m.role === 'user' ? 'user' : 'ai', m.content);
  });
}

function showSuggests() {
  const isCross = state.chatMode === 'cross';
  const tips = isCross
    ? ['这几篇论文的主要分歧在哪里?', '把所有论文的关键指标整合成表格', '这几篇按时间线怎么递进?', '哪一篇最值得我先精读?']
    : ['这篇论文的核心创新点是什么?', '实验数据集是什么规模?', '作者承认的局限性有哪些?', '这篇适合什么背景的人读?'];
  els.chatList.innerHTML = `
    <div class="chat-tip">${isCross ? '跨论文 · 试试这些:' : '试试这些问题:'}</div>
    <div class="chat-suggests">
      ${tips.map(t => `<button class="suggest">${escapeHtml(t)}</button>`).join('')}
    </div>`;
  bindSuggests();
}

function bindSuggests() {
  els.chatList.querySelectorAll('.suggest').forEach(b => {
    b.addEventListener('click', () => sendChat(b.textContent));
  });
}

function setChatMode(mode) {
  state.chatMode = mode;
  els.chatModeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  els.chatInput.placeholder = mode === 'cross' ? '跨论文提问(基于已勾选的论文)…' : '对当前论文提问…';
  if (!state.notebook?.chatHistory.length) showSuggests();
}

// ============ 设置面板 ============
function openDrawer(id) { $(id).hidden = false; }
function closeDrawer(el) { el.hidden = true; }

function applyProviderUI(providerKey) {
  const preset = PROVIDERS[providerKey] || PROVIDERS.custom;
  els.keyHint.innerHTML = preset.keyHint;
  els.customGroup.hidden = providerKey !== 'custom';
  els.baseUrlInput.value = preset.baseURL || '';
  // 模型名:用 placeholder 提示默认值,不覆盖用户已填值;custom 时填入默认作为初始
  els.modelInput.placeholder = preset.model ? `默认: ${preset.model}` : '例如 gpt-4o-mini';
  if (providerKey === 'custom' && !els.modelInput.value) {
    els.modelInput.value = preset.model || '';
  }
}
function loadSettingsForm() {
  const cfg = loadConfig();
  if (cfg) {
    els.providerSelect.value = cfg.provider || 'zhipu-flash';
    els.apiKeyInput.value = cfg.apiKey || '';
  } else {
    els.providerSelect.value = 'zhipu-flash';
    els.apiKeyInput.value = '';
  }
  applyProviderUI(els.providerSelect.value);
  // applyProviderUI 已设默认 baseURL,这里用用户自定义值覆盖(如有)
  if (cfg) {
    if (cfg.baseURL) els.baseUrlInput.value = cfg.baseURL;
    els.modelInput.value = cfg.model || '';  // 用户保存过的自定义模型
  }
}
function saveSettings() {
  const provider = els.providerSelect.value;
  const apiKey = els.apiKeyInput.value.trim();
  const baseURL = els.baseUrlInput.value.trim();
  const model = els.modelInput.value.trim();
  if (!apiKey) { showToast('请输入 API Key,或点击使用免费试用'); return; }
  saveConfig({ provider, apiKey, baseURL, model });
  showToast('已保存,Key 仅在本地浏览器');
  updateTrialBanner();
  closeDrawer(els.settingsDrawer);
}

// ============ 历史抽屉(IndexedDB) ============
async function renderHistory() {
  const list = await listNotebooks().catch(() => []);
  const header = `
    <div class="history-actions">
      <button class="btn-mini" id="btnHistNew">+ 新建空论文集</button>
      <span style="color:var(--text-muted);font-size:12px;align-self:center">${list.length} 个论文集</span>
    </div>`;
  if (!list.length) {
    els.historyList.innerHTML = header + '<div class="placeholder">还没有历史,先上传一篇论文</div>';
  } else {
    els.historyList.innerHTML = header + list.map(nb => `
      <div class="history-item" data-id="${nb.id}">
        <div class="history-item-title">${escapeHtml(nb.name)}</div>
        <div class="history-item-preview">${escapeHtml(nb.preview || '(空论文集)')}</div>
        <div class="history-item-meta">
          <span>${nb.sourceCount} 篇 · ${new Date(nb.updatedAt).toLocaleString('zh-CN')}</span>
          <button class="history-item-del" data-del="${nb.id}">删除</button>
        </div>
      </div>`).join('');
  }
  // 绑定
  $('btnHistNew')?.addEventListener('click', () => {
    state.notebook = newNotebook();
    state.pdfDocs.clear();
    state.notebook.activeSourceId = null;
    persist();
    closeDrawer(els.historyDrawer);
    els.uploadZone.hidden = false; els.reader.hidden = true;
    renderNbBar();
    showToast('新论文集已创建,拖入第一篇论文吧');
  });
  els.historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (e.target.dataset.del) {
        e.stopPropagation();
        if (!confirm('永久删除这个论文集?')) return;
        await deleteNotebook(e.target.dataset.del);
        renderHistory();
        return;
      }
      const id = item.dataset.id;
      const nb = await loadNotebook(id);
      if (nb) {
        adoptNotebook(nb);
        closeDrawer(els.historyDrawer);
        showToast('已恢复论文集 · 解读结果已保留');
      }
    });
  });
}

// ============ 事件绑定 ============
function init() {
  // 上传(首次)
  els.fileInput.addEventListener('change', (e) => {
    const f = e.target.files?.[0]; if (f) handleFile(f);
  });
  ['dragenter', 'dragover'].forEach(ev => els.uploadInner.addEventListener(ev, (e) => {
    e.preventDefault(); els.uploadInner.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach(ev => els.uploadInner.addEventListener(ev, (e) => {
    e.preventDefault(); els.uploadInner.classList.remove('dragover');
  }));
  els.uploadInner.addEventListener('drop', (e) => {
    [...e.dataTransfer.files].forEach(f => handleFile(f, { silent: true }));
  });

  // 阅读视图全局拖拽:追加论文
  els.reader.addEventListener('dragover', (e) => { e.preventDefault(); });
  els.reader.addEventListener('drop', (e) => {
    e.preventDefault();
    [...e.dataTransfer.files].forEach(f => handleFile(f, { silent: true }));
  });

  // 追加论文按钮
  els.addSourceInput?.addEventListener('change', (e) => {
    [...e.target.files].forEach(f => handleFile(f, { silent: true }));
    e.target.value = '';
  });

  // 历史恢复后,选 PDF 重新关联
  els.restorePdfInput?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const src = activeSource(); if (!src) return;
    try {
      const pdfDoc = await loadPdf(f);
      state.pdfDocs.set(src.id, pdfDoc);
      renderActiveSource();
      showToast('PDF 已重新关联');
    } catch (err) { showToast('PDF 解析失败:' + err.message); }
    e.target.value = '';
  });

  // 翻页
  els.btnPrevPage.addEventListener('click', () => {
    if (state.currentPage > 1) { state.currentPage--; renderCurrentPage(); }
  });
  els.btnNextPage.addEventListener('click', () => {
    const src = activeSource();
    const pdfDoc = src && state.pdfDocs.get(src.id);
    if (pdfDoc && state.currentPage < pdfDoc.numPages) { state.currentPage++; renderCurrentPage(); }
  });

  // 全部清空(回到上传页,不删历史)
  els.btnNewPaper.addEventListener('click', () => {
    if (!confirm('返回上传页?当前论文集会保留在历史中。')) return;
    state.notebook = null;
    state.pdfDocs.clear();
    els.uploadZone.hidden = false;
    els.reader.hidden = true;
    els.nbBar.hidden = true;
    els.fileInput.value = '';
  });

  // 新建论文集按钮
  els.btnNewNotebook?.addEventListener('click', () => {
    if (state.notebook?.sources.length && !confirm('当前论文集已自动保存,现在新建一个空论文集?')) return;
    state.notebook = newNotebook();
    state.pdfDocs.clear();
    persist();
    els.uploadZone.hidden = false;
    els.reader.hidden = true;
    renderNbBar();
    showToast('新论文集已创建');
  });

  // Notebook 重命名
  els.nbName?.addEventListener('click', () => {
    if (!state.notebook) return;
    const next = prompt('重命名论文集', state.notebook.name);
    if (next && next.trim()) {
      state.notebook.name = next.trim();
      renderNbBar();
      persist();
    }
  });

  // Tabs
  els.tabs.forEach(tab => tab.addEventListener('click', () => {
    els.tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const key = tab.dataset.tab;
    els.tabPanes.forEach(p => p.classList.toggle('active', p.dataset.pane === key));
    // 切到跨文档 tab 时,改变按钮文案
    if (key === 'compare') els.btnAnalyze.textContent = '⚔️ 生成对比';
    else if (key === 'synthesis') els.btnAnalyze.textContent = '🌳 生成综述';
    else els.btnAnalyze.textContent = '✨ 开始解读';
  }));

  // 解读
  els.btnAnalyze.addEventListener('click', runAnalyze);

  // 聊天
  els.btnSend.addEventListener('click', () => sendChat(els.chatInput.value));
  els.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(els.chatInput.value); }
  });
  els.chatModeBtns.forEach(b => b.addEventListener('click', () => setChatMode(b.dataset.mode)));
  bindSuggests();

  // 抽屉
  els.btnSettings.addEventListener('click', () => { loadSettingsForm(); openDrawer('settingsDrawer'); });
  els.btnHistory.addEventListener('click', () => { renderHistory(); openDrawer('historyDrawer'); });
  els.linkSetKey.addEventListener('click', (e) => { e.preventDefault(); loadSettingsForm(); openDrawer('settingsDrawer'); });
  document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', (e) => {
    closeDrawer(e.currentTarget.closest('.drawer'));
  }));
  els.providerSelect.addEventListener('change', () => applyProviderUI(els.providerSelect.value));
  els.btnSaveKey.addEventListener('click', saveSettings);
  els.btnUseTrial.addEventListener('click', () => {
    saveConfig({ provider: '', apiKey: '' });
    localStorage.removeItem('paperpal:llm-config');
    showToast('已切换到免费试用模式(需作者部署 Workers)');
    updateTrialBanner();
    closeDrawer(els.settingsDrawer);
  });

  updateTrialBanner();
  loadSettingsForm();
  initResizers();
}

// ============ 三栏拖拽 ============
const COLS_KEY = 'paperpal:cols';
function applyCols(left, right) {
  if (els.readerGrid) {
    els.readerGrid.style.gridTemplateColumns =
      `${left}px 6px minmax(0, 1fr) 6px ${right}px`;
  }
}
function loadCols() {
  try {
    const v = JSON.parse(localStorage.getItem(COLS_KEY) || 'null');
    if (v && v.left && v.right) applyCols(v.left, v.right);
  } catch {}
}
function saveCols(left, right) {
  localStorage.setItem(COLS_KEY, JSON.stringify({ left, right }));
}
function initResizers() {
  loadCols();
  const grid = els.readerGrid;
  if (!grid) return;
  document.querySelectorAll('.resizer').forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      handle.classList.add('dragging');
      grid.classList.add('dragging');
      const which = handle.dataset.resize;
      const rect = grid.getBoundingClientRect();
      const cols = getComputedStyle(grid).gridTemplateColumns.split(' ');
      let leftW = parseFloat(cols[0]);
      let rightW = parseFloat(cols[4]);
      const startX = e.clientX;
      const startLeft = leftW;
      const startRight = rightW;
      const minPane = 200, minMid = 320;

      function onMove(ev) {
        const dx = ev.clientX - startX;
        if (which === 'left') {
          leftW = Math.max(minPane, Math.min(rect.width - minMid - rightW - 12, startLeft + dx));
        } else {
          rightW = Math.max(minPane, Math.min(rect.width - minMid - leftW - 12, startRight - dx));
        }
        applyCols(leftW, rightW);
      }
      function onUp() {
        handle.classList.remove('dragging');
        grid.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        saveCols(leftW, rightW);
        if (activeSource() && state.pdfDocs.get(activeSource().id)) renderCurrentPage();
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

// ============ 启动 ============
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ESC 关抽屉
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.drawer').forEach(d => { d.hidden = true; });
  }
});