// Generates the full favicon / PWA / OpenGraph asset set for House of Ahmar
// from branded SVG sources, mirroring the landing-pagev2 (jawaadahmar.com)
// setup: real favicon.ico + icon.svg + PNG fallbacks + apple-icon + maskable
// manifest icons + a static og-image.png. Run: `node scripts/generate-icons.mjs`.
import sharp from "sharp";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const BG = "#0a0a0a"; // neutral-950
const ORANGE = "#fb923c"; // orange-400 (theme accent)
const FG = "#ededed";
const MUTED = "#a3a3a3";

// Vector favicon (crisp in browser tabs) — rounded square + orange "A" monogram.
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${BG}"/>
  <path d="M150 372 L256 132 L362 372 M196 300 L316 300" fill="none" stroke="${ORANGE}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Full-bleed source for the raster icons (apple + maskable want no transparency
// and a safe margin so a circular/rounded crop keeps the "A" intact).
const rasterSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  <path d="M168 356 L256 158 L344 356 M202 296 L310 296" fill="none" stroke="${ORANGE}" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Static OpenGraph / Twitter share card (1200x630).
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BG}"/>
  <rect x="524" y="118" width="152" height="152" rx="34" fill="${ORANGE}" fill-opacity="0.08" stroke="${ORANGE}" stroke-opacity="0.35" stroke-width="2"/>
  <path d="M566 236 L600 166 L634 236 M581 214 L619 214" fill="none" stroke="${ORANGE}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="600" y="388" text-anchor="middle" font-family="'Helvetica Neue',Helvetica,Arial,sans-serif" font-size="82" font-weight="700" letter-spacing="-1" fill="${FG}">House of Ahmar</text>
  <text x="600" y="444" text-anchor="middle" font-family="'Helvetica Neue',Helvetica,Arial,sans-serif" font-size="29" fill="${MUTED}">A private home for our family — kept, not scrolled away.</text>
  <text x="600" y="534" text-anchor="middle" font-family="'Helvetica Neue',Helvetica,Arial,sans-serif" font-size="19" letter-spacing="8" fill="${ORANGE}">EST. AHMAR</text>
</svg>`;

const raster = Buffer.from(rasterSvg);
const png = (size) =>
  sharp(raster, { density: 400 }).resize(size, size).png();

// Minimal ICO writer that embeds PNG frames (Vista+ PNG-in-ICO).
function buildIco(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  const dir = Buffer.alloc(frames.length * 16);
  let offset = 6 + frames.length * 16;
  frames.forEach((f, i) => {
    const e = i * 16;
    dir.writeUInt8(f.size >= 256 ? 0 : f.size, e);
    dir.writeUInt8(f.size >= 256 ? 0 : f.size, e + 1);
    dir.writeUInt16LE(1, e + 4);
    dir.writeUInt16LE(32, e + 6);
    dir.writeUInt32LE(f.buf.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += f.buf.length;
  });
  return Buffer.concat([header, dir, ...frames.map((f) => f.buf)]);
}

writeFileSync(join(pub, "icon.svg"), iconSvg);
await png(96).toFile(join(pub, "favicon-96x96.png"));
await png(180).toFile(join(pub, "apple-icon.png"));
await png(192).toFile(join(pub, "web-app-manifest-192x192.png"));
await png(512).toFile(join(pub, "web-app-manifest-512x512.png"));

const frames = [];
for (const size of [16, 32, 48]) frames.push({ size, buf: await png(size).toBuffer() });
writeFileSync(join(pub, "favicon.ico"), buildIco(frames));

await sharp(Buffer.from(ogSvg), { density: 96 })
  .resize(1200, 630)
  .png()
  .toFile(join(pub, "og-image.png"));

console.log("Generated: icon.svg, favicon.ico, favicon-96x96.png, apple-icon.png, web-app-manifest-{192,512}.png, og-image.png");
