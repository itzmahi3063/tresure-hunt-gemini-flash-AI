const sharp = require('C:/Users/Grow With Mahi/.gemini/antigravity/scratch/hoocooh-miner/node_modules/sharp');
const path = require('path');
const fs = require('fs');

const srcPath = 'C:/Users/Grow With Mahi/.gemini/antigravity/brain/db47226f-7a24-42ad-8e74-00003eafa8b0/.user_uploaded/media_1792073822719_e93d677e.jpg';
const destAssetsDir = path.join(__dirname, '../public/assets');
const destPublicDir = path.join(__dirname, '../public');

async function run() {
  console.log('[TH Coin Generator] Starting high-fidelity 10-tier generation...');

  if (!fs.existsSync(srcPath)) {
    throw new Error('Source file not found: ' + srcPath);
  }

  // Crop 720x720 centered at (507, 477)
  const cropped = await sharp(srcPath)
    .extract({ left: 147, top: 117, width: 720, height: 720 })
    .toBuffer();

  // Create clean circular mask with anti-aliasing edge
  const maskSvg = Buffer.from(`
    <svg width="720" height="720" viewBox="0 0 720 720">
      <defs>
        <radialGradient id="edgeSmooth" cx="50%" cy="50%" r="50%">
          <stop offset="98.5%" stop-color="#ffffff" stop-opacity="1" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <circle cx="360" cy="360" r="356.5" fill="url(#edgeSmooth)" />
    </svg>
  `);
  const maskBuffer = await sharp(maskSvg).png().toBuffer();

  const baseCleanCoin720 = await sharp(cropped)
    .composite([{ input: maskBuffer, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // 10 Distinct Tiers with distinctive colors:
  const TIERS = [
    {
      lvl: 1,
      name: 'Starter (Golden Sun)',
      modulate: { hue: 0, saturation: 1.15, brightness: 1.0 },
      glowRgb: '250, 195, 10',
      dropShadow: 'rgba(250, 195, 10, 0.45)',
      pillColor: '#fac30a'
    },
    {
      lvl: 2,
      name: 'Developed (Emerald Jade)',
      modulate: { hue: 75, saturation: 1.4, brightness: 1.05 },
      glowRgb: '16, 205, 120',
      dropShadow: 'rgba(16, 205, 120, 0.45)',
      pillColor: '#10cd78'
    },
    {
      lvl: 3,
      name: 'Refined (Cyan Electric)',
      modulate: { hue: 135, saturation: 1.5, brightness: 1.1 },
      glowRgb: '6, 200, 240',
      dropShadow: 'rgba(6, 200, 240, 0.45)',
      pillColor: '#06c8f0'
    },
    {
      lvl: 4,
      name: 'Vanguard (Deep Royal Sapphire)',
      modulate: { hue: 185, saturation: 1.6, brightness: 1.02 },
      glowRgb: '37, 99, 235',
      dropShadow: 'rgba(37, 99, 235, 0.45)',
      pillColor: '#2563eb'
    },
    {
      lvl: 5,
      name: 'Apex (Royal Amethyst Purple)',
      modulate: { hue: 235, saturation: 1.65, brightness: 1.08 },
      glowRgb: '147, 51, 234',
      dropShadow: 'rgba(147, 51, 234, 0.45)',
      pillColor: '#9333ea'
    },
    {
      lvl: 6,
      name: 'Celestial (Neon Magenta Pink)',
      modulate: { hue: 275, saturation: 1.55, brightness: 1.05 },
      glowRgb: '236, 72, 153',
      dropShadow: 'rgba(236, 72, 153, 0.45)',
      pillColor: '#ec4899'
    },
    {
      lvl: 7,
      name: 'Quantum (Crimson Flame Red)',
      modulate: { hue: 315, saturation: 1.6, brightness: 1.05 },
      glowRgb: '239, 68, 68',
      dropShadow: 'rgba(239, 68, 68, 0.45)',
      pillColor: '#ef4444'
    },
    {
      lvl: 8,
      name: 'Mythic (Blazing Sunset Orange)',
      modulate: { hue: -22, saturation: 1.5, brightness: 1.05 },
      glowRgb: '249, 115, 22',
      dropShadow: 'rgba(249, 115, 22, 0.45)',
      pillColor: '#f97316'
    },
    {
      lvl: 9,
      name: 'Sovereign (Platinum Silver)',
      modulate: { saturation: 0.05, brightness: 1.25 },
      glowRgb: '226, 232, 240',
      dropShadow: 'rgba(226, 232, 240, 0.55)',
      pillColor: '#e2e8f0',
      isSilver: true
    },
    {
      lvl: 10,
      name: 'Transcendent (Prismatic Cosmic Diamond)',
      modulate: { hue: 140, saturation: 1.15, brightness: 1.22 },
      glowRgb: '0, 240, 255',
      dropShadow: 'rgba(0, 240, 255, 0.60)',
      pillColor: '#00f0ff',
      isRainbow: true
    }
  ];

  for (const tier of TIERS) {
    console.log(`[TH Coin Generator] Rendering Lv.${tier.lvl}: ${tier.name}...`);
    let pipeline = sharp(baseCleanCoin720).modulate(tier.modulate);

    if (tier.isSilver) {
      const rimSvg = Buffer.from(`
        <svg width="720" height="720" viewBox="0 0 720 720">
          <circle cx="360" cy="360" r="350" stroke="#ffffff" stroke-width="6" fill="none" opacity="0.75" />
          <circle cx="360" cy="360" r="343" stroke="#cbd5e1" stroke-width="2.5" fill="none" opacity="0.6" />
        </svg>
      `);
      const rimBuf = await sharp(rimSvg).png().toBuffer();
      pipeline = pipeline.composite([{ input: rimBuf }]);
    }

    if (tier.isRainbow) {
      const rainbowSvg = Buffer.from(`
        <svg width="720" height="720" viewBox="0 0 720 720">
          <defs>
            <linearGradient id="prismGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#00f0ff" />
              <stop offset="25%" stop-color="#a855f7" />
              <stop offset="50%" stop-color="#ec4899" />
              <stop offset="75%" stop-color="#fbbf24" />
              <stop offset="100%" stop-color="#00f0ff" />
            </linearGradient>
            <radialGradient id="prismFace" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35" />
              <stop offset="50%" stop-color="#00f0ff" stop-opacity="0.15" />
              <stop offset="100%" stop-color="#a855f7" stop-opacity="0.25" />
            </radialGradient>
          </defs>
          <circle cx="360" cy="360" r="352" fill="url(#prismFace)" />
          <circle cx="360" cy="360" r="350" stroke="url(#prismGrad)" stroke-width="10" fill="none" opacity="0.9" />
          <circle cx="360" cy="360" r="341" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.8" />
        </svg>
      `);
      const rainbowBuf = await sharp(rainbowSvg).png().toBuffer();
      pipeline = pipeline.composite([{ input: rainbowBuf }]);
    }

    const tierBuffer = await pipeline.png().toBuffer();

    const webp360 = await sharp(tierBuffer)
      .resize(360, 360)
      .webp({ quality: 95, effort: 6 })
      .toBuffer();

    fs.writeFileSync(path.join(destAssetsDir, `miner_lvl${tier.lvl}.webp`), webp360);
    fs.writeFileSync(path.join(destPublicDir, `miner_lvl${tier.lvl}.webp`), webp360);
    console.log(`  ✓ Successfully generated miner_lvl${tier.lvl}.webp`);
  }

  // Update default logo.webp and logo.png using Lv 1 Golden Sun
  const logoWebp = await sharp(path.join(destAssetsDir, 'miner_lvl1.webp'))
    .resize(512, 512)
    .webp({ quality: 95 })
    .toBuffer();
  const logoPng = await sharp(path.join(destAssetsDir, 'miner_lvl1.webp'))
    .resize(512, 512)
    .png({ quality: 95 })
    .toBuffer();

  fs.writeFileSync(path.join(destAssetsDir, 'logo.webp'), logoWebp);
  fs.writeFileSync(path.join(destPublicDir, 'logo.webp'), logoWebp);
  fs.writeFileSync(path.join(destAssetsDir, 'logo.png'), logoPng);
  fs.writeFileSync(path.join(destPublicDir, 'logo.png'), logoPng);

  console.log('[TH Coin Generator] All 10 tiers rendered with distinct vibrant palettes!');
}

run().catch(err => {
  console.error('[TH Coin Generator Error]', err);
  process.exit(1);
});
