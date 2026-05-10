/**
 * Paper Pal · LLM Client
 * --------------------------------------------------
 * 统一封装多 Provider 的 OpenAI 兼容协议调用。
 * 支持:
 *   - Gemini(通过 Google 官方 OpenAI 兼容端点)
 *   - DeepSeek
 *   - OpenAI
 *   - 自定义 Base URL
 *   - 免费试用模式(通过 Cloudflare Workers 代理)
 * 特性:
 *   - 流式输出(SSE)
 *   - 一致的 API 形态: client.chat({ messages, onToken, onDone, onError })
 *   - Key 仅存于 localStorage,永不上传
 */

// ============ Provider 预设 ============
export const PROVIDERS = {
  'gemini-flash': {
    label: 'Gemini 2.5 Flash',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    keyHint: '前往 <a href="https://aistudio.google.com/apikey" target="_blank">Google AI Studio</a> 免费获取',
    keyPrefix: 'AIza',
  },
  'gemini-pro': {
    label: 'Gemini 2.5 Pro',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-pro',
    keyHint: '前往 <a href="https://aistudio.google.com/apikey" target="_blank">Google AI Studio</a> 免费获取(Pro 会员 1000 次/天)',
    keyPrefix: 'AIza',
  },
  'zhipu-flash': {
    label: '智谱 GLM-4-Flash(免费)',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    keyHint: '前往 <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank">智谱 AI 控制台</a> 复制 Key(GLM-4-Flash 永久免费)',
    keyPrefix: '',
  },
  'deepseek': {
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keyHint: '前往 <a href="https://platform.deepseek.com/api_keys" target="_blank">DeepSeek 控制台</a> 获取(需先充值 ≥¥1)',
    keyPrefix: 'sk-',
  },
  'openai': {
    label: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyHint: '前往 <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI 控制台</a>获取',
    keyPrefix: 'sk-',
  },
  'custom': {
    label: '自定义 OpenAI 兼容',
    baseURL: '',
    model: '',
    keyHint: '填入任何 OpenAI 兼容服务的 Base URL 与 Model',
    keyPrefix: '',
  },
};

// ============ 试用模式配置 ============
// 部署 Cloudflare Workers 后把这里改成你的 worker 地址
// 留空字符串则禁用试用模式(用户必须填自己的 Key)
export const TRIAL_PROXY_URL = '';
// 例如: 'https://paper-pal-proxy.yourname.workers.dev'

// ============ 配置存取 ============
const STORAGE_KEY = 'paperpal:llm-config';

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function saveConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function clearConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 获取当前生效的运行时配置
 * 优先级: 用户配置 > 试用模式
 */
export function getRuntime() {
  const cfg = loadConfig();
  if (cfg && cfg.apiKey) {
    const preset = PROVIDERS[cfg.provider] || PROVIDERS.custom;
    return {
      mode: 'byok',
      baseURL: cfg.baseURL || preset.baseURL,
      model: cfg.model || preset.model,
      apiKey: cfg.apiKey,
      provider: cfg.provider,
    };
  }
  if (TRIAL_PROXY_URL) {
    return {
      mode: 'trial',
      baseURL: TRIAL_PROXY_URL,
      model: 'gemini-2.5-flash',  // Workers 端可覆盖
      apiKey: 'trial',             // Workers 端会注入真实 Key
      provider: 'trial',
    };
  }
  return null;
}

// ============ 核心:流式聊天 ============
/**
 * @param {Object} opts
 * @param {Array}  opts.messages   [{role, content}]
 * @param {number} opts.temperature
 * @param {Function} opts.onToken  每收到一段文本调用,(text) => void
 * @param {Function} opts.onDone   完成,(fullText) => void
 * @param {Function} opts.onError  出错,(Error) => void
 * @param {AbortSignal} opts.signal
 */
export async function chat({ messages, temperature = 0.3, onToken, onDone, onError, signal } = {}) {
  const rt = getRuntime();
  if (!rt) {
    const err = new Error('未配置 API Key,请在设置中填入,或部署 Workers 代理开启试用模式');
    onError?.(err);
    throw err;
  }

  const url = `${rt.baseURL.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: rt.model,
    messages,
    temperature,
    stream: true,
  };

  let fullText = '';
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${rt.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      let rawMsg = '';
      try {
        const j = JSON.parse(errText);
        rawMsg = j.error?.message || j.message || '';
      } catch { rawMsg = errText.slice(0, 300); }

      // 控制台输出完整原始错误,方便排查
      console.error('[LLM API Error]', resp.status, errText);

      let msg = rawMsg || `请求失败 (${resp.status})`;
      if (resp.status === 429) {
        if (rt.mode === 'trial') {
          msg = '今日免费试用额度用完,请在设置中填入自己的 API Key 继续使用';
        } else if (rt.provider?.startsWith('gemini')) {
          // 提取 limit 数字
          const limitMatch = rawMsg.match(/limit:\s*(\d+)/i);
          const limit = limitMatch ? parseInt(limitMatch[1]) : -1;
          if (limit === 0) {
            msg = `当前模型(${rt.model})在你账号上没有免费配额。请到 ⚙️ 设置切换到「Gemini 2.5 Flash」或换 DeepSeek`;
          } else if (limit > 0 && /PerDay/i.test(rawMsg)) {
            msg = `Gemini ${rt.model} 今日免费额度(${limit} 次/天)已用完,要等北京时间下午 3-4 点重置。建议:换 DeepSeek 或换 Google 账号申请新 Key`;
          } else if (/PerMinute/i.test(rawMsg)) {
            msg = `Gemini 触发分钟级限流(${limit || 10} 次/分钟),等 1 分钟再点`;
          } else {
            msg = `Gemini 限流 (429):${rawMsg.slice(0, 200)}`;
          }
        } else {
          msg = `请求被限流 (429):${rawMsg}`;
        }
      } else if (resp.status === 401 || resp.status === 403) {
        msg = `API Key 无效或权限不足 (${resp.status}):${rawMsg}`;
      } else if (resp.status === 400) {
        msg = `请求参数错误 (400):${rawMsg}`;
      } else {
        msg = `[${resp.status}] ${rawMsg}`;
      }
      throw new Error(msg);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;

        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            onToken?.(delta);
          }
        } catch { /* 忽略非 JSON 心跳 */ }
      }
    }

    onDone?.(fullText);
    return fullText;
  } catch (err) {
    if (err.name === 'AbortError') return fullText;
    onError?.(err);
    throw err;
  }
}

// ============ 一次性(非流式)便捷封装 ============
export async function chatOnce(messages, temperature = 0.3) {
  return chat({ messages, temperature });
}