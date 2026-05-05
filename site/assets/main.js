// ===== 单一数据源驱动整站渲染 =====
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const esc = s => String(s ?? '')
  .replace(/&/g, '&' + 'amp;')
  .replace(/</g, '&' + 'lt;')
  .replace(/>/g, '&' + 'gt;');

// 自动高亮百分比/数字指标
function highlight(text) {
  return esc(text).replace(
    /(\d+(?:\.\d+)?(?:%|倍|万元?|笔|人|篇|场|个|名|位|轮|月|天)?)/g,
    '<strong>$1</strong>'
  );
}

async function loadResume() {
  const res = await fetch('./data/resume.json?t=' + Date.now());
  return res.json();
}

/* ========== 左侧信息卡 ========== */
function renderSide(data) {
  const b = data.basic;
  const initial = (b.name || '').slice(0, 1);
  $('#avatar').textContent = initial;

  const edus = data.education || [];
  if (edus[0]) {
    $('#meta-edu1').textContent =
      `${edus[0].school} · ${edus[0].major} · ${edus[0].degree}`;
  }
  if (edus[1]) {
    $('#meta-edu2').textContent =
      `${edus[1].school} · ${edus[1].major} · ${edus[1].degree}`;
  } else {
    $('#meta-edu2').parentElement.style.display = 'none';
  }

  $('#ic-mail').href = 'mailto:' + b.email;
  $('#ic-phone').href = 'tel:' + b.phone;
  $('#ic-github').href = b.github;
}

/* ========== 首页 · 关于我 + 教育 + 技能 ========== */
function renderHome(data) {
  const b = data.basic;
  $('#hero-name').textContent = b.name;

  $('#about-tagline').textContent = b.tagline;
  $('#about-kv').innerHTML = `
    <div class="kv"><b>目标岗位</b><span>${esc(b.target)}</span></div>
    <div class="kv"><b>所在学校</b><span>${esc((data.education[0] || {}).school || '')}</span></div>
    <div class="kv"><b>政治面貌</b><span>${esc(b.party || '—')}</span></div>
    <div class="kv"><b>个人站点</b><a href="${esc(b.site)}" target="_blank" rel="noopener">${esc(b.site)}</a></div>
  `;

  $('#education-list').innerHTML = data.education.map(e => `
    <div class="edu-item">
      <div class="edu-head">
        <span class="edu-school">${esc(e.school)} · ${esc(e.degree)}</span>
        <span class="edu-period">${esc(e.period)}</span>
      </div>
      <div class="edu-meta">${esc(e.major)}</div>
      ${(e.details || []).map(d => `<div class="edu-detail">› ${highlight(d)}</div>`).join('')}
    </div>
  `).join('');

  $('#skills-tags').innerHTML = data.skills
    .map(s => `<span class="skill-tag">${esc(s)}</span>`).join('');
}

