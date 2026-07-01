/* Генерация всех изображений-производных от логотипа */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IMG = path.join(ROOT, 'images');
const LOGO = path.join(IMG, 'logo.svg');

async function main(){
  const svg = fs.readFileSync(LOGO);

  // ─── 1. Favicons (PNG для старых браузеров) ────────────────────
  await sharp(svg).resize(32, 32).png().toFile(path.join(IMG, 'favicon-32.png'));
  await sharp(svg).resize(192, 192).png().toFile(path.join(IMG, 'icon-192.png'));
  await sharp(svg).resize(512, 512).png().toFile(path.join(IMG, 'icon-512.png'));
  await sharp(svg).resize(180, 180).png().toFile(path.join(IMG, 'apple-touch-icon.png'));
  console.log('✅ Favicons готовы (32, 192, 512, apple-touch 180)');

  // ─── 2. OG-image 1200×630 ──────────────────────────────────────
  // Шаг A: рендерим логотип в PNG 380×380
  const logoPng = await sharp(svg).resize(380, 380).png().toBuffer();

  // Шаг B: SVG-фон 1200×630 с тёмно-синим градиентом, glow и текстом
  const bgSvg = Buffer.from(`<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#080C24"/>
        <stop offset="100%" stop-color="#05071A"/>
      </linearGradient>
      <radialGradient id="glow1" cx="0.85" cy="0.15" r="0.5">
        <stop offset="0%" stop-color="#08ADEC" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#08ADEC" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="glow2" cx="0.1" cy="0.9" r="0.5">
        <stop offset="0%" stop-color="#0476FF" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#0476FF" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#5BE0FF"/>
        <stop offset="100%" stop-color="#0476FF"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <rect width="1200" height="630" fill="url(#glow1)"/>
    <rect width="1200" height="630" fill="url(#glow2)"/>
    <!-- Тонкая grid-линия для текстуры -->
    <g opacity="0.15">
      <line x1="0" y1="120" x2="1200" y2="120" stroke="#FFFFFF" stroke-width="1"/>
      <line x1="0" y1="510" x2="1200" y2="510" stroke="#FFFFFF" stroke-width="1"/>
    </g>
    <!-- Текст справа от логотипа -->
    <text x="510" y="155" font-family="Arial Black, sans-serif" font-size="22" font-weight="900" fill="#5BE0FF" letter-spacing="4">ЛОНГРИД · 12 МИН</text>
    <text x="510" y="245" font-family="Arial Black, Inter, sans-serif" font-size="68" font-weight="900" fill="#FFFFFF" letter-spacing="-2">Нейро-Читер</text>
    <text x="510" y="320" font-family="Arial, Inter, sans-serif" font-size="36" font-weight="600" fill="url(#brand)">Я уволил копирайтера,</text>
    <text x="510" y="368" font-family="Arial, Inter, sans-serif" font-size="36" font-weight="600" fill="url(#brand)">SMM-щика и дизайнера</text>
    <text x="510" y="445" font-family="Arial, Inter, sans-serif" font-size="26" font-weight="400" fill="#9BA4B5">Их работу теперь делает нейронка.</text>
    <text x="510" y="478" font-family="Arial, Inter, sans-serif" font-size="26" font-weight="400" fill="#9BA4B5">Объясняю — почему у тебя она выдает воду.</text>
    <!-- Нижняя плашка -->
    <text x="510" y="565" font-family="Arial Black, sans-serif" font-size="18" font-weight="700" fill="#5BE0FF" letter-spacing="3">15 ПРОМПТОВ  ·  4 КЕЙСА  ·  600+ МЛН ₽</text>
  </svg>`);

  await sharp(bgSvg)
    .composite([{ input: logoPng, left: 80, top: 125 }])
    .png({ quality: 95 })
    .toFile(path.join(IMG, 'og-image.png'));

  console.log('✅ og-image.png 1200×630 готов');

  // ─── 3. Размеры финальных файлов ───────────────────────────────
  ['favicon-32.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'og-image.png'].forEach(f=>{
    const p = path.join(IMG, f);
    const kb = (fs.statSync(p).size / 1024).toFixed(1);
    console.log('  ' + f + ' — ' + kb + ' KB');
  });
}

main().catch(e => { console.error(e); process.exit(1); });
