// Sinh danh sách <link rel="modulepreload"> cho index.html từ cây import của js/main.js.
// Nhờ vậy trình duyệt tải SONG SONG mọi file JS ngay từ đầu (thay vì đợi từng tầng import) → vào game nhanh hơn rõ trên mạng chậm.
// Chạy lại mỗi khi bạn thêm/xoá/đổi tên file .js:  node tools/gen-preload.mjs   (cap-nhat-assets.bat đã gọi sẵn)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seen = new Set();
const order = [];
function visit(rel) {
  if (seen.has(rel)) return;
  seen.add(rel);
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return;
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"\n]*?from\s*['"](\.[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.[^'"]+)['"]/g)) {
    const spec = m[1] || m[2];
    visit(path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec)));
  }
  order.push(rel);
}
visit('js/main.js');

const links = order.map(f => `  <link rel="modulepreload" href="${f}">`).join('\n');
const block = `<!-- MODULEPRELOAD:START (tự sinh bởi tools/gen-preload.mjs — đừng sửa tay) -->\n${links}\n  <!-- MODULEPRELOAD:END -->`;
const idx = path.join(root, 'index.html');
let html = fs.readFileSync(idx, 'utf8');
if (/<!-- MODULEPRELOAD:START[\s\S]*?MODULEPRELOAD:END -->/.test(html))
  html = html.replace(/<!-- MODULEPRELOAD:START[\s\S]*?MODULEPRELOAD:END -->/, block);
else
  html = html.replace('</head>', `  ${block}\n</head>`);
fs.writeFileSync(idx, html);
console.log(`Đã ghi ${order.length} modulepreload vào index.html`);
