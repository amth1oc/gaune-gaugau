// Quét thư mục assets/ và ghi assets/files.json (danh sách file cho game).
// Dùng khi game chạy trên hosting không cho xem danh sách thư mục (GitHub Pages, Netlify...).
// Chạy:  node tools/scan-assets.mjs   (hoặc bấm đúp cap-nhat-assets.bat trên Windows)
import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const IMG = /\.(png|jpe?g|webp|gif|avif|svg)$/i, AUD = /\.(mp3|ogg|wav|m4a)$/i;
const ls = d => existsSync(join(root, d)) ? readdirSync(join(root, d)).filter(n => !n.startsWith('.')) : [];
const files = (d, re) => ls(d).filter(n => statSync(join(root, d, n)).isFile() && re.test(n));

const out = { backgrounds: files('backgrounds', IMG), ui: files('ui', IMG), audio: files('audio', AUD),
              charactersLoose: files('characters', IMG), characters: {} };
for (const n of ls('characters')) if (statSync(join(root, 'characters', n)).isDirectory()) out.characters[n] = files('characters/' + n, IMG);
writeFileSync(join(root, 'files.json'), JSON.stringify(out, null, 2));
console.log('Đã ghi assets/files.json:', out.backgrounds.length, 'nền,', Object.keys(out.characters).length, 'thư mục nhân vật,', out.charactersLoose.length, 'ảnh nhân vật lẻ');
