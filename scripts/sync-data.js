/**
 * 把 data/ 同步到 site/data/，以及把生成的 resume.pdf 复制到 site/resume.pdf
 * 这样本地 `npm run dev` 启动 site 静态服务器时就能正确访问
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dataSrc = path.join(root, 'data');
const dataDst = path.join(root, 'site', 'data');

fs.mkdirSync(dataDst, { recursive: true });
for (const f of fs.readdirSync(dataSrc)) {
  fs.copyFileSync(path.join(dataSrc, f), path.join(dataDst, f));
  console.log('[sync] data ->', f);
}

const pdf = path.join(root, 'resume.pdf');
if (fs.existsSync(pdf)) {
  fs.copyFileSync(pdf, path.join(root, 'site', 'resume.pdf'));
  console.log('[sync] pdf  -> site/resume.pdf');
}