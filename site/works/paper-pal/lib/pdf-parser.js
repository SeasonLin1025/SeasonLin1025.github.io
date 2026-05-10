/**
 * Paper Pal · PDF Parser
 * --------------------------------------------------
 * 基于 PDF.js 的浏览器端 PDF 解析与渲染封装。
 * 输出: { pages: [{ pageNum, text }], fullText, pdfDoc }
 */

const MAX_TEXT_CHARS = 60000;  // 整体文本上限,防止超大论文撑爆 prompt

// ============ PDF.js 按需加载(防 CDN 拦截) ============
const PDFJS_CANDIDATES = [
  { lib: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
    worker: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js' },
  { lib: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    worker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js' },
  { lib: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js' },
];

let pdfjsLoadPromise = null;
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('script load failed: ' + src));
    document.head.appendChild(s);
  });
}

// 中文/CJK 字体 cmap 资源(PDF.js 解析中文 PDF 必需)
let CMAP_URL = '';
let STANDARD_FONT_URL = '';

async function ensurePdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  if (pdfjsLoadPromise) return pdfjsLoadPromise;
  pdfjsLoadPromise = (async () => {
    let lastErr;
    for (const c of PDFJS_CANDIDATES) {
      try {
        await loadScript(c.lib);
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = c.worker;
          // 同源的 cmaps / standard_fonts(关键:中文 PDF 渲染依赖)
          const baseDir = c.lib.replace(/\/build\/pdf\.min\.js$/, '');
          CMAP_URL = `${baseDir}/cmaps/`;
          STANDARD_FONT_URL = `${baseDir}/standard_fonts/`;
          console.log('[Paper Pal] PDF.js ready from', c.lib);
          return window.pdfjsLib;
        }
      } catch (e) { lastErr = e; }
    }
    throw new Error('PDF.js 加载失败:你的浏览器可能屏蔽了 CDN(常见于广告拦截/跟踪保护扩展)。请尝试关闭 ABP/AdBlock 等扩展,或在浏览器设置中关闭"严格跟踪保护"。');
  })();
  return pdfjsLoadPromise;
}

/**
 * 加载 PDF 文件
 * @param {File|ArrayBuffer} input
 * @returns {Promise<PDFDocumentProxy>}
 */
export async function loadPdf(input) {
  const lib = await ensurePdfJs();
  let data;
  if (input instanceof File) {
    data = await input.arrayBuffer();
  } else {
    data = input;
  }
  const loadingTask = lib.getDocument({
    data,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONT_URL,
  });
  return await loadingTask.promise;
}

/**
 * 提取全文(按页拼接)
 * @param {PDFDocumentProxy} pdfDoc
 * @returns {Promise<{pages: Array, fullText: string, truncated: boolean}>}
 */
export async function extractText(pdfDoc) {
  const pages = [];
  let totalLen = 0;
  let truncated = false;

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    // 按 transform 的 y 坐标重排,提升阅读顺序还原度
    const text = content.items
      .map(it => ('str' in it ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push({ pageNum: i, text });
    totalLen += text.length;
    if (totalLen > MAX_TEXT_CHARS) {
      truncated = true;
      break;
    }
  }

  const fullText = pages.map(p => p.text).join('\n\n');
  return { pages, fullText, truncated };
}

/**
 * 渲染单页到指定 canvas
 * scale 为 'auto' 时按容器宽度自动适配
 */
export async function renderPage(pdfDoc, pageNum, canvas, scale = 'auto') {
  const page = await pdfDoc.getPage(pageNum);
  let actualScale = scale;
  if (scale === 'auto') {
    const container = canvas.parentElement;
    const containerWidth = container ? (container.clientWidth - 24) : 600;
    const baseViewport = page.getViewport({ scale: 1 });
    actualScale = Math.max(0.5, Math.min(3, containerWidth / baseViewport.width));
  }
  const viewport = page.getViewport({ scale: actualScale });
  const ctx = canvas.getContext('2d');

  // 适配高分屏
  const dpr = window.devicePixelRatio || 1;
  canvas.width = viewport.width * dpr;
  canvas.height = viewport.height * dpr;
  canvas.style.width = viewport.width + 'px';
  canvas.style.height = viewport.height + 'px';

  await page.render({
    canvasContext: ctx,
    viewport,
    transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
  }).promise;
}

/**
 * 试图从 PDF 元数据或首页猜出标题
 * 优先级:文件名 > PDF 元数据 Title > 首页第一行
 */
export async function guessTitle(pdfDoc, file) {
  // 1. 文件名优先(中文 PDF 元数据经常是乱码)
  const filename = file?.name?.replace(/\.pdf$/i, '');
  if (filename && filename.length > 1 && !/^[*\d\s.\-_]+$/.test(filename)) {
    return filename;
  }
  // 2. 元数据
  try {
    const meta = await pdfDoc.getMetadata();
    const t = meta?.info?.Title?.trim();
    if (t && t.length > 3 && !/[\uFFFD\u0001-\u001F]/.test(t)) return t;
  } catch {}
  // 3. 首页文本
  try {
    const page = await pdfDoc.getPage(1);
    const content = await page.getTextContent();
    const firstLine = content.items
      .slice(0, 30).map(it => it.str || '').join(' ').trim().slice(0, 120);
    if (firstLine && !/[\uFFFD]/.test(firstLine)) return firstLine;
  } catch {}
  return filename || '未命名论文';
}

/**
 * 简单截断:用于喂给 LLM 时控制长度
 */
export function truncateForLLM(text, maxChars = 30000) {
  if (text.length <= maxChars) return text;
  // 头 + 尾,丢中间(论文摘要+结论通常最重要)
  const head = text.slice(0, Math.floor(maxChars * 0.7));
  const tail = text.slice(-Math.floor(maxChars * 0.3));
  return head + '\n\n[... 中间内容因长度限制省略 ...]\n\n' + tail;
}