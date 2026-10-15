const sharp = require('C:/Users/Grow With Mahi/.gemini/antigravity/scratch/hoocooh-miner/node_modules/sharp');
const path = require('path');
const fs = require('fs');

const srcPath = 'C:/Users/Grow With Mahi/.gemini/antigravity/brain/db47226f-7a24-42ad-8e74-00003eafa8b0/.user_uploaded/media_1792073822719_e93d677e.jpg';
const destAssetsDir = path.join(__dirname, '../public/assets');
const destPublicDir = path.join(__dirname, '../public');

async function run() {
  console.log('[TH Coin Generator] Building 100% clean, zero-shade 10-tier coin assets...');

  // 1. Crop 720x720 centered at (507, 477)
  const rawCropped = await sharp(srcPath)
    .extract({ left: 147, top: 117, width: 720, height: 720 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = rawCropped.info;
  const data = rawCropped.data;

  // Center is (360, 360).
  // The golden coin outer milled rim is at radius 347-348.
  // We strictly mask:
  // - r <= 346: 100% opaque (alpha = 255)
  // - 346 < r <= 348: antialiased smooth transition
  // - r > 348: 100% transparent (alpha = 0, and RGB = 0,0,0)
  const cx = 360;
  const cy = 360;
  const rMax = 348;
  const rInner = 346;

  const rgbaBuffer = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 3;
      const dstIdx = (y * width + x) * 4;

      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      if (dist > rMax) {
        // Outside circle: STRICTLY 0,0,0,0 (Zero alpha, zero color, zero bleeding!)
        rgbaBuffer[dstIdx] = 0;
        rgbaBuffer[dstIdx + 1] = 0;
        rgbaBuffer[dstIdx + 2] = 0;
        rgbaBuffer[dstIdx + 3] = 0;
      } else if (dist <= rInner) {
        // Inside coin: full opacity
        rgbaBuffer[dstIdx] = data[srcIdx];
        rgbaBuffer[dstIdx + 1] = data[srcIdx + 1];
        rgbaBuffer[dstIdx + 2] = data[srcIdx + 2];
        rgbaBuffer[dstIdx + 3] = 255;
      } else {
        // 2px antialiased rim
        const factor = (rMax - dist) / (rMax - rInner); // 1.0 down to 0.0
        const alpha = Math.round(255 * factor);
        rgbaBuffer[dstIdx] = data[srcIdx];
        rgbaBuffer[dstIdx + 1] = data[srcIdx + 1];
        rgbaBuffer[dstIdx + 2] = data[srcIdx + 2];
        rgbaBuffer[dstIdx + 3] = alpha;
      }
    }
  }

  const baseCleanCoin720 = await sharp(rgbaBuffer, {
    raw: { width: 720, height: 720, channels: 4 }
  }).png().toBuffer();

  console.log('[TH Coin Generator] 100% pure circle masked base created with zero edge noise.');

  // 10 Distinct Tiers with distinctive colors:
  const TIERS = [
    {
      lvl: 1,
      name: 'Starter (Golden Sun)',
      modulate: { hue: 0, saturation: 1.15, brightness: 1.0 },
      glowRgb: '250, 195, 10',
      dropShadow: 'rgba(250, 195, 10, 0.45)',
      pillColor: '#fac30a',
      rimGradient: 'conic-gradient(from 0deg, #d97706, #fbbf24, #fef08a, #d97706, #92400e, #d97706, #fef08a, #fbbf24, #d97706)'
    },
    {
      lvl: 2,
      name: 'Developed (Emerald Jade)',
      modulate: { hue: 75, saturation: 1.4, brightness: 1.05 },
      glowRgb: '16, 205, 120',
      dropShadow: 'rgba(16, 205, 120, 0.45)',
      pillColor: '#10cd78',
      rimGradient: 'conic-gradient(from 0deg, #059669, #34d399, #a7f3d0, #059669, #064e3b, #059669, #a7f3d0, #34d399, #059669)'
    },
    {
      lvl: 3,
      name: 'Refined (Cyan Electric)',
      modulate: { hue: 135, saturation: 1.5, brightness: 1.1 },
      glowRgb: '6, 200, 240',
      dropShadow: 'rgba(6, 200, 240, 0.45)',
      pillColor: '#06c8f0',
      rimGradient: 'conic-gradient(from 0deg, #0891b2, #22d3ee, #cffafe, #0891b2, #164e63, #0891b2, #cffafe, #22d3ee, #0891b2)'
    },
    {
      lvl: 4,
      name: 'Vanguard (Deep Royal Sapphire)',
      modulate: { hue: 185, saturation: 1.6, brightness: 1.02 },
      glowRgb: '37, 99, 235',
      dropShadow: 'rgba(37, 99, 235, 0.45)',
      pillColor: '#2563eb',
      rimGradient: 'conic-gradient(from 0deg, #1d4ed8, #60a5fa, #dbeafe, #1d4ed8, #1e3a8a, #1d4ed8, #dbeafe, #60a5fa, #1d4ed8)'
    },
    {
      lvl: 5,
      name: 'Apex (Royal Amethyst Purple)',
      modulate: { hue: 235, saturation: 1.65, brightness: 1.08 },
      glowRgb: '147, 51, 234',
      dropShadow: 'rgba(147, 51, 234, 0.45)',
      pillColor: '#9333ea',
      rimGradient: 'conic-gradient(from 0deg, #7e22ce, #c084fc, #f3e8ff, #7e22ce, #3b0764, #7e22ce, #f3e8ff, #c084fc, #7e22ce)'
    },
    {
      lvl: 6,
      name: 'Celestial (Neon Magenta Pink)',
      modulate: { hue: 275, saturation: 1.55, brightness: 1.05 },
      glowRgb: '236, 72, 153',
      dropShadow: 'rgba(236, 72, 153, 0.45)',
      pillColor: '#ec4899',
      rimGradient: 'conic-gradient(from 0deg, #be185d, #f472b6, #fce7f3, #be185d, #500724, #be185d, #fce7f3, #f472b6, #be185d)'
    },
    {
      lvl: 7,
      name: 'Quantum (Crimson Flame Red)',
      modulate: { hue: 315, saturation: 1.6, brightness: 1.05 },
      glowRgb: '239, 68, 68',
      dropShadow: 'rgba(239, 68, 68, 0.45)',
      pillColor: '#ef4444',
      rimGradient: 'conic-gradient(from 0deg, #b91c1c, #f87171, #fee2e2, #b91c1c, #450a0a, #b91c1c, #fee2e2, #f87171, #b91c1c)'
    },
    {
      lvl: 8,
      name: 'Mythic (Blazing Sunset Orange)',
      modulate: { hue: -22, saturation: 1.5, brightness: 1.05 },
      glowRgb: '249, 115, 22',
      dropShadow: 'rgba(249, 115, 22, 0.45)',
      pillColor: '#f97316',
      rimGradient: 'conic-gradient(from 0deg, #c2410c, #fb923c, #ffedd5, #c2410c, #7c2d12, #c2410c, #ffedd5, #fb923c, #c2410c)'
    },
    {
      lvl: 9,
      name: 'Sovereign (Platinum Silver)',
      modulate: { saturation: 0.05, brightness: 1.25 },
      glowRgb: '226, 232, 240',
      dropShadow: 'rgba(226, 232, 240, 0.55)',
      pillColor: '#e2e8f0',
      rimGradient: 'conic-gradient(from 0deg, #64748b, #cbd5e1, #ffffff, #94a3b8, #334155, #64748b, #ffffff, #cbd5e1, #64748b)',
      isSilver: true
    },
    {
      lvl: 10,
      name: 'Transcendent (Prismatic Cosmic Diamond)',
      modulate: { hue: 140, saturation: 1.15, brightness: 1.22 },
      glowRgb: '0, 240, 255',
      dropShadow: 'rgba(0, 240, 255, 0.60)',
      pillColor: '#00f0ff',
      rimGradient: 'conic-gradient(from 0deg, #00f0ff, #a855f7, #ec4899, #fbbf24, #00f0ff, #a855f7, #ec4899, #fbbf24, #00f0ff)',
      isRainbow: true
    }
  ];

  for (const tier of TIERS) {
    console.log(`[TH Coin Generator] Rendering Lv.${tier.lvl}: ${tier.name}...`);
    let pipeline = sharp(baseCleanCoin720).modulate(tier.modulate);

    if (tier.isSilver) {
      const rimSvg = Buffer.from(`
        <svg width="720" height="720" viewBox="0 0 720 720">
          <circle cx="360" cy="360" r="344" stroke="#ffffff" stroke-width="5" fill="none" opacity="0.8" />
          <circle cx="360" cy="360" r="338" stroke="#cbd5e1" stroke-width="2.5" fill="none" opacity="0.6" />
        </svg>
      `);
      const rimBuf = await sharp(rimSvg).resize(720, 720).png().toBuffer();
      const silverBuf = await pipeline.composite([{ input: rimBuf }]).png().toBuffer();
      pipeline = sharp(silverBuf);
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
          <circle cx="360" cy="360" r="346" fill="url(#prismFace)" />
          <circle cx="360" cy="360" r="344" stroke="url(#prismGrad)" stroke-width="9" fill="none" opacity="0.9" />
          <circle cx="360" cy="360" r="336" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.8" />
        </svg>
      `);
      const rainbowBuf = await sharp(rainbowSvg).resize(720, 720).png().toBuffer();
      const rainbowCoinBuf = await pipeline.composite([{ input: rainbowBuf }]).png().toBuffer();
      pipeline = sharp(rainbowCoinBuf);
    }

    // After compositing, clamp strictly outside radius 348 to guarantee 100% pure transparent border
    const rawTier = await pipeline
      .resize(360, 360)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const tierData = rawTier.data;
    const tierW = rawTier.info.width;
    const tierH = rawTier.info.height;
    const tierCx = tierW / 2;
    const tierCy = tierH / 2;
    const tierRMax = (348 / 720) * tierW; // ~174px

    for (let y = 0; y < tierH; y++) {
      for (let x = 0; x < tierW; x++) {
        const idx = (y * tierW + x) * 4;
        const dist = Math.sqrt((x - tierCx) ** 2 + (y - tierCy) ** 2);
        if (dist > tierRMax) {
          // Absolute zero out: zero alpha, zero color
          tierData[idx] = 0;
          tierData[idx + 1] = 0;
          tierData[idx + 2] = 0;
          tierData[idx + 3] = 0;
        }
      }
    }

    // Save with alphaQuality: 100 to guarantee crisp transparent bounds
    const webp360 = await sharp(tierData, {
      raw: { width: tierW, height: tierH, channels: 4 }
    })
      .webp({ quality: 98, alphaQuality: 100, lossless: false, effort: 6 })
      .toBuffer();

    fs.writeFileSync(path.join(destAssetsDir, `miner_lvl${tier.lvl}.webp`), webp360);
    fs.writeFileSync(path.join(destPublicDir, `miner_lvl${tier.lvl}.webp`), webp360);
    console.log(`  ✓ Generated 100% clean miner_lvl${tier.lvl}.webp`);
  }

  // Update default logo.webp and logo.png using Lv 1 Golden Sun
  const logoWebp = await sharp(path.join(destAssetsDir, 'miner_lvl1.webp'))
    .resize(512, 512)
    .webp({ quality: 98, alphaQuality: 100 })
    .toBuffer();
  const logoPng = await sharp(path.join(destAssetsDir, 'miner_lvl1.webp'))
    .resize(512, 512)
    .png({ quality: 100 })
    .toBuffer();

  fs.writeFileSync(path.join(destAssetsDir, 'logo.webp'), logoWebp);
  fs.writeFileSync(path.join(destPublicDir, 'logo.webp'), logoWebp);
  fs.writeFileSync(path.join(destAssetsDir, 'logo.png'), logoPng);
  fs.writeFileSync(path.join(destPublicDir, 'logo.png'), logoPng);

  console.log('[TH Coin Generator] Successfully generated all 10 pristine clean level coins!');
}

run().catch(err => {
  console.error('[TH Coin Generator Error]', err);
  process.exit(1);
});
