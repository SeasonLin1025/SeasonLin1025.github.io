// ===== 单一数据源驱动整站渲染 =====
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '')
  .replace(/&/g, '&' + 'amp;')
  .replace(/</g, '&' + 'lt;')
  .replace(/>/g, '&' + 'gt;');

// 自动高亮文本中的百分比/数字指标（暖橙强调色）
function highlight(text) {
  return esc(text).replace(
    /(\d+(?:\.\d+)?(?:%|倍|万元?|笔|人|篇|场|个|名|位|轮|月|天)?)/g,
    '<strong>$1</strong>'
  );
}

async function loadResume() {
  // 站点部署时 data/ 与 site/ 内容会合并到根目录（见 GitHub Actions）
  const res = await fetch('./data/resume.json?t=' + Date.now());
  return res.json();
}

function renderHero(data) {
  const b = data.basic;
  $('#hero-name').textContent = b.name;
  $('#hero-tagline').textContent = b.tagline;
  $('#hero-meta').innerHTML =
    `<span class="prompt-symbol">»</span> ${esc(b.target)} · ${esc(b.email)} · ${esc(b.phone)}`;
  // 打字机效果：tagline
  const tagline = b.tagline;
  const el = $('#hero-tagline');
  el.textContent = '';
  let i = 0;
  const timer = setInterval(() => {
    el.textContent = tagline.slice(0, ++i);
    if (i >= tagline.length) clearInterval(timer);
  }, 60);
}

function renderEducation(data) {
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
}

function renderSkills(data) {
  $('#skills-tags').innerHTML = data.skills
    .map(s => `<span class="skill-tag">${esc(s)}</span>`)
    .join('');
}

function renderExperience(data) {
  $('#experience-timeline').innerHTML = data.internships.map(i => `
    <div class="tl-item">
      <div class="tl-head">
        <span class="tl-company">${esc(i.company)}</span>
        <span class="tl-period">${esc(i.period)}</span>
      </div>
      <div class="tl-role">› ${esc(i.role)}</div>
      <div class="tl-highlights">
        ${i.highlights.map(h => `
          <div class="tl-hl">
            <div class="tl-hl-title">[${esc(h.title)}]</div>
            <div class="tl-hl-content">${highlight(h.content)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function renderProjects(data) {
  const html = data.projects.map(p => `
    <div class="project-card">
      <h3>${esc(p.name)}</h3>
      <div class="project-meta">${esc(p.role)} · ${esc(p.period)}</div>
      <div class="project-desc">${highlight(p.description)}</div>
      <ul class="project-resp">
        ${p.responsibilities.map(r => `<li>${highlight(r)}</li>`).join('')}
      </ul>
    </div>
  `).join('');

  // 校园经历也复用 timeline 样式简化展示
  const campusHtml = (data.campus || []).map(c => `
    <div class="project-card">
      <h3>${esc(c.org)}</h3>
      <div class="project-meta">${esc(c.role)} · ${esc(c.period)}</div>
      ${c.highlights.map(h => `
        <div class="project-desc"><strong style="color:var(--accent)">[${esc(h.title)}]</strong> ${highlight(h.content)}</div>
      `).join('')}
    </div>
  `).join('');

  $('#projects-list').innerHTML = html + campusHtml;
}

function renderWorks(data) {
  $('#works-grid').innerHTML = (data.works || []).map(w => `
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

// 滚动渐入
function setupScrollReveal() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = 1;
        e.target.style.transform = 'translateY(0)';
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.tl-item, .project-card, .work-card, .about-card').forEach(el => {
    el.style.opacity = 0;
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity .6s, transform .6s';
    io.observe(el);
  });
}

(async function main() {
  try {
    const data = await loadResume();
    renderHero(data);
    renderEducation(data);
    renderSkills(data);
    renderExperience(data);
    renderProjects(data);
    renderWorks(data);
    renderContact(data);
    setupScrollReveal();
  } catch (err) {
    console.error('[main] 渲染失败：', err);
    document.body.innerHTML +=
      `<pre style="color:#ff6b35;padding:24px;font-family:monospace">渲染失败：${esc(err.message)}\n请确认通过本地服务器访问（npm run dev），不能直接双击 HTML。</pre>`;
  }
})();