/* ========== 实习经历 ========== */
function renderExperience(data) {
  $('#experience-list').innerHTML = (data.internships || []).map(i => `
    <div class="exp-card">
      <div class="exp-head">
        <span class="exp-company">💼 ${esc(i.company)}</span>
        <span class="exp-period">${esc(i.period)}</span>
      </div>
      <div class="exp-role">${esc(i.role)}</div>
      ${i.highlights.map(h => `
        <div class="exp-hl">
          <div class="exp-hl-title">${esc(h.title)}</div>
          <div class="exp-hl-content">${highlight(h.content)}</div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

/* ========== 项目经历 ========== */
function renderProjects(data) {
  const proj = (data.projects || []).map(p => `
    <div class="project-card">
      <div class="project-head">
        <span class="project-name">📐 ${esc(p.name)}</span>
        <span class="project-period">${esc(p.period)}</span>
      </div>
      <div class="project-role">${esc(p.role)}</div>
      <div class="project-desc">${highlight(p.description)}</div>
      <ul class="project-resp">
        ${p.responsibilities.map(r => `<li>${highlight(r)}</li>`).join('')}
      </ul>
    </div>
  `).join('');

  const campus = (data.campus || []).map(c => `
    <div class="project-card">
      <div class="project-head">
        <span class="project-name">🎓 ${esc(c.org)}</span>
        <span class="project-period">${esc(c.period)}</span>
      </div>
      <div class="project-role">${esc(c.role)}</div>
      ${c.highlights.map(h => `
        <div class="exp-hl">
          <div class="exp-hl-title">${esc(h.title)}</div>
          <div class="exp-hl-content">${highlight(h.content)}</div>
        </div>
      `).join('')}
    </div>
  `).join('');

  $('#projects-list').innerHTML = proj + campus;
}

/* ========== 作品集 ========== */
function renderWorks(data) {
  const list = data.works || [];
  if (!list.length) {
    $('#works-grid').innerHTML =
      `<div class="card" style="grid-column:1/-1;color:var(--text-muted);text-align:center">暂无作品，敬请期待 ✨</div>`;
    return;
  }
  $('#works-grid').innerHTML = list.map(w => `
    <div class="work-card">
      <div class="work-preview">
        <iframe src="./${esc(w.demoPath)}" loading="lazy" title="${esc(w.name)}"></iframe>
      </div>
      <div class="work-body">
        <div class="work-title">${esc(w.name)}</div>
        <div class="work-tagline">${esc(w.tagline)}</div>
        <div class="work-stack">
          ${(w.stack || []).map(s => `<span>${esc(s)}</span>`).join('')}
        </div>
        <ul class="work-highlights">
          ${(w.highlights || []).map(h => `<li>${esc(h)}</li>`).join('')}
        </ul>
        <div class="work-actions">
          <a href="./${esc(w.demoPath)}" target="_blank" rel="noopener">▶ 在线体验</a>
          <a href="${esc(w.sourceUrl)}" target="_blank" rel="noopener">⌨ 源码</a>
        </div>
      </div>
    </div>
  `).join('');
}

/* ========== 联系 ========== */
function renderContact(data) {
  const b = data.basic;
  $('#contact-email').textContent = b.email;
  $('#contact-email').href = 'mailto:' + b.email;
  $('#contact-phone').textContent = b.phone;
  $('#contact-github').href = b.github;
  $('#year').textContent = new Date().getFullYear();
  $('#footer-meta').textContent =
    `${data.meta.variant} · ${data.meta.version} · 最后更新 ${data.meta.updatedAt}`;
}

/* ========== 导航：滚动联动高亮 + 锚点平滑跳转 ========== */
function setupRouter() {
  const items = Array.from(document.querySelectorAll('.nav-item'));
  const map = new Map(); // section element -> nav item
  items.forEach(it => {
    const sec = document.getElementById('view-' + it.dataset.target);
    if (sec) map.set(sec, it);
  });

  // 点击：平滑滚动到目标块
  items.forEach(it => {
    it.addEventListener('click', e => {
      e.preventDefault();
      const sec = document.getElementById('view-' + it.dataset.target);
      if (!sec) return;
      const top = sec.getBoundingClientRect().top + window.pageYOffset - 16;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  // 滚动：选出"距视口顶部最近且已进入的"section 高亮
  const setActive = (el) => {
    items.forEach(x => x.classList.toggle('active', map.get(el) === x));
  };

  const sections = Array.from(map.keys());
  const onScroll = () => {
    const probe = window.innerHeight * 0.35; // 视口上 35% 处作为判定线
    let current = sections[0];
    for (const sec of sections) {
      const top = sec.getBoundingClientRect().top;
      if (top - probe <= 0) current = sec;
    }
    if (current) setActive(current);
  };

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });
  onScroll();
}

/* ========== 初始化 ========== */
(async function main() {
  try {
    const data = await loadResume();
    renderSide(data);
    renderHome(data);
    renderExperience(data);
    renderProjects(data);
    renderWorks(data);
    renderContact(data);
    setupRouter();
  } catch (err) {
    console.error('[main] 渲染失败：', err);
    document.body.innerHTML +=
      `<pre style="color:#c0392b;padding:24px;font-family:monospace">渲染失败：${esc(err.message)}\n请确认通过本地服务器访问（npm run dev），不能直接双击 HTML。</pre>`;
  }
})();