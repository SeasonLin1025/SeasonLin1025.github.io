/* ===================================================
   暖心管家 · 慢病用药智能助手
   全功能纯前端单页应用，数据持久化于 localStorage
=================================================== */

// ========== 工具 ==========
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem('mc_' + k)); } catch { return null; } },
  set(k, v) { localStorage.setItem('mc_' + k, JSON.stringify(v)); }
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const fmt = d => { const dt = new Date(d); return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`; };
const fmtCN = d => { const dt = new Date(d); return `${dt.getMonth()+1}月${dt.getDate()}日`; };
const today = () => fmt(new Date());
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const escapeHtml = s => { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; };

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast-msg' + (type ? ' ' + type : '');
  el.textContent = msg;
  $('#toast').appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

function confetti() {
  const colors = ['#3DBFA8', '#FF8B8B', '#FFB74D', '#64B5F6', '#AB8FE6'];
  const c = $('#confetti');
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = (Math.random() * 0.3) + 's';
    p.style.animationDuration = (1.5 + Math.random()) + 's';
    p.style.transform = `rotate(${Math.random()*360}deg)`;
    c.appendChild(p);
    setTimeout(() => p.remove(), 2500);
  }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了，注意休息哦';
  if (h < 11) return '早上好，记得按时服药';
  if (h < 14) return '中午好，饭后别忘了药';
  if (h < 18) return '下午好，今天感觉如何';
  if (h < 22) return '晚上好，注意休息';
  return '夜深了，请早点休息';
}

// ========== 演示数据 ==========
const DEMO = {
  profile: { name: '王秀英', age: 62, gender: '女', diseases: ['高血压', '2型糖尿病'], phone: '138****1234', emergency: '王小明（儿子）13900008888' },
  meds: [
    { id: 'med1', name: '苯磺酸氨氯地平片', type: 'pill', dose: '5mg', perTime: 1, times: ['08:00'], stock: 18, totalStock: 30, unit: '片', notes: '降压药·饭前30分钟服用', warnings: '避免与西柚同服', disease: '高血压', startDate: '2026-04-01', endDate: '2026-07-01', doctor: '张明华主任', dept: '心内科', refillEnabled: true },
    { id: 'med2', name: '盐酸二甲双胍缓释片', type: 'pill', dose: '500mg', perTime: 1, times: ['08:00','18:00'], stock: 38, totalStock: 60, unit: '片', notes: '降糖药·随餐服用', warnings: '可能引起胃肠不适', disease: '2型糖尿病', startDate: '2026-04-01', endDate: '2026-07-01', doctor: '李静医生', dept: '内分泌科', refillEnabled: true },
    { id: 'med3', name: '阿司匹林肠溶片', type: 'pill', dose: '100mg', perTime: 1, times: ['08:00'], stock: 4, totalStock: 30, unit: '片', notes: '抗血小板·饭后服用', warnings: '出血倾向者慎用', disease: '高血压', startDate: '2026-04-10', endDate: '2026-07-10', doctor: '张明华主任', dept: '心内科', refillEnabled: true },
    { id: 'med4', name: '甘精胰岛素注射液', type: 'injection', dose: '10U', perTime: 1, times: ['21:00'], stock: 2, totalStock: 5, unit: '支', notes: '睡前皮下注射·腹部轮换', warnings: '注意低血糖反应', disease: '2型糖尿病', startDate: '2026-04-05', endDate: '2026-06-05', doctor: '李静医生', dept: '内分泌科', refillEnabled: true },
  ],
  visits: [
    { id: 'v1', doctor: '张明华', dept: '心内科', hospital: '武汉大学人民医院', date: addDays(3), time: '09:30', type: 'review', notes: '复查血压，带近一个月血压记录本', status: 'upcoming', remind: true },
    { id: 'v2', doctor: '李静', dept: '内分泌科', hospital: '武汉大学人民医院', date: addDays(8), time: '14:00', type: 'review', notes: '复查糖化血红蛋白与空腹血糖', status: 'upcoming', remind: true },
  ],
  bp: [], // 血压记录
  bg: [], // 血糖记录
  weight: [],
  family: [
    { id: 'f1', name: '王小明', relation: '儿子', phone: '139****8888', notify: true },
  ]
};

function addDays(n, base) { const d = base ? new Date(base) : new Date(); d.setDate(d.getDate() + n); return fmt(d); }

function initData() {
  if (!LS.get('inited_v2')) {
    localStorage.clear();
    LS.set('profile', DEMO.profile);
    LS.set('meds', DEMO.meds);
    LS.set('visits', DEMO.visits);
    LS.set('family', DEMO.family);

    // 过去14天打卡数据（模拟较好的依从性，最近2天稍差）
    const checkins = {};
    for (let i = 14; i >= 1; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = fmt(d);
      const records = {};
      DEMO.meds.forEach(m => {
        m.times.forEach(t => {
          const skipRate = (i <= 2) ? 0.25 : 0.08;
          const done = Math.random() > skipRate;
          records[m.id + '_' + t] = { medId: m.id, time: t, done, ts: done ? k+'T'+t : null };
        });
      });
      checkins[k] = records;
    }
    LS.set('checkins', checkins);

    // 近30天血压
    const bp = [];
    for (let i = 30; i >= 0; i -= 2) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const sys = 125 + Math.round(Math.random() * 18);
      const dia = 78 + Math.round(Math.random() * 10);
      bp.push({ id: uid(), date: fmt(d), time: '08:00', sys, dia, pulse: 70 + Math.round(Math.random()*15), note: i % 6 === 0 ? '饭后测量' : '' });
    }
    LS.set('bp', bp);

    // 近30天血糖
    const bg = [];
    for (let i = 30; i >= 0; i -= 3) {
      const d = new Date(); d.setDate(d.getDate() - i);
      bg.push({ id: uid(), date: fmt(d), time: '07:30', value: (5.8 + Math.random()*2.2).toFixed(1), period: 'fasting', note: '' });
    }
    LS.set('bg', bg);

    LS.set('weight', [{ id: uid(), date: today(), value: 62.5 }]);
    LS.set('inited_v2', true);
  }
}

// 数据访问
const get = k => LS.get(k) || [];
const set = (k, v) => LS.set(k, v);
const getProfile = () => LS.get('profile') || DEMO.profile;
const saveProfile = p => LS.set('profile', p);

// ========== 计算工具 ==========
function getTodayStats() {
  const meds = get('meds');
  const c = (LS.get('checkins') || {})[today()] || {};
  let total = 0, done = 0;
  meds.forEach(m => m.times.forEach(t => { total++; if (c[m.id+'_'+t]?.done) done++; }));
  return { total, done, remain: total - done, pct: total ? Math.round(done/total*100) : 0 };
}

function getDayStats(dateStr) {
  const meds = get('meds');
  const c = (LS.get('checkins') || {})[dateStr] || {};
  let total = 0, done = 0;
  meds.forEach(m => m.times.forEach(t => { total++; if (c[m.id+'_'+t]?.done) done++; }));
  return { total, done, pct: total ? Math.round(done/total*100) : 0 };
}

function getAdherence(days = 7) {
  const checkins = LS.get('checkins') || {};
  let total = 0, done = 0;
  for (let i = days; i >= 1; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const r = checkins[fmt(d)];
    if (r) Object.values(r).forEach(x => { total++; if (x.done) done++; });
  }
  return total ? Math.round(done/total*100) : 0;
}

function getLowStock() {
  return get('meds').filter(m => {
    const daily = m.times.length * (m.perTime || 1);
    const days = daily > 0 ? Math.floor(m.stock / daily) : 999;
    return days <= 7;
  });
}

function getNextVisits() {
  const t = today();
  return get('visits').filter(v => v.status === 'upcoming' && v.date >= t).sort((a,b) => a.date.localeCompare(b.date));
}

function getNotifications() {
  const list = [];
  getLowStock().forEach(m => {
    const daily = m.times.length * (m.perTime || 1);
    const days = daily > 0 ? Math.floor(m.stock / daily) : 0;
    list.push({ type: 'stock', icon: '📦', title: `${m.name} 库存不足`, desc: `仅剩 ${m.stock}${m.unit}，约可用 ${days} 天，建议尽快续方`, time: '今天' });
  });
  getNextVisits().forEach(v => {
    const d = daysBetween(today(), v.date);
    if (d <= 7) list.push({ type: 'visit', icon: '🏥', title: `复诊提醒：${v.doctor}`, desc: `${fmtCN(v.date)} ${v.time} · ${v.dept}，还有${d}天`, time: d === 0 ? '今天' : `${d}天后` });
  });
  const s = getTodayStats();
  if (s.remain > 0) list.push({ type: 'checkin', icon: '💊', title: '今日还有服药未完成', desc: `共 ${s.remain} 次未打卡，记得按时服药保护身体`, time: '今天' });
  return list;
}

// 智能建议
function getSmartTip() {
  const adh = getAdherence(7);
  const bp = get('bp');
  const bg = get('bg');
  const stats = getTodayStats();
  
  if (stats.remain === 0 && stats.total > 0) {
    return { icon: '🎉', title: '今日服药已全部完成', text: '坚持得真棒！规律服药是控制慢病的关键，继续保持哦~', action: '查看成就' };
  }
  if (adh < 70) {
    return { icon: '💡', title: '近期服药依从率偏低', text: `近7天为 ${adh}%，建议设置闹钟提醒，或让家人协助监督服药。`, action: '开启家人代管 →' };
  }
  if (bp.length) {
    const last = bp[bp.length-1];
    if (last.sys >= 140 || last.dia >= 90) return { icon: '⚠️', title: '最近血压偏高', text: `最近一次 ${last.sys}/${last.dia} mmHg，建议保持低盐饮食，必要时联系医生。`, action: '记录血压 →' };
  }
  if (bg.length) {
    const last = bg[bg.length-1];
    if (parseFloat(last.value) >= 7.0) return { icon: '⚠️', title: '空腹血糖偏高', text: `最近一次 ${last.value} mmol/L，注意控制碳水摄入，多走动。`, action: '记录血糖 →' };
  }
  const lowMeds = getLowStock();
  if (lowMeds.length) return { icon: '📦', title: '有药品库存不足', text: `${lowMeds[0].name} 等 ${lowMeds.length} 种药品需要续方，可在线复诊医生开方。`, action: '一键续方 →' };
  return { icon: '🌿', title: '今日健康小贴士', text: '慢病管理三部曲：规律服药、定期监测、健康生活。每天散步30分钟，对血压血糖都有益处~', action: '了解更多 →' };
}

// ========== 弹窗 ==========
function showModal(html) {
  $('#modalBox').innerHTML = `<div class="modal-handle"></div><div class="modal-inner">${html}</div>`;
  $('#modalMask').classList.add('show');
}
function hideModal() { $('#modalMask').classList.remove('show'); }
$('#modalMask').addEventListener('click', e => { if (e.target === $('#modalMask')) hideModal(); });

// ========== 路由 ==========
let currentPage = 'home';
function navigate(page) {
  currentPage = page;
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$$('.nav-item').forEach(el => el.addEventListener('click', () => navigate(el.dataset.page)));

function renderPage() {
  const main = $('#main');
  updateBadge();
  main.style.animation = 'none'; main.offsetHeight; main.style.animation = '';
  const renderers = { home: renderHome, plan: renderPlan, checkin: renderCheckin, health: renderHealth, me: renderMe };
  const binders = { home: bindHome, plan: bindPlan, checkin: bindCheckin, health: bindHealth, me: bindMe };
  if (renderers[currentPage]) {
    main.innerHTML = renderers[currentPage]();
    binders[currentPage] && binders[currentPage]();
  }
}

function updateBadge() {
  const n = getNotifications().length;
  const b = $('#notifBadge');
  if (b) { b.textContent = n; b.style.display = n > 0 ? 'flex' : 'none'; }
}

// ========== 首页 ==========
function renderHome() {
  const profile = getProfile();
  const stats = getTodayStats();
  const adh = getAdherence(7);
  const meds = get('meds');
  const c = (LS.get('checkins') || {})[today()] || {};
  const tip = getSmartTip();
  const nextVisit = getNextVisits()[0];

  // 即将服药
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const upcoming = [];
  meds.forEach(m => m.times.forEach(t => {
    const [h, mn] = t.split(':').map(Number);
    const tMin = h * 60 + mn;
    const k = m.id + '_' + t;
    const done = !!c[k]?.done;
    upcoming.push({ med: m, time: t, tMin, key: k, done, overdue: !done && tMin < nowMin });
  }));
  upcoming.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.tMin - b.tMin;
  });

  // 7天趋势
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const s = getDayStats(fmt(d));
    const labels = ['日','一','二','三','四','五','六'];
    trend.push({ d: labels[d.getDay()], pct: s.pct, isToday: i === 0 });
  }

  return `
    <!-- 主卡片 -->
    <div class="hero-card">
      <div class="hero-greeting">${getGreeting()}</div>
      <div class="hero-name">${escapeHtml(profile.name)} 您好 👋</div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="hero-stat-num">${stats.total}</div><div class="hero-stat-label">今日总次数</div></div>
        <div class="hero-stat"><div class="hero-stat-num">${stats.done}</div><div class="hero-stat-label">已服药</div></div>
        <div class="hero-stat"><div class="hero-stat-num">${stats.remain}</div><div class="hero-stat-label">待完成</div></div>
      </div>
      <div class="hero-progress"><div class="hero-progress-fill" style="width:${stats.pct}%"></div></div>
      <div class="hero-progress-text"><span>今日完成度</span><span>${stats.pct}%</span></div>
    </div>

    <!-- 慢病管理流程 -->
    <div class="guide-card">
      <div class="guide-title">🌟 慢病管理全流程</div>
      <div class="guide-steps">
        <div class="guide-step done"><div class="guide-step-icon">🩺</div><div class="guide-step-label">问诊</div></div>
        <div class="guide-step done"><div class="guide-step-icon">📝</div><div class="guide-step-label">开方</div></div>
        <div class="guide-step done"><div class="guide-step-icon">📦</div><div class="guide-step-label">购药</div></div>
        <div class="guide-step current"><div class="guide-step-icon">💊</div><div class="guide-step-label">用药</div></div>
        <div class="guide-step"><div class="guide-step-icon">🔄</div><div class="guide-step-label">续方</div></div>
      </div>
    </div>

    <!-- 智能建议 -->
    <div class="tip-card" id="tipCard">
      <div class="tip-icon">${tip.icon}</div>
      <div class="tip-body">
        <div class="tip-title">${tip.title}</div>
        <div class="tip-text">${tip.text}</div>
        <span class="tip-action">${tip.action}</span>
      </div>
    </div>

    <!-- 快捷功能 -->
    <div class="quick-grid">
      <div class="quick-item highlight" data-action="ai"><span class="quick-emoji">🤖</span><div class="quick-label">AI问诊</div></div>
      <div class="quick-item" data-action="bp"><span class="quick-emoji">❤️</span><div class="quick-label">记血压</div></div>
      <div class="quick-item" data-action="bg"><span class="quick-emoji">🩸</span><div class="quick-label">记血糖</div></div>
      <div class="quick-item" data-action="refill"><span class="quick-emoji">🔄</span><div class="quick-label">续方</div></div>
    </div>

    <!-- 复诊提醒 -->
    ${nextVisit ? (() => {
      const d = daysBetween(today(), nextVisit.date);
      return `<div class="visit-card-home" id="visitCardHome">
        <div class="vc-icon">🏥</div>
        <div class="vc-body">
          <div class="vc-title">${escapeHtml(nextVisit.doctor)} · ${escapeHtml(nextVisit.dept)}</div>
          <div class="vc-desc">${fmtCN(nextVisit.date)} ${nextVisit.time} · ${escapeHtml(nextVisit.hospital)}</div>
        </div>
        <div class="vc-days">
          <div class="vc-days-num">${d}</div>
          <div class="vc-days-label">${d === 0 ? '今天' : '天后'}</div>
        </div>
      </div>`;
    })() : ''}

    <!-- 今日服药 -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">💊 今日服药计划</div>
        <span class="card-more" id="goCheckin">去打卡 →</span>
      </div>
      ${upcoming.length === 0 ? `<div class="empty-state" style="padding:20px"><div class="empty-icon">📋</div><div class="empty-text">还没有用药计划</div><div class="empty-hint">点击下方"用药"添加</div></div>` :
      upcoming.slice(0, 5).map(u => `
        <div class="med-item">
          <div class="med-icon ${u.med.type}">${medEmoji(u.med.type)}</div>
          <div class="med-body">
            <div class="med-name">${escapeHtml(u.med.name)}</div>
            <div class="med-desc">
              <span class="med-time-tag">⏰ ${u.time}</span>
              ${escapeHtml(u.med.dose)} · ${escapeHtml(u.med.notes||'')}
            </div>
          </div>
          <div class="med-right">
            <button class="btn-take ${u.done ? 'done' : (u.overdue ? 'overdue' : '')}" data-key="${u.key}" ${u.done?'disabled':''}>
              ${u.done ? '已服 ✓' : (u.overdue ? '补服' : '服药')}
            </button>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- 7天依从率 -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">📊 近7天服药表现</div>
        <span class="card-more" style="color:${adh>=80?'var(--mint)':adh>=60?'var(--amber)':'var(--coral)'}">${adh}%</span>
      </div>
      <div class="chart-bars">
        ${trend.map(t => `<div class="chart-bar ${t.pct>=80?'good':t.pct>=50?'ok':'bad'}" style="height:${Math.max(t.pct,5)}%" data-pct="${t.pct}"></div>`).join('')}
      </div>
      <div class="chart-labels">${trend.map(t => `<span style="${t.isToday?'color:var(--mint);font-weight:700':''}">周${t.d}</span>`).join('')}</div>
    </div>

    <!-- 库存预警 -->
    ${getLowStock().length ? `
    <div class="card">
      <div class="card-accent" style="background:var(--coral)"></div>
      <div class="card-header">
        <div class="card-title" style="color:var(--coral)">⚠️ 库存预警</div>
        <span class="card-more" id="goStock">查看药箱 →</span>
      </div>
      ${getLowStock().map(m => {
        const daily = m.times.length * (m.perTime || 1);
        const days = daily > 0 ? Math.floor(m.stock / daily) : 0;
        return `<div class="med-item">
          <div class="med-icon" style="background:var(--coral-light);color:var(--coral)">⚠️</div>
          <div class="med-body">
            <div class="med-name">${escapeHtml(m.name)}</div>
            <div class="med-desc">仅剩 ${m.stock}${m.unit} · 约可用 <strong style="color:var(--coral)">${days}</strong> 天</div>
          </div>
          <button class="btn-take" data-refill="${m.id}" style="background:var(--coral)">续方</button>
        </div>`;
      }).join('')}
    </div>` : ''}
  `;
}

function bindHome() {
  $$('.btn-take[data-key]').forEach(b => b.addEventListener('click', () => doCheckin(b.dataset.key)));
  $$('.btn-take[data-refill]').forEach(b => b.addEventListener('click', () => showRefillModal(b.dataset.refill)));
  $('#goCheckin')?.addEventListener('click', () => navigate('checkin'));
  $('#goStock')?.addEventListener('click', () => navigate('me'));
  $('#visitCardHome')?.addEventListener('click', () => showVisitDetail(getNextVisits()[0]));
  $$('.quick-item').forEach(q => q.addEventListener('click', () => quickAction(q.dataset.action)));
  $('#tipCard')?.addEventListener('click', () => {
    const tip = getSmartTip();
    if (tip.action.includes('血压')) showRecordModal('bp');
    else if (tip.action.includes('血糖')) showRecordModal('bg');
    else if (tip.action.includes('家人')) navigate('me');
    else if (tip.action.includes('续方')) showRefillListModal();
    else toast('继续保持良好的服药习惯哦~', 'success');
  });
}

function quickAction(a) {
  if (a === 'ai') openAI();
  else if (a === 'bp') showRecordModal('bp');
  else if (a === 'bg') showRecordModal('bg');
  else if (a === 'refill') showRefillListModal();
}

function medEmoji(t) {
  return ({ pill: '💊', injection: '💉', liquid: '🧴', topical: '🩹' })[t] || '💊';
}

function doCheckin(key, dateStr) {
  const date = dateStr || today();
  const c = LS.get('checkins') || {};
  if (!c[date]) c[date] = {};
  const isFirst = !c[date][key]?.done;
  c[date][key] = { medId: key.split('_')[0], time: key.split('_').slice(1).join('_'), done: true, ts: new Date().toISOString() };
  LS.set('checkins', c);
  // 扣库存（仅今日）
  if (date === today() && isFirst) {
    const meds = get('meds');
    const m = meds.find(x => x.id === key.split('_')[0]);
    if (m && m.stock > 0) { m.stock -= (m.perTime || 1); set('meds', meds); }
  }
  // 全部完成则庆祝
  const stats = getTodayStats();
  if (stats.remain === 0 && stats.total > 0 && date === today()) {
    confetti();
    toast('太棒了！今日服药已全部完成 🎉', 'success');
  } else {
    toast('打卡成功，记得多喝水哦 ✓', 'success');
  }
  renderPage();
}

// ========== 用药计划页 ==========
let planFilter = 'all';
function renderPlan() {
  const meds = get('meds');
  const diseases = ['all', ...new Set(meds.map(m => m.disease).filter(Boolean))];
  const filtered = planFilter === 'all' ? meds : meds.filter(m => m.disease === planFilter);
  const colors = { '高血压':'mint', '2型糖尿病':'amber', '高血脂':'purple', '冠心病':'coral' };

  return `
    <div class="page-header"><div><div class="page-title">📋 用药计划</div><div class="page-subtitle">管理您的日常用药方案</div></div></div>
    <button class="plan-add" id="addMedBtn">＋ 添加新药品</button>
    <div class="tabs">${diseases.map(d => `<div class="tab ${planFilter===d?'active':''}" data-d="${d}">${d==='all'?'全部':d}</div>`).join('')}</div>
    ${filtered.length === 0 ? `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">暂无用药计划</div><div class="empty-hint">点击上方"添加新药品"开始</div></div>` :
    filtered.map(m => {
      const daily = m.times.length * (m.perTime || 1);
      const daysLeft = daily > 0 ? Math.floor(m.stock / daily) : 999;
      const c = colors[m.disease] || 'mint';
      return `
      <div class="card plan-card ${c}">
        <div class="card-accent"></div>
        <div class="med-item" style="border:none;padding:0">
          <div class="med-icon ${m.type}">${medEmoji(m.type)}</div>
          <div class="med-body">
            <div class="med-name">${escapeHtml(m.name)}</div>
            <div class="med-desc">${escapeHtml(m.dose)} × ${m.perTime||1} · ${m.freq || '每日'+m.times.length+'次'}</div>
          </div>
        </div>
        <div class="plan-meta">
          ${m.times.map(t => `<span class="plan-tag mint">⏰ ${t}</span>`).join('')}
          <span class="plan-tag">🏥 ${escapeHtml(m.disease)}</span>
          <span class="plan-tag">👨‍⚕️ ${escapeHtml(m.doctor)}</span>
          ${daysLeft <= 7 ? `<span class="plan-tag coral">⚠️ 仅剩${daysLeft}天</span>` : `<span class="plan-tag">📦 ${m.stock}${m.unit}</span>`}
        </div>
        ${m.warnings ? `<div style="font-size:11px;color:var(--coral);margin-top:8px;display:flex;align-items:center;gap:4px">⚠️ ${escapeHtml(m.warnings)}</div>` : ''}
        ${m.notes ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">📌 ${escapeHtml(m.notes)}</div>` : ''}
        <div class="plan-actions">
          <button class="btn-info" data-detail="${m.id}">详情</button>
          <button class="btn-ghost" data-edit="${m.id}">编辑</button>
          <button class="btn-danger" data-del="${m.id}">删除</button>
        </div>
      </div>`;
    }).join('')}

    <div class="knowledge-card">
      <div class="kc-title">📚 用药小知识</div>
      <div class="kc-text">
        1. 服药时间很重要：部分降压药宜晨起服用，降糖药需配合进餐<br>
        2. 不可自行停药：血压血糖稳定不代表可以停药，请遵医嘱<br>
        3. 注意药物相互作用：服用多种药物时，间隔至少30分钟
      </div>
    </div>
  `;
}

function bindPlan() {
  $('#addMedBtn').addEventListener('click', () => showMedForm());
  $$('.tab').forEach(t => t.addEventListener('click', () => { planFilter = t.dataset.d; renderPage(); }));
  $$('[data-detail]').forEach(b => b.addEventListener('click', () => showMedDetail(b.dataset.detail)));
  $$('[data-edit]').forEach(b => b.addEventListener('click', () => showMedForm(get('meds').find(m=>m.id===b.dataset.edit))));
  $$('[data-del]').forEach(b => b.addEventListener('click', () => {
    if (confirm('确认删除该药品？删除后不可恢复。')) {
      set('meds', get('meds').filter(m => m.id !== b.dataset.del));
      toast('已删除');
      renderPage();
    }
  }));
}

function showMedDetail(id) {
  const m = get('meds').find(x => x.id === id); if (!m) return;
  const daily = m.times.length * (m.perTime || 1);
  const daysLeft = daily > 0 ? Math.floor(m.stock / daily) : 999;
  showModal(`
    <div class="modal-title">${medEmoji(m.type)} 药品详情 <span class="modal-close" onclick="hideModal()">✕</span></div>
    <div style="text-align:center;padding:10px 0 16px">
      <div style="font-size:40px;margin-bottom:8px">${medEmoji(m.type)}</div>
      <div style="font-size:18px;font-weight:800">${escapeHtml(m.name)}</div>
      <div style="font-size:13px;color:var(--text3);margin-top:4px">${escapeHtml(m.dose)} · ${escapeHtml(m.disease)}</div>
    </div>
    <div class="detail-section">
      <div class="detail-row"><span class="detail-label">服药频率</span><span class="detail-value">${m.times.map(t=>'⏰ '+t).join(' / ')}</span></div>
      <div class="detail-row"><span class="detail-label">单次用量</span><span class="detail-value">${m.perTime||1} ${m.unit}</span></div>
      <div class="detail-row"><span class="detail-label">剩余库存</span><span class="detail-value" style="color:${daysLeft<=7?'var(--coral)':'var(--mint)'}">${m.stock} ${m.unit}（约${daysLeft}天）</span></div>
    </div>
    <div class="detail-section">
      <div class="detail-row"><span class="detail-label">开方医生</span><span class="detail-value">${escapeHtml(m.doctor)} · ${escapeHtml(m.dept||'')}</span></div>
      <div class="detail-row"><span class="detail-label">开始日期</span><span class="detail-value">${m.startDate||'--'}</span></div>
      <div class="detail-row"><span class="detail-label">处方有效期</span><span class="detail-value">${m.endDate||'--'}</span></div>
    </div>
    ${m.notes ? `<div class="detail-section"><div class="detail-row"><span class="detail-label">服用说明</span><span class="detail-value">${escapeHtml(m.notes)}</span></div></div>` : ''}
    ${m.warnings ? `<div class="tip-card" style="margin:12px 0"><div class="tip-icon">⚠️</div><div class="tip-body"><div class="tip-title">注意事项</div><div class="tip-text">${escapeHtml(m.warnings)}</div></div></div>` : ''}
    <button class="btn-primary" onclick="hideModal();showRefillModal('${m.id}')">一键续方</button>
  `);
}

function showMedForm(med) {
  const m = med || { name:'', type:'pill', dose:'', perTime:1, times:['08:00'], stock:30, totalStock:30, unit:'片', notes:'', warnings:'', disease:'高血压', doctor:'', dept:'', startDate:today(), endDate:addDays(90) };
  const isEdit = !!med;
  const presets = ['06:00','07:00','07:30','08:00','12:00','13:00','18:00','19:00','21:00','22:00'];
  showModal(`
    <div class="modal-title">${isEdit?'编辑':'添加'}药品 <span class="modal-close" onclick="hideModal()">✕</span></div>
    <div class="form-group"><label class="form-label">药品名称 <span class="req">*</span></label><input id="f_name" value="${escapeHtml(m.name)}" placeholder="如：苯磺酸氨氯地平片" /></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">剂型</label>
        <div class="chip-group" id="typeChips">
          <div class="chip-large ${m.type==='pill'?'active':''}" data-v="pill"><span>💊</span>片剂</div>
          <div class="chip-large ${m.type==='injection'?'active':''}" data-v="injection"><span>💉</span>注射</div>
          <div class="chip-large ${m.type==='liquid'?'active':''}" data-v="liquid"><span>🧴</span>口服液</div>
          <div class="chip-large ${m.type==='topical'?'active':''}" data-v="topical"><span>🩹</span>外用</div>
        </div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">单次剂量</label><input id="f_dose" value="${escapeHtml(m.dose)}" placeholder="如 5mg" /></div>
      <div class="form-group"><label class="form-label">单次用量</label><input id="f_perTime" type="number" value="${m.perTime||1}" min="1" /></div>
    </div>
    <div class="form-group"><label class="form-label">所属疾病</label>
      <select id="f_disease">
        ${['高血压','2型糖尿病','高血脂','冠心病','其他'].map(d => `<option ${m.disease===d?'selected':''}>${d}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label class="form-label">服药时间 <span class="req">*</span></label>
      <div class="chip-group" id="timeChips">
        ${presets.map(t => `<div class="chip ${m.times.includes(t)?'active':''}" data-t="${t}">${t}</div>`).join('')}
      </div>
      <div class="form-hint">点击选择每日服药时间点</div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">当前库存</label><input id="f_stock" type="number" value="${m.stock}" /></div>
      <div class="form-group"><label class="form-label">单位</label><input id="f_unit" value="${escapeHtml(m.unit)}" placeholder="片/支/ml" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">开方医生</label><input id="f_doctor" value="${escapeHtml(m.doctor)}" placeholder="如：张主任" /></div>
      <div class="form-group"><label class="form-label">科室</label><input id="f_dept" value="${escapeHtml(m.dept||'')}" placeholder="如：心内科" /></div>
    </div>
    <div class="form-group"><label class="form-label">服用说明</label><textarea id="f_notes" rows="2" placeholder="如：饭前30分钟服用">${escapeHtml(m.notes)}</textarea></div>
    <div class="form-group"><label class="form-label">注意事项</label><input id="f_warn" value="${escapeHtml(m.warnings||'')}" placeholder="如：避免与XX同服" /></div>
    <button class="btn-primary" id="saveMedBtn">${isEdit?'保存修改':'添加药品'}</button>
  `);
  // 交互
  document.querySelectorAll('#typeChips .chip-large').forEach(c => c.addEventListener('click', () => {
    document.querySelectorAll('#typeChips .chip-large').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
  }));
  document.querySelectorAll('#timeChips .chip').forEach(c => c.addEventListener('click', () => c.classList.toggle('active')));
  $('#saveMedBtn').addEventListener('click', () => {
    const name = $('#f_name').value.trim();
    if (!name) return toast('请填写药品名称');
    const times = [...document.querySelectorAll('#timeChips .chip.active')].map(c => c.dataset.t).sort();
    if (!times.length) return toast('请至少选择一个服药时间');
    const type = document.querySelector('#typeChips .chip-large.active')?.dataset.v || 'pill';
    const stock = parseInt($('#f_stock').value) || 0;
    const data = {
      id: med?.id || 'med_'+uid(), name, type, dose: $('#f_dose').value, perTime: parseInt($('#f_perTime').value)||1,
      times, stock, totalStock: Math.max(stock, m.totalStock||0), unit: $('#f_unit').value||'片',
      notes: $('#f_notes').value, warnings: $('#f_warn').value, disease: $('#f_disease').value,
      doctor: $('#f_doctor').value, dept: $('#f_dept').value, startDate: m.startDate||today(), endDate: m.endDate||addDays(90), refillEnabled: true
    };
    const meds = get('meds');
    if (med?.id) { const i = meds.findIndex(x=>x.id===med.id); if (i>=0) meds[i]={...meds[i],...data}; }
    else meds.push(data);
    set('meds', meds);
    hideModal(); toast(med?.id?'修改成功':'添加成功','success'); renderPage();
  });
}

// ========== 打卡页 ==========
let checkinDate = today();
function renderCheckin() {
  const meds = get('meds');
  const sel = checkinDate;
  const isToday = sel === today();
  const c = (LS.get('checkins') || {})[sel] || {};
  const stats = getDayStats(sel);
  const nowMin = new Date().getHours()*60+new Date().getMinutes();

  // 7天选择器
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    const dk = fmt(d);
    const ds = getDayStats(dk);
    const labels = ['日','一','二','三','四','五','六'];
    week.push({ date: dk, label: labels[d.getDay()], num: d.getDate(), pct: ds.pct, isToday: dk === today() });
  }

  // 时间轴
  const items = [];
  meds.forEach(m => m.times.forEach(t => {
    const k = m.id+'_'+t;
    const done = !!c[k]?.done;
    const [h, mn] = t.split(':').map(Number);
    const tMin = h*60+mn;
    const overdue = isToday && !done && tMin < nowMin;
    items.push({ med: m, time: t, tMin, key: k, done, overdue, status: done ? 'done' : (overdue || !isToday ? 'missed' : 'upcoming') });
  }));
  items.sort((a,b) => a.tMin-b.tMin);

  // 按时间分组
  const groups = {};
  items.forEach(it => { if (!groups[it.time]) groups[it.time] = []; groups[it.time].push(it); });

  return `
    <div class="page-header"><div><div class="page-title">✅ 服药打卡</div><div class="page-subtitle">坚持每一次，健康多一步</div></div></div>
    <div class="checkin-hero">
      <div class="ch-date">${sel}${isToday?' · 今天':''}</div>
      <div class="ch-progress">
        <div class="ch-num">${stats.done}</div>
        <div class="ch-total">/ ${stats.total}</div>
      </div>
      <div class="ch-label">已完成服药次数</div>
      <div class="ch-bar"><div class="ch-bar-fill" style="width:${stats.pct}%"></div></div>
    </div>
    <div class="week-selector">
      ${week.map(w => `<div class="week-day ${w.date===sel?'active':''}" data-d="${w.date}">
        <span class="wd-label">${w.isToday?'今天':'周'+w.label}</span>
        <span class="wd-num">${w.num}</span>
        ${w.pct === 100 ? '<span class="wd-status ok"></span>' : w.pct > 0 ? '<span class="wd-status partial"></span>' : w.pct === 0 && w.date < today() ? '<span class="wd-status bad"></span>' : ''}
      </div>`).join('')}
    </div>
    ${Object.keys(groups).length === 0 ? `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">暂无服药计划</div></div>` : `
    <div class="timeline">
      ${Object.entries(groups).sort(([a],[b])=>a.localeCompare(b)).map(([time, meds]) => {
        const allDone = meds.every(m => m.done);
        const anyOverdue = meds.some(m => m.overdue);
        const status = allDone ? 'done' : (anyOverdue || (!isToday) ? 'missed' : 'upcoming');
        return `<div class="tl-item ${status}">
          <div class="tl-dot"></div>
          <div class="tl-time-row">
            <span class="tl-time">${time}</span>
            <span class="tl-status ${status}">${status==='done'?'✓ 已完成':status==='missed'?'✗ 未完成':'⏰ 待服药'}</span>
          </div>
          <div class="tl-content">
            <div class="tl-meds">
              ${meds.map(it => `<div class="tl-med-row">
                <span class="tl-med-pill">${medEmoji(it.med.type)}</span>
                <span class="tl-med-name">${escapeHtml(it.med.name)}</span>
                <span class="tl-med-dose">${it.med.dose} × ${it.med.perTime||1}</span>
              </div>`).join('')}
            </div>
            ${!allDone ? `<div class="tl-actions">
              ${meds.filter(m=>!m.done).map(m => `<button class="btn-ghost" data-ck="${m.key}" data-date="${sel}">${m.overdue?'补服打卡':'完成打卡'}</button>`).join('')}
            </div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`}
  `;
}

function bindCheckin() {
  $$('.week-day').forEach(w => w.addEventListener('click', () => { checkinDate = w.dataset.d; renderPage(); }));
  $$('[data-ck]').forEach(b => b.addEventListener('click', () => doCheckin(b.dataset.ck, b.dataset.date)));
}

// ========== 健康档案页 ==========
let healthTab = 'bp';
function renderHealth() {
  const bp = get('bp').sort((a,b)=>a.date.localeCompare(b.date));
  const bg = get('bg').sort((a,b)=>a.date.localeCompare(b.date));
  
  // 最近血压
  const lastBP = bp[bp.length-1];
  const lastBG = bg[bg.length-1];
  const bpTrend = bp.length >= 2 ? (bp[bp.length-1].sys > bp[bp.length-2].sys ? 'up' : bp[bp.length-1].sys < bp[bp.length-2].sys ? 'down' : 'stable') : 'stable';
  const bgTrend = bg.length >= 2 ? (parseFloat(bg[bg.length-1].value) > parseFloat(bg[bg.length-2].value) ? 'up' : parseFloat(bg[bg.length-1].value) < parseFloat(bg[bg.length-2].value) ? 'down' : 'stable') : 'stable';

  return `
    <div class="page-header"><div><div class="page-title">❤️ 健康档案</div><div class="page-subtitle">记录身体指标变化</div></div></div>
    <div class="health-tabs">
      <div class="health-tab ${healthTab==='bp'?'active':''}" data-ht="bp">🩺 血压</div>
      <div class="health-tab ${healthTab==='bg'?'active':''}" data-ht="bg">🩸 血糖</div>
    </div>

    ${healthTab === 'bp' ? `
      <div class="health-summary">
        <div class="hs-row">
          <div class="hs-icon bp">🩺</div>
          <div class="hs-info">
            <div class="hs-value">${lastBP ? lastBP.sys+'/'+lastBP.dia : '--'}<small>mmHg</small></div>
            <div class="hs-label">最近一次血压 · ${lastBP ? fmtCN(lastBP.date) : '暂无'}</div>
          </div>
          <div class="hs-trend ${bpTrend}">${bpTrend==='up'?'↑ 偏高':bpTrend==='down'?'↓ 下降':'→ 平稳'}</div>
        </div>
      </div>
      <button class="plan-add" id="addBPBtn">＋ 记录血压</button>
      <div class="card">
        <div class="card-title" style="margin-bottom:10px">📈 近30天血压趋势</div>
        <div class="chart-bars" style="height:90px">
          ${bp.slice(-14).map(r => {
            const normal = r.sys <= 130 && r.dia <= 85;
            const high = r.sys >= 140 || r.dia >= 90;
            return `<div class="chart-bar ${high?'bad':normal?'good':'ok'}" style="height:${Math.max(20, (r.sys-80)/80*100)}%" data-pct="${r.sys}/${r.dia}" title="${r.date}: ${r.sys}/${r.dia}"></div>`;
          }).join('')}
        </div>
        <div class="form-hint" style="text-align:center">收缩压趋势（绿：正常 黄：注意 红：偏高）</div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">📝 历史记录</div></div>
        <div class="record-list">
          ${bp.slice(-8).reverse().map(r => {
            const status = (r.sys >= 140 || r.dia >= 90) ? 'high' : (r.sys <= 130 && r.dia <= 85) ? 'normal' : 'normal';
            return `<div class="record-item">
              <div class="record-date"><div class="record-day">${new Date(r.date).getDate()}</div><div class="record-month">${new Date(r.date).getMonth()+1}月</div></div>
              <div class="record-body"><div class="record-value">${r.sys}/${r.dia} mmHg <span style="color:var(--text3);font-weight:400">· 脉搏 ${r.pulse||'--'}</span></div><div class="record-note">${r.note||'无备注'}</div></div>
              <span class="record-status rs-${status}">${status==='high'?'偏高':'正常'}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    ` : `
      <div class="health-summary">
        <div class="hs-row">
          <div class="hs-icon bg">🩸</div>
          <div class="hs-info">
            <div class="hs-value">${lastBG ? lastBG.value : '--'}<small>mmol/L</small></div>
            <div class="hs-label">最近一次空腹血糖 · ${lastBG ? fmtCN(lastBG.date) : '暂无'}</div>
          </div>
          <div class="hs-trend ${bgTrend}">${bgTrend==='up'?'↑ 偏高':bgTrend==='down'?'↓ 下降':'→ 平稳'}</div>
        </div>
      </div>
      <button class="plan-add" id="addBGBtn">＋ 记录血糖</button>
      <div class="card">
        <div class="card-title" style="margin-bottom:10px">📈 近30天血糖趋势</div>
        <div class="chart-bars" style="height:90px">
          ${bg.slice(-10).map(r => {
            const v = parseFloat(r.value);
            const s = v >= 7.0 ? 'bad' : v >= 6.1 ? 'ok' : 'good';
            return `<div class="chart-bar ${s}" style="height:${Math.max(20, (v-3)/6*100)}%" data-pct="${r.value}"></div>`;
          }).join('')}
        </div>
        <div class="form-hint" style="text-align:center">空腹血糖值趋势（绿≤6.1 黄≤7.0 红>7.0 mmol/L）</div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">📝 历史记录</div></div>
        <div class="record-list">
          ${bg.slice(-8).reverse().map(r => {
            const v = parseFloat(r.value);
            const status = v >= 7.0 ? 'high' : v <= 6.1 ? 'normal' : 'normal';
            return `<div class="record-item">
              <div class="record-date"><div class="record-day">${new Date(r.date).getDate()}</div><div class="record-month">${new Date(r.date).getMonth()+1}月</div></div>
              <div class="record-body"><div class="record-value">${r.value} mmol/L</div><div class="record-note">${r.period==='fasting'?'空腹':'餐后'} · ${r.note||'无备注'}</div></div>
              <span class="record-status rs-${status}">${status==='high'?'偏高':'正常'}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    `}

    <div class="knowledge-card">
      <div class="kc-title">💡 ${healthTab==='bp'?'血压':'血糖'}管理小贴士</div>
      <div class="kc-text">${healthTab==='bp'?
        '正常血压：收缩压<130 且 舒张压<85 mmHg<br>建议每日早晚各测一次，安静坐5分钟后测量<br>减少钠盐摄入（<6g/天），适度运动有助于控压' :
        '空腹血糖正常范围：3.9-6.1 mmol/L<br>建议每周测量2-3次空腹血糖<br>控制碳水化合物摄入，饭后30分钟适当散步有助于降糖'
      }</div>
    </div>
  `;
}

function bindHealth() {
  $$('.health-tab').forEach(t => t.addEventListener('click', () => { healthTab = t.dataset.ht; renderPage(); }));
  $('#addBPBtn')?.addEventListener('click', () => showRecordModal('bp'));
  $('#addBGBtn')?.addEventListener('click', () => showRecordModal('bg'));
}

function showRecordModal(type) {
  if (type === 'bp') {
    showModal(`
      <div class="modal-title">🩺 记录血压 <span class="modal-close" onclick="hideModal()">✕</span></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">收缩压（高压）<span class="req">*</span></label><input id="r_sys" type="number" placeholder="如 128" /></div>
        <div class="form-group"><label class="form-label">舒张压（低压）<span class="req">*</span></label><input id="r_dia" type="number" placeholder="如 82" /></div>
      </div>
      <div class="form-group"><label class="form-label">脉搏</label><input id="r_pulse" type="number" placeholder="如 72" /></div>
      <div class="form-group"><label class="form-label">备注</label><input id="r_note" placeholder="如：服药后测量" /></div>
      <button class="btn-primary" id="saveBPBtn">保存记录</button>
    `);
    $('#saveBPBtn').addEventListener('click', () => {
      const sys = parseInt($('#r_sys').value); const dia = parseInt($('#r_dia').value);
      if (!sys || !dia) return toast('请填写血压值');
      const bp = get('bp');
      bp.push({ id: uid(), date: today(), time: pad(new Date().getHours())+':'+pad(new Date().getMinutes()), sys, dia, pulse: parseInt($('#r_pulse').value)||0, note: $('#r_note').value });
      set('bp', bp); hideModal(); toast('血压记录已保存','success'); renderPage();
    });
  } else {
    showModal(`
      <div class="modal-title">🩸 记录血糖 <span class="modal-close" onclick="hideModal()">✕</span></div>
      <div class="form-group"><label class="form-label">血糖值 <span class="req">*</span></label><input id="r_bg" type="number" step="0.1" placeholder="如 5.8" /></div>
      <div class="form-group"><label class="form-label">测量时段</label>
        <div class="chip-group" id="bgPeriod">
          <div class="chip active" data-v="fasting">空腹</div>
          <div class="chip" data-v="after">餐后2小时</div>
          <div class="chip" data-v="random">随机</div>
        </div>
      </div>
      <div class="form-group"><label class="form-label">备注</label><input id="r_bgnote" placeholder="如：未进食" /></div>
      <button class="btn-primary" id="saveBGBtn">保存记录</button>
    `);
    document.querySelectorAll('#bgPeriod .chip').forEach(c => c.addEventListener('click', () => {
      document.querySelectorAll('#bgPeriod .chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
    }));
    $('#saveBGBtn').addEventListener('click', () => {
      const v = parseFloat($('#r_bg').value);
      if (!v) return toast('请填写血糖值');
      const bg = get('bg');
      const period = document.querySelector('#bgPeriod .chip.active')?.dataset.v || 'fasting';
      bg.push({ id: uid(), date: today(), time: pad(new Date().getHours())+':'+pad(new Date().getMinutes()), value: v.toFixed(1), period, note: $('#r_bgnote').value });
      set('bg', bg); hideModal(); toast('血糖记录已保存','success'); renderPage();
    });
  }
}

// ========== 我的页 ==========
function renderMe() {
  const p = getProfile();
  const meds = get('meds');
  const visits = get('visits');
  const adh = getAdherence(30);
  const checkinDays = Object.keys(LS.get('checkins') || {}).length;
  const lowCount = getLowStock().length;
  const upVisits = getNextVisits().length;

  return `
    <div class="profile-card">
      <div class="profile-row">
        <div class="profile-avatar">${p.name[0]}</div>
        <div>
          <div class="profile-name">${escapeHtml(p.name)}</div>
          <div class="profile-id">${p.age ? p.age+'岁' : ''} · ${p.gender || ''}</div>
          <div class="profile-tags">${(p.diseases||[]).map(d => `<span class="profile-tag">${d}</span>`).join('')}</div>
        </div>
      </div>
      <div class="profile-stats">
        <div class="profile-stat"><strong>${meds.length}</strong><span>用药种类</span></div>
        <div class="profile-stat"><strong>${adh}%</strong><span>30天依从率</span></div>
        <div class="profile-stat"><strong>${checkinDays}</strong><span>打卡天数</span></div>
      </div>
    </div>

    <div class="menu-list">
      <div class="menu-item" id="visitMgr"><div class="mi-icon amber">🏥</div><div><div class="mi-text">复诊管理</div><div class="mi-desc">管理预约、设置提醒</div></div><span class="mi-arrow">${upVisits?`<span class="mi-badge">${upVisits}</span>`:''} ›</span></div>
      <div class="menu-item" id="addVisitBtn"><div class="mi-icon sky">📅</div><div><div class="mi-text">添加复诊提醒</div><div class="mi-desc">预约下次复诊时间</div></div><span class="mi-arrow">›</span></div>
      <div class="menu-item" id="stockMgr"><div class="mi-icon coral">📦</div><div><div class="mi-text">药箱库存</div><div class="mi-desc">查看药品余量、一键续方</div></div><span class="mi-arrow">${lowCount?`<span class="mi-badge">${lowCount}</span>`:''} ›</span></div>
      <div class="menu-item" id="refillBtn"><div class="mi-icon mint">🔄</div><div><div class="mi-text">在线复诊续方</div><div class="mi-desc">线上开处方、配送到家</div></div><span class="mi-arrow">›</span></div>
    </div>

    <div class="menu-list">
      <div class="menu-item" id="familyBtn"><div class="mi-icon purple">👨‍👩‍👧</div><div><div class="mi-text">家人代管</div><div class="mi-desc">邀请子女协助监督服药</div></div><span class="mi-arrow">›</span></div>
      <div class="menu-item" onclick="toast('用药知识库开发中')"><div class="mi-icon mint">📚</div><div><div class="mi-text">用药知识库</div><div class="mi-desc">药品说明、相互作用查询</div></div><span class="mi-arrow">›</span></div>
      <div class="menu-item" onclick="toast('提醒设置功能开发中')"><div class="mi-icon sky">🔔</div><div><div class="mi-text">提醒设置</div><div class="mi-desc">声音、震动、提前时间</div></div><span class="mi-arrow">›</span></div>
    </div>

    <div class="menu-list">
      <div class="menu-item" id="elderToggle"><div class="mi-icon amber">👴</div><div><div class="mi-text">关怀版（大字体）</div><div class="mi-desc">为长辈优化，字体更大、按钮更大</div></div><span class="mi-arrow">${document.body.classList.contains('elder-mode')?'✅ 已开启':'开启 ›'}</span></div>
    </div>
    <div class="menu-list">
      <div class="menu-item" onclick="toast('当前版本 v2.0')"><div class="mi-icon mint">ℹ️</div><div class="mi-text">关于暖心管家</div><span class="mi-arrow">v2.0</span></div>
      <div class="menu-item" onclick="if(confirm('将清空所有数据并恢复演示数据，确定？')){localStorage.clear();location.reload();}"><div class="mi-icon coral">🔄</div><div class="mi-text" style="color:var(--coral)">重置演示数据</div><span class="mi-arrow">›</span></div>
    </div>
  `;
}

function bindMe() {
  $('#visitMgr')?.addEventListener('click', showVisitList);
  $('#addVisitBtn')?.addEventListener('click', () => showVisitForm());
  $('#stockMgr')?.addEventListener('click', showStockModal);
  $('#refillBtn')?.addEventListener('click', showRefillListModal);
  $('#familyBtn')?.addEventListener('click', showFamilyModal);
  $('#elderToggle')?.addEventListener('click', () => {
    document.body.classList.toggle('elder-mode');
    const on = document.body.classList.contains('elder-mode');
    localStorage.setItem('mc_elder', on ? '1' : '');
    toast(on ? '已切换到关怀版，字体更大更清晰' : '已切换回标准版', 'success');
    renderPage();
  });
}

// ========== 复诊管理 ==========
function showVisitList() {
  const visits = get('visits').sort((a,b) => a.date.localeCompare(b.date));
  showModal(`
    <div class="modal-title">🏥 复诊管理 <span class="modal-close" onclick="hideModal()">✕</span></div>
    <button class="btn-primary" style="margin:0 0 14px" onclick="hideModal();showVisitForm()">＋ 添加复诊</button>
    ${visits.length === 0 ? '<div class="empty-state" style="padding:20px"><div class="empty-icon">📅</div><div class="empty-text">暂无复诊安排</div></div>' :
    visits.map(v => {
      const d = daysBetween(today(), v.date);
      return `<div class="visit-item">
        <div class="card-accent"></div>
        <div class="visit-row">
          <div class="visit-date-block"><div class="visit-date-num">${new Date(v.date).getDate()}</div><div class="visit-date-month">${new Date(v.date).getMonth()+1}月</div></div>
          <div class="visit-info">
            <div class="visit-name">${escapeHtml(v.doctor)} · ${escapeHtml(v.dept)}</div>
            <div class="visit-meta">
              <span class="visit-tag">📍 ${escapeHtml(v.hospital)}</span>
              <span class="visit-tag">⏰ ${v.time}</span>
              <span class="visit-tag">${d>0?d+'天后':d===0?'今天':'已过期'}</span>
            </div>
          </div>
        </div>
        <div class="plan-actions" style="padding-top:10px;margin-top:10px">
          <button class="btn-ghost" onclick="hideModal();showVisitDetail(get('visits').find(x=>x.id==='${v.id}'))">详情</button>
          <button class="btn-danger" onclick="set('visits',get('visits').filter(x=>x.id!=='${v.id}'));hideModal();toast('已删除');renderPage()">删除</button>
        </div>
      </div>`;
    }).join('')}
  `);
}

function showVisitDetail(v) {
  if (!v) return;
  const d = daysBetween(today(), v.date);
  showModal(`
    <div class="modal-title">📋 复诊详情 <span class="modal-close" onclick="hideModal()">✕</span></div>
    <div style="text-align:center;padding:10px 0 14px">
      <div style="font-size:40px;margin-bottom:8px">🏥</div>
      <div style="font-size:17px;font-weight:700">${escapeHtml(v.hospital)}</div>
      <div style="font-size:13px;color:var(--text3);margin-top:4px">${d > 0 ? `还有 ${d} 天` : d === 0 ? '就在今天' : '已过期'}</div>
    </div>
    <div class="detail-section">
      <div class="detail-row"><span class="detail-label">科室</span><span class="detail-value">${escapeHtml(v.dept)}</span></div>
      <div class="detail-row"><span class="detail-label">医生</span><span class="detail-value">${escapeHtml(v.doctor)}</span></div>
      <div class="detail-row"><span class="detail-label">时间</span><span class="detail-value">${v.date} ${v.time}</span></div>
      ${v.notes ? `<div class="detail-row"><span class="detail-label">备注</span><span class="detail-value">${escapeHtml(v.notes)}</span></div>` : ''}
    </div>
    <div class="tip-card" style="margin:14px 0">
      <div class="tip-icon">📝</div>
      <div class="tip-body">
        <div class="tip-title">就诊准备清单</div>
        <div class="tip-text">
          ✅ 带好医保卡 / 身份证<br>
          ✅ 近期用药记录（可截图本APP）<br>
          ✅ ${v.notes || '记录近期身体变化'}  <br>
          ✅ 提前到院挂号或确认预约
        </div>
      </div>
    </div>
  `);
}

function showVisitForm(v) {
  const x = v || { doctor: '', dept: '', hospital: '', date: today(), time: '09:00', notes: '' };
  showModal(`
    <div class="modal-title">${v?'编辑':'添加'}复诊 <span class="modal-close" onclick="hideModal()">✕</span></div>
    <div class="form-group"><label class="form-label">医院 <span class="req">*</span></label><input id="v_hosp" value="${escapeHtml(x.hospital)}" placeholder="如：武汉大学人民医院" /></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">科室</label><input id="v_dept" value="${escapeHtml(x.dept)}" placeholder="如：心内科" /></div>
      <div class="form-group"><label class="form-label">医生</label><input id="v_doc" value="${escapeHtml(x.doctor)}" placeholder="如：张主任" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">日期 <span class="req">*</span></label><input id="v_date" type="date" value="${x.date}" /></div>
      <div class="form-group"><label class="form-label">时间</label><input id="v_time" type="time" value="${x.time}" /></div>
    </div>
    <div class="form-group"><label class="form-label">就诊事项</label><textarea id="v_notes" rows="2" placeholder="如：复查血压">${escapeHtml(x.notes)}</textarea></div>
    <button class="btn-primary" id="saveVisitBtn">${v?'保存修改':'添加复诊'}</button>
  `);
  $('#saveVisitBtn').addEventListener('click', () => {
    const hospital = $('#v_hosp').value.trim();
    const date = $('#v_date').value;
    if (!hospital || !date) return toast('请填写医院和日期');
    const data = { id: v?.id || 'v_'+uid(), hospital, date, dept: $('#v_dept').value, doctor: $('#v_doc').value||'医生', time: $('#v_time').value, notes: $('#v_notes').value, status: 'upcoming', remind: true };
    const visits = get('visits');
    if (v?.id) { const i = visits.findIndex(x=>x.id===v.id); if (i>=0) visits[i]={...visits[i],...data}; }
    else visits.push(data);
    set('visits', visits);
    hideModal(); toast('复诊提醒已设置','success'); renderPage();
  });
}

// ========== 药箱库存 ==========
function showStockModal() {
  const meds = get('meds');
  showModal(`
    <div class="modal-title">📦 药箱库存 <span class="modal-close" onclick="hideModal()">✕</span></div>
    <div class="stock-summary">
      <div class="stock-tile danger"><div class="st-num">${getLowStock().length}</div><div class="st-label">⚠️ 不足</div></div>
      <div class="stock-tile warning"><div class="st-num">${meds.filter(m=>{const d=m.times.length*(m.perTime||1);return d>0&&Math.floor(m.stock/d)>7&&Math.floor(m.stock/d)<=14;}).length}</div><div class="st-label">⏳ 注意</div></div>
      <div class="stock-tile success"><div class="st-num">${meds.filter(m=>{const d=m.times.length*(m.perTime||1);return d<=0||Math.floor(m.stock/d)>14;}).length}</div><div class="st-label">✓ 充足</div></div>
    </div>
    ${meds.map(m => {
      const daily = m.times.length*(m.perTime||1);
      const daysLeft = daily>0 ? Math.floor(m.stock/daily) : 999;
      const pct = m.totalStock > 0 ? Math.min(100, Math.round(m.stock/m.totalStock*100)) : 100;
      const level = daysLeft <= 3 ? 'low' : daysLeft <= 7 ? 'mid' : 'high';
      return `<div class="card stock-card">
        <div class="med-item" style="border:none;padding:0">
          <div class="med-icon ${m.type}">${medEmoji(m.type)}</div>
          <div class="med-body">
            <div class="med-name">${escapeHtml(m.name)}</div>
            <div class="med-desc">${escapeHtml(m.dose)} · ${escapeHtml(m.disease)}</div>
          </div>
          ${daysLeft<=7 ? `<button class="btn-take overdue" onclick="hideModal();showRefillModal('${m.id}')">续方</button>` : ''}
        </div>
        <div class="stock-progress">
          <div class="stock-bar"><div class="stock-bar-fill ${level}" style="width:${pct}%"></div></div>
          <div class="stock-info"><span>剩余 ${m.stock}/${m.totalStock} ${m.unit}</span><span class="stock-days ${level}">${daysLeft>=999?'充足':'约可用 '+daysLeft+' 天'}</span></div>
        </div>
      </div>`;
    }).join('')}
  `);
}

// ========== 续方 ==========
function showRefillModal(id) {
  const m = get('meds').find(x => x.id === id); if (!m) return;
  showModal(`
    <div class="modal-title">🔄 药品续方 <span class="modal-close" onclick="hideModal()">✕</span></div>
    <div style="text-align:center;padding:10px 0">
      <div style="font-size:40px;margin-bottom:8px">${medEmoji(m.type)}</div>
      <div style="font-size:17px;font-weight:700">${escapeHtml(m.name)}</div>
      <div style="font-size:13px;color:var(--text3);margin-top:4px">${m.dose} · 当前剩余 ${m.stock}${m.unit}</div>
    </div>
    <div class="detail-section">
      <div class="detail-row"><span class="detail-label">开方医生</span><span class="detail-value">${escapeHtml(m.doctor)} · ${escapeHtml(m.dept||'')}</span></div>
      <div class="detail-row"><span class="detail-label">处方有效期</span><span class="detail-value">${m.endDate || '--'}</span></div>
    </div>
    <div class="tip-card" style="margin:14px 0">
      <div class="tip-icon">💡</div>
      <div class="tip-body"><div class="tip-title">续方方式</div><div class="tip-text">
        📱 <strong>在线续方</strong>：由原开方医生审核处方，药品配送到家<br>
        🏥 <strong>线下购药</strong>：持处方至医院或药房购买
      </div></div>
    </div>
    <div class="form-group"><label class="form-label">续方数量</label><input id="refillQty" type="number" value="${m.totalStock}" min="1" /></div>
    <button class="btn-primary" id="doRefillBtn">确认续方</button>
    <button class="btn-secondary" onclick="hideModal()">暂不续方</button>
  `);
  $('#doRefillBtn').addEventListener('click', () => {
    const qty = parseInt($('#refillQty').value) || 0;
    if (qty <= 0) return toast('请输入正确数量');
    const meds = get('meds');
    const med = meds.find(x => x.id === id);
    if (med) { med.stock += qty; med.totalStock = Math.max(med.totalStock, med.stock); set('meds', meds); }
    hideModal(); toast(`已为 ${m.name} 续方 ${qty}${m.unit}，请等待配送`, 'success'); renderPage();
  });
}

function showRefillListModal() {
  const meds = get('meds');
  showModal(`
    <div class="modal-title">🔄 一键续方 <span class="modal-close" onclick="hideModal()">✕</span></div>
    <div class="tip-card" style="margin-bottom:14px">
      <div class="tip-icon">💡</div>
      <div class="tip-body"><div class="tip-title">智能续方</div><div class="tip-text">系统已为您筛选出需要续方的药品，一键提交后由医生审核处方。</div></div>
    </div>
    ${meds.map(m => {
      const daily = m.times.length*(m.perTime||1);
      const daysLeft = daily>0 ? Math.floor(m.stock/daily) : 999;
      const needRefill = daysLeft <= 14;
      return `<div class="card" style="padding:12px">
        <div class="med-item" style="border:none;padding:0">
          <div class="med-icon ${m.type}">${medEmoji(m.type)}</div>
          <div class="med-body">
            <div class="med-name">${escapeHtml(m.name)}</div>
            <div class="med-desc">${m.stock}${m.unit} · ${daysLeft>=999?'充足':'约可用 '+daysLeft+'天'}</div>
          </div>
          ${needRefill ? `<button class="btn-take overdue" onclick="hideModal();showRefillModal('${m.id}')">续方</button>` : '<span style="font-size:12px;color:var(--mint)">✓ 充足</span>'}
        </div>
      </div>`;
    }).join('')}
  `);
}

// ========== 家人代管 ==========
function showFamilyModal() {
  const family = get('family');
  showModal(`
    <div class="modal-title">👨‍👩‍👧 家人代管 <span class="modal-close" onclick="hideModal()">✕</span></div>
    <div class="tip-card" style="margin-bottom:14px">
      <div class="tip-icon">💝</div>
      <div class="tip-body"><div class="tip-title">什么是家人代管？</div><div class="tip-text">邀请家人加入，他们可以远程查看您的服药情况，在您漏服时收到提醒。让家人更放心~</div></div>
    </div>
    ${family.length === 0 ? '<div class="empty-state" style="padding:20px"><div class="empty-text">暂未添加家人</div></div>' :
    family.map(f => `<div class="card" style="padding:14px;display:flex;align-items:center;gap:12px">
      <div style="width:44px;height:44px;border-radius:50%;background:var(--mint-light);display:flex;align-items:center;justify-content:center;font-size:20px">👤</div>
      <div style="flex:1"><div style="font-size:14px;font-weight:600">${escapeHtml(f.name)}</div><div style="font-size:12px;color:var(--text3)">${escapeHtml(f.relation)} · ${escapeHtml(f.phone)}</div></div>
      <div style="font-size:12px;color:${f.notify?'var(--mint)':'var(--text3)'}">${f.notify?'✓ 已开启通知':'通知关闭'}</div>
    </div>`).join('')}
    <button class="btn-primary" onclick="toast('邀请链接已复制，请发送给家人','success')">＋ 邀请家人加入</button>
  `);
}

// ========== AI 助手 ==========
let aiOpen = false;
const aiReplies = {
  '服药时间': '根据您的用药计划：\n💊 早8点：氨氯地平片、二甲双胍、阿司匹林\n💊 晚6点：二甲双胍\n💉 晚9点：甘精胰岛素\n\n建议设好闹钟提醒哦~',
  '血压偏高': '血压偏高时建议：\n1. 保持情绪平稳，深呼吸\n2. 减少钠盐摄入（<6g/天）\n3. 确认是否按时服用降压药\n4. 如持续≥180/120，请立即就医\n\n您可以点击首页"记血压"跟踪变化。',
  '忘记吃药': '偶尔漏服不必过于紧张：\n1. 发现时距离下次服药>间隔一半：立即补服\n2. 快到下次用药时间：跳过这次，不要加倍\n3. 建议在APP中设置打卡提醒\n\n如经常遗忘，可开启"家人代管"功能~',
  '药物副作用': '每种药物都可能有副作用：\n💊 二甲双胍：可能胃肠不适，随餐服用可减轻\n💊 氨氯地平：可能脚踝水肿\n💊 阿司匹林：注意出血倾向\n\n如症状明显，请咨询医生调整用药方案。',
  '如何续方': '续方流程非常简单：\n1. 进入"我的"→"在线复诊续方"\n2. 选择需要续方的药品\n3. 填写近期身体情况\n4. 医生审核处方（1-2小时）\n5. 药品配送到家\n\n您也可以直接点首页"续方"快捷入口。'
};

function openAI() {
  aiOpen = true;
  const panel = $('#aiPanel');
  panel.innerHTML = `
    <div class="ai-header">
      <div class="ai-avatar">🤖</div>
      <div class="ai-title-block"><div class="ai-title">AI 健康助手</div><div class="ai-subtitle">在线为您解答</div></div>
      <button class="modal-close" id="closeAI">✕</button>
    </div>
    <div class="ai-chat" id="aiChat">
      <div class="ai-msg"><div class="ai-msg-avatar">🤖</div><div class="ai-msg-bubble">您好！我是您的AI健康助手 🌟\n\n我可以帮您解答用药疑问、提供健康建议。请问有什么可以帮您的？</div></div>
    </div>
    <div class="ai-quick" id="aiQuick">
      ${Object.keys(aiReplies).map(k => `<div class="ai-quick-item" data-q="${k}">${k}</div>`).join('')}
    </div>
    <div class="ai-input-bar">
      <input class="ai-input" id="aiInput" placeholder="输入您的问题..." />
      <button class="ai-send" id="aiSend">↑</button>
    </div>
  `;
  panel.classList.add('show');

  $('#closeAI').addEventListener('click', closeAI);
  $$('.ai-quick-item').forEach(q => q.addEventListener('click', () => sendAI(q.dataset.q)));
  $('#aiSend').addEventListener('click', () => { const v = $('#aiInput').value.trim(); if (v) sendAI(v); });
  $('#aiInput').addEventListener('keydown', e => { if (e.key==='Enter') { const v=$('#aiInput').value.trim(); if(v) sendAI(v); } });
}

function closeAI() { aiOpen = false; $('#aiPanel').classList.remove('show'); }

function sendAI(msg) {
  const chat = $('#aiChat');
  chat.innerHTML += `<div class="ai-msg user"><div class="ai-msg-avatar">👤</div><div class="ai-msg-bubble">${escapeHtml(msg)}</div></div>`;
  $('#aiInput').value = '';
  
  // 模拟回复
  setTimeout(() => {
    let reply = aiReplies[msg];
    if (!reply) {
      const keys = Object.keys(aiReplies);
      const matched = keys.find(k => msg.includes(k) || k.includes(msg));
      reply = matched ? aiReplies[matched] : '感谢您的提问！建议您将这个问题在下次复诊时咨询医生，获得更专业的建议。\n\n您还可以问我关于"服药时间"、"血压偏高"、"忘记吃药"、"药物副作用"等常见问题~';
    }
    chat.innerHTML += `<div class="ai-msg"><div class="ai-msg-avatar">🤖</div><div class="ai-msg-bubble">${reply.replace(/\n/g,'<br>')}</div></div>`;
    chat.scrollTop = chat.scrollHeight;
  }, 600);
  chat.scrollTop = chat.scrollHeight;
}

// ========== 通知中心 ==========
$('#notifBtn').addEventListener('click', () => {
  const notifs = getNotifications();
  showModal(`
    <div class="modal-title">🔔 提醒中心 <span class="modal-close" onclick="hideModal()">✕</span></div>
    ${notifs.length === 0 ? '<div class="empty-state" style="padding:30px"><div class="empty-icon">🎉</div><div class="empty-text">暂无待处理提醒</div><div class="empty-hint">所有事项都已处理完毕</div></div>' :
    notifs.map(n => `<div class="notif-item">
      <div class="notif-icon ${n.type}">${n.icon}</div>
      <div class="notif-body">
        <div class="notif-title">${n.title}</div>
        <div class="notif-desc">${n.desc}</div>
        <div class="notif-time">${n.time}</div>
      </div>
    </div>`).join('')}
  `);
});

// AI 按钮
$('#aiBtn').addEventListener('click', () => { if (aiOpen) closeAI(); else openAI(); });

// ========== 全局暴露（供onclick调用）==========
window.hideModal = hideModal;
window.showModal = showModal;
window.showRefillModal = showRefillModal;
window.showRefillListModal = showRefillListModal;
window.showVisitForm = showVisitForm;
window.showVisitDetail = showVisitDetail;
window.showVisitList = showVisitList;
window.showStockModal = showStockModal;
window.showFamilyModal = showFamilyModal;
window.showRecordModal = showRecordModal;
window.showMedDetail = showMedDetail;
window.showMedForm = showMedForm;
window.navigate = navigate;
window.renderPage = renderPage;
window.toast = toast;
window.get = get;
window.set = set;
window.openAI = openAI;
window.closeAI = closeAI;
window.sendAI = sendAI;

// ========== 启动 ==========
initData();
$('#greeting').textContent = getGreeting();
// 恢复关怀版
if (localStorage.getItem('mc_elder') === '1') document.body.classList.add('elder-mode');

// 启动页
const splash = $('#splash');
const splashBtn = $('#splashBtn');
if (sessionStorage.getItem('mc_splash_done')) {
  splash.style.display = 'none';
  $('#app').classList.remove('hidden');
  renderPage();
} else {
  splashBtn.addEventListener('click', () => {
    splash.classList.add('out');
    setTimeout(() => {
      splash.style.display = 'none';
      $('#app').classList.remove('hidden');
      sessionStorage.setItem('mc_splash_done', '1');
      renderPage();
    }, 600);
  });
}