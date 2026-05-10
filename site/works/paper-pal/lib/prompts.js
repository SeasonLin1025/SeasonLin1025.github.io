/**
 * Paper Pal · Prompt 模板库
 * --------------------------------------------------
 * 集中管理所有任务的 system / user prompt。
 * 修改 prompt = 修改产品行为,这是 PM 视角下"调产品"的关键面板。
 */

const SYSTEM_BASE = `你是 Paper Pal,一个专门帮研究生快速啃论文的 AI 助手。
你的回答风格:
- 直白、有判断、不浮夸
- 用中文回答(除非用户明确要求英文)
- 看到具体数字、对比时,用加粗强调
- 不编造论文里没有的内容,不确定就说"论文未提及"`;

/**
 * 三句话精华
 */
export function summaryPrompt(paperText) {
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `下面是一篇论文的全文(可能有截断)。请用**三句话**告诉我:

1. **它解决了什么问题**(为什么这件事重要)
2. **它怎么解决的**(核心方法,一句话)
3. **结果如何 + 谁该读它**(关键数字 + 读者画像)

要求:
- 每句话独立成段,标号 1️⃣ 2️⃣ 3️⃣
- 总共控制在 200 字以内
- 关键数字、模型名、数据集名用 **加粗**

论文全文:
"""
${paperText}
"""`,
    },
  ];
}

/**
 * 6 维结构卡片(返回结构化 JSON)
 */
export function cardsPrompt(paperText) {
  return [
    { role: 'system', content: SYSTEM_BASE + '\n\n严格按照 JSON 格式输出,不要任何 markdown 代码块标记,不要解释,只输出 JSON。' },
    {
      role: 'user',
      content: `把下面这篇论文拆成 6 张卡片,严格输出 JSON:

{
  "problem":   "问题:作者想解决什么具体问题?(1-2 句)",
  "method":    "方法:核心做法是什么?有什么巧思?(2-3 句)",
  "data":      "数据:用了什么数据集?规模多大?(具体数字)",
  "result":    "结果:关键指标提升多少?和 baseline 比?(具体数字)",
  "limitation":"不足:作者承认或暴露的局限是什么?",
  "takeaway":  "启示:对工程或产品有什么可借鉴的?(1-2 句具体的)"
}

只输出这一个 JSON 对象,不要任何其他文字。

论文全文:
"""
${paperText}
"""`,
    },
  ];
}

/**
 * PM 视角解读
 */
export function pmViewPrompt(paperText) {
  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `从 **AI 产品经理** 的视角,分析这篇论文:

请按以下结构输出(用 markdown):

### 🎯 一句话产品化判断
（这论文的能力**能不能**做成产品?为什么?）

### 👥 目标用户画像
（如果做成产品,谁会付钱用?用户是什么场景下的什么人?）

### 💡 可能的产品形态
（列 2-3 个具体的产品形态,每个一行)

### ⚠️ 落地的关键卡点
（论文方法离能用还差什么?数据?延迟?成本?幻觉?)

### 📊 商业可行性预判
（市场规模、竞品、护城河,简短 2-3 句)

要求:
- 不要堆理论,讲人话
- 不知道就说不知道
- 总共控制在 500 字以内

论文全文:
"""
${paperText}
"""`,
    },
  ];
}

/**
 * 自由问答(基于全文)
 * @param {string} paperText
 * @param {Array}  history       [{role, content}]
 * @param {string} userQuestion
 */
export function chatPrompt(paperText, history, userQuestion) {
  const sys = `${SYSTEM_BASE}

你正在回答用户关于一篇具体论文的问题。
原则:
- 答案必须基于下面提供的论文内容
- 引用原文片段时用 > 引用块
- 论文里没有的事实,直接说"论文未提及"
- 简短优先,1-3 段为佳`;

  const paperCtx = {
    role: 'system',
    content: `【论文全文(可能有截断)】\n"""\n${paperText}\n"""`,
  };

  return [
    { role: 'system', content: sys },
    paperCtx,
    ...history,
    { role: 'user', content: userQuestion },
  ];
}

// ==================== 跨文档(Notebook 级)Prompts ====================

/**
 * 把多个 source 拼成带标签的上下文。
 * 每篇用 [Paper A] / [Paper B] ... 标记,要求模型引用时也用同样标签。
 * @param {Array} sources  [{title, fullText, truncated}]
 * @returns {{label:string, title:string}[]} 同时返回 label 映射,便于 UI 提示
 */
