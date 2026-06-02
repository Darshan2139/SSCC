/* One-off icon generator for SSCC. Renders brand SVGs to PNG via sharp.
 * Run: node scripts/generate-icons.js   (sharp is a temporary dev dependency)
 *
 * Brand: white lightning bolt (Feather "zap") on terracotta (#D97757). */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', 'assets');
const BOLT = '13 2 3 14 12 14 11 22 21 10 12 10 13 2'; // Feather zap, 24x24 viewBox

const grad = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#E2906F"/>
      <stop offset="1" stop-color="#D97757"/>
    </linearGradient>
  </defs>`;

// Full-bleed app icon (iOS + stores mask the corners themselves).
const icon = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  ${grad}
  <rect width="1024" height="1024" fill="url(#g)"/>
  <g transform="translate(200,200) scale(26)">
    <polygon points="${BOLT}" fill="#FFFFFF"/>
  </g>
</svg>`;

// Android adaptive foreground: transparent, bolt kept inside the safe zone.
const adaptive = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(248,248) scale(22)">
    <polygon points="${BOLT}" fill="#FFFFFF"/>
  </g>
</svg>`;

// Native splash: terracotta rounded badge with white bolt, shown on the
// splash background color (#F5F4EF). Transparent outside the badge.
const splash = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  ${grad}
  <rect x="272" y="272" width="480" height="480" rx="120" fill="url(#g)"/>
  <g transform="translate(356,356) scale(13)">
    <polygon points="${BOLT}" fill="#FFFFFF"/>
  </g>
</svg>`;

async function render(svg, file, size) {
  let img = sharp(Buffer.from(svg)).png();
  if (size) img = img.resize(size, size);
  await img.toFile(path.join(OUT, file));
  console.log('wrote', file);
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  await render(icon, 'icon.png');
  await render(adaptive, 'adaptive-icon.png');
  await render(splash, 'splash-icon.png');
  await render(icon, 'favicon.png', 48);
  console.log('done');
})();
