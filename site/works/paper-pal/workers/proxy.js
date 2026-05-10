/**
 * Paper Pal · Cloudflare Workers 代理
 * --------------------------------------------------
 * 作用:让陌生访客无需注册任何 Key,直接试用 Paper Pal。
 *
 * 工作原理:
 *   浏览器 → 这个 Worker → Google Gemini API
 *   Worker 在请求里注入作者的 Gemini Key(永远不暴露给前端)。
 *
 * 限频:每个 IP 每天 5 次,用 Cloudflare KV 存计数。
 *
 * 部署:见同目录 README.md (5 分钟搞定)
 *
 * 环境变量(在 Cloudflare Dashboard 配置):
 *   - GEMINI_KEY  (Secret)  你的 Gemini API Key
 *   - DAILY_LIMIT (Var)     每 IP 每天可调用次数,默认 5
 *   - MODEL       (Var)     默认模型,默认 gemini-2.5-flash
 *
 * KV 绑定:
 *   - RATE_KV               用于限频计数
 */

const UPSTREAM = 'https://generativelanguage.googleapis.com/v1beta/openai';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function jsonResp(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env, ctx) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // 健康检查
    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonResp({
        ok: true,
        service: 'Paper Pal Trial Proxy',
        endpoints: ['/chat/completions'],
      });
    }

    // 仅放行 chat/completions
    if (!url.pathname.endsWith('/chat/completions')) {
      return jsonResp({ error: 'Not Found' }, 404);
    }

    if (request.method !== 'POST') {
      return jsonResp({ error: 'Method Not Allowed' }, 405);
    }

    if (!env.GEMINI_KEY) {
      return jsonResp({ error: 'Worker 未配置 GEMINI_KEY' }, 500);
    }

    // 限频
    const ip = request.headers.get('CF-Connecting-IP')
            || request.headers.get('X-Forwarded-For')
            || 'unknown';
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const rateKey = `rate:${today}:${ip}`;
    const limit = parseInt(env.DAILY_LIMIT || '5', 10);

    let used = 0;
    if (env.RATE_KV) {
      const v = await env.RATE_KV.get(rateKey);
      used = v ? parseInt(v, 10) : 0;
      if (used >= limit) {
        return jsonResp({
          error: {
            message: `今日免费体验额度已用完(${limit}次/天)。请在设置中填入自己的 Gemini Key 继续使用,Pro 会员每天免费 1000 次。`,
            type: 'rate_limit_exceeded',
          },
        }, 429);
      }
    }

    // 解析请求体,允许覆写默认 model
    let body;
    try { body = await request.json(); } catch {
      return jsonResp({ error: 'Invalid JSON body' }, 400);
    }
    if (!body.model || body.model === 'trial' || body.model.startsWith('default')) {
      body.model = env.MODEL || 'gemini-2.5-flash';
    }
    // 输入安全:限制 messages 总长度,防止滥用
    const totalLen = JSON.stringify(body.messages || []).length;
    if (totalLen > 200000) {
      return jsonResp({
        error: { message: '输入过长(>200KB),请缩小 PDF 或贴入自己的 Key' },
      }, 413);
    }

    // 转发到 Google
    const upstreamResp = await fetch(`${UPSTREAM}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.GEMINI_KEY}`,
      },
      body: JSON.stringify(body),
    });

    // 计数 +1(异步,不阻塞响应)
    if (env.RATE_KV) {
      ctx.waitUntil(
        env.RATE_KV.put(rateKey, String(used + 1), { expirationTtl: 86400 })
      );
    }

    // 透传(包括流式)
    const respHeaders = new Headers(CORS_HEADERS);
    const ct = upstreamResp.headers.get('content-type') || 'application/json';
    respHeaders.set('Content-Type', ct);
    respHeaders.set('X-RateLimit-Limit', String(limit));
    respHeaders.set('X-RateLimit-Remaining', String(Math.max(0, limit - used - 1)));

    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      headers: respHeaders,
    });
  },
};