function buildSourcesContext(sources) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const blocks = [];
  const labels = [];
  sources.forEach((s, i) => {
    const label = `Paper ${letters[i] || (i + 1)}`;
    labels.push({ label, title: s.title });
    blocks.push(
      `===== [${label}] 《${s.title}》${s.truncated ? '(已截断)' : ''} =====\n${s.fullText}\n===== [${label}] END =====`
    );
  });
  return { context: blocks.join('\n\n'), labels };
}

/**
 * 跨文档自由问答
 * @param {Array} sources       已启用的 sources(至少 1 篇)
 * @param {Array} history       [{role, content}]
 * @param {string} userQuestion
 */
export function crossChatPrompt(sources, history, userQuestion) {
  const { context, labels } = buildSourcesContext(sources);
  const labelLine = labels.map(l => `${l.label} = 《${l.title}》`).join(' / ');

  const sys = `${SYSTEM_BASE}

你正在回答用户关于**一组论文**(论文集)的问题。
原则:
- 答案必须基于下面提供的论文内容
- **每个论断后必须标注来源**,格式:[Paper A] / [Paper B];跨多篇时写 [Paper A, B]
- 引用原文时用 > 引用块,并在末尾标注来源
- 论文里没有的事实,直接说"论文未提及"
- 用户问的是"对比/差异/共同点"时,优先做结构化对比(表格或分点)

当前论文集:${labelLine}`;

  const ctx = {
    role: 'system',
    content: `【论文集全文(可能有截断)】\n${context}`,
  };

  return [
    { role: 'system', content: sys },
    ctx,
    ...history,
    { role: 'user', content: userQuestion },
  ];
}

/**
 * 综述初稿:把一组论文整合成一段研究脉络
 */
export function synthesisPrompt(sources) {
  const { context, labels } = buildSourcesContext(sources);
  const labelLine = labels.map(l => `${l.label} = 《${l.title}》`).join(' / ');

  return [
    { role: 'system', content: SYSTEM_BASE },
    {
      role: 'user',
      content: `下面是 **${sources.length} 篇** 相关论文。请帮我写一份**综述初稿**(不是简单堆叠,要找出脉络)。

当前论文集:${labelLine}

请按以下结构输出(markdown):

### 🧭 研究脉络一句话
（这几篇论文整体在解决什么问题?发展到哪一步了?)

### 🌳 方法分支
（按方法路线把论文归类,2-4 个分支,每个分支说哪几篇 [Paper X] 属于它、核心思路是什么)

### 📈 关键进展时间线
（按贡献递进列出:谁先做了什么 → 谁解决了什么遗留问题,**每条标注 [Paper X]**)

### ⚔️ 主要分歧 / 待解问题
（论文之间观点冲突或共同未解决的问题)

### 🎯 给读者的下一步建议
（如果我要在这方向上做工作,该读哪几篇优先?为什么?)

要求:
- 每个论断后标注来源 [Paper X]
- 不编造,论文未明确说的就不写
- 总共控制在 800 字以内

${context}`,
    },
  ];
}

/**
 * 多文档对比表(JSON 输出)
 * @param {Array}  sources
 * @param {Array<string>=} dimensions  对比维度,默认 6 个
 */
export function comparePrompt(sources, dimensions) {
  const dims = dimensions && dimensions.length
    ? dimensions
    : ['问题定位', '核心方法', '数据集', '关键指标', '主要局限', '产品化潜力'];

  const { context, labels } = buildSourcesContext(sources);

  // 期望输出 schema
  const schema = {
    dimensions: dims,
    papers: labels.map(l => ({
      label: l.label,
      title: l.title,
      cells: dims.reduce((o, d) => (o[d] = '...', o), {}),
    })),
  };

  return [
    { role: 'system', content: SYSTEM_BASE + '\n\n严格按照 JSON 格式输出,不要任何 markdown 代码块标记,不要解释,只输出 JSON。' },
    {
      role: 'user',
      content: `把下面 ${sources.length} 篇论文按维度做横向对比,严格输出 JSON。

对比维度:${dims.join(' / ')}

输出 schema(示例,内容替换为真实分析):
${JSON.stringify(schema, null, 2)}

要求:
- 每个 cell 控制在 30 字以内,具体、有数字
- 论文未提及的维度写 "—"
- label/title/dimensions 数组顺序保持与 schema 一致
- 只输出这一个 JSON 对象,不要任何其他文字

${context}`,
    },
  ];
}

/**
 * 安全解析模型返回的 JSON(去掉 markdown 围栏)
 */
export function safeParseJSON(text) {
  if (!text) return null;
  let cleaned = text.trim();
  // 去掉 ```json ... ``` 围栏
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  // 去掉首尾多余文本(取第一个 { 到最后一个 })
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  try { return JSON.parse(cleaned); } catch { return null; }
}