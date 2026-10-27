// Gộp 16 file CSS thành css/bundle.css (1 yêu cầu thay vì 16, bỏ chú thích/dòng trống). Chạy: node tools/build-css.mjs
// Thứ tự = thứ tự cũ trong index.html (lite.css PHẢI ở cuối). Sửa CSS trong các file nguồn rồi chạy lại lệnh này.
import fs from 'fs';
const ORDER = ['main.css','screens/menu.css','screens/character-select.css','screens/battle.css','screens/result.css',
  'components/gauge.css','components/effects.css','screens/online.css','screens/onboarding.css','theme.css','cartoon.css',
  'ui-polish.css','responsive.css','screens/online-v2.css','modes.css','lite.css'];
let out = '/* AUTO-GENERATED bởi tools/build-css.mjs — đừng sửa tay, hãy sửa file nguồn rồi chạy lại */\n';
for (const f of ORDER) {
  let s = fs.readFileSync(new URL('../css/' + f, import.meta.url), 'utf8');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n');
  out += s.trim() + '\n';
}
fs.writeFileSync(new URL('../css/bundle.css', import.meta.url), out);
console.log('css/bundle.css', (out.length / 1024).toFixed(1), 'KB');
