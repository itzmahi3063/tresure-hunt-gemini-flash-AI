const sharp = require('C:/Users/Grow With Mahi/.gemini/antigravity/scratch/hoocooh-miner/node_modules/sharp');
const path = require('path');
const fs = require('fs');

const srcPath = 'C:/Users/Grow With Mahi/.gemini/antigravity/brain/db47226f-7a24-42ad-8e74-00003eafa8b0/treasure_coin_soja_1791990163506.jpg';
const destAssetsDir = path.join(__dirname, '../public/assets');
const destPublicDir = path.join(__dirname, '../public');

// Circle mask for 1024x1024: center (512, 512), radius 481
const maskSvg = Buffer.from(
  `<svg width="1024" height="1024">
    <circle cx="512" cy="512" r="481" fill="#ffffff" />
  </svg>`
);

// 10 Progressive Tiers from Starter to Transcendent (increasingly prestigious & elite!)
const TIERS = [
  {
    lvl: 1,
    name: 'Starter (Bronze / Ancient Copper)',
    modulate: { hue: -18, saturation: 1.15, brightness: 0.95 },
    glowColor: '#cd7f32',
    auraRgb: '205, 127, 50',
    ringWidth: 0
  },
  {
    lvl: 2,
    name: 'Developed (Polished Silver / Platinum)',
    modulate: { saturation: 0.08, brightness: 1.08 },
    glowColor: '#cbd5e1',
    auraRgb: '203, 213, 225',
    ringWidth: 3
  },
  {
    lvl: 3,
    name: 'Refined (Fine Pale Electrum Gold)',
    modulate: { hue: -5, saturation: 1.25, brightness: 1.05 },
    glowColor: '#fef08a',
    auraRgb: '254, 240, 138',
    ringWidth: 4
  },
  {
    lvl: 4,
    name: 'Vanguard (Rose Gold / Ruby Flame)',
    modulate: { hue: -35, saturation: 1.45, brightness: 1.02 },
    glowColor: '#f43f5e',
    auraRgb: '244, 63, 94',
    ringWidth: 5
  },
  {
    lvl: 5,
    name: 'Apex (Emerald Royal 24k Gold)',
    modulate: { hue: 75, saturation: 1.4, brightness: 1.05 },
    glowColor: '#10b981',
    auraRgb: '16, 185, 129',
    ringWidth: 6
  },
  {
    lvl: 6,
    name: 'Celestial (Royal Amethyst Purple)',
    modulate: { hue: 215, saturation: 1.5, brightness: 1.05 },
    glowColor: '#a855f7',
    auraRgb: '168, 85, 247',
    ringWidth: 7
  },
  {
    lvl: 7,
    name: 'Quantum (Cyan Neon Diamond)',
    modulate: { hue: 140, saturation: 1.55, brightness: 1.1 },
    glowColor: '#06b6d4',
    auraRgb: '6, 182, 212',
    ringWidth: 8
  },
  {
    lvl: 8,
    name: 'Mythic (Imperial Sapphire Blue)',
    modulate: { hue: 175, saturation: 1.6, brightness: 1.08 },
    glowColor: '#3b82f6',
    auraRgb: '59, 130, 246',
    ringWidth: 9
  },
  {
    lvl: 9,
    name: 'Sovereign (Pure Radiant Sun Gold)',
    modulate: { hue: 0, saturation: 1.65, brightness: 1.18 },
    glowColor: '#fbbf24',
    auraRgb: '251, 191, 36',
    ringWidth: 10
  },
  {
    lvl: 10,
    name: 'Transcendent (Prismatic Divine Diamond / Rainbow Platinum)',
    modulate: { hue: 155, saturation: 1.35, brightness: 1.25 },
    glowColor: '#ffffff',
    auraRgb: '0, 240, 255',
    ringWidth: 12,
    isRainbow: true
  }
];

async function generate10Tiers() {
  console.log('[Tiers] Building 10 progressive 3D coins...');
  const maskBuffer = await sharp(maskSvg).png().toBuffer();

  // Create clean base masked coin at 1024x1024
  const baseMaskedCoin = await sharp(srcPath)
    .composite([{ input: maskBuffer, blend: 'dest-in' }])
    .png()
    .toBuffer();

  for (const tier of TIERS) {
    console.log(`[Tiers] Rendering Level ${tier.lvl}: ${tier.name}...`);

    let pipeline = sharp(baseMaskedCoin).modulate(tier.modulate);

    // Add optional elegant outer tier rim / crystal luster
    const composites = [];

    if (tier.ringWidth > 0) {
      let ringSvg = '';
      if (tier.isRainbow) {
        ringSvg = `
          <svg width="1024" height="1024" viewBox="0 0 1024 1024">
            <defs>
              <linearGradient id="rainbowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#00f0ff" />
                <stop offset="25%" stop-color="#a855f7" />
                <stop offset="50%" stop-color="#ec4899" />
                <stop offset="75%" stop-color="#fbbf24" />
                <stop offset="100%" stop-color="#00f0ff" />
              </linearGradient>
            </defs>
            <circle cx="512" cy="512" r="476" stroke="url(#rainbowGrad)" stroke-width="${tier.ringWidth}" fill="none" opacity="0.9" />
            <circle cx="512" cy="512" r="468" stroke="#ffffff" stroke-width="2.5" fill="none" opacity="0.85" />
          </svg>
        `;
      } else {
        ringSvg = `
          <svg width="1024" height="1024" viewBox="0 0 1024 1024">
            <circle cx="512" cy="512" r="476" stroke="${tier.glowColor}" stroke-width="${tier.ringWidth}" fill="none" opacity="0.85" />
          </svg>
        `;
      }
      const ringBuffer = await sharp(Buffer.from(ringSvg)).png().toBuffer();
      composites.push({ input: ringBuffer });
    }

    if (composites.length > 0) {
      pipeline = pipeline.composite(composites);
    }

    const tierCoin = await pipeline.png().toBuffer();

    // Save 360x360 WebP to public/assets/ and public/
    const webp360 = await sharp(tierCoin)
      .resize(360, 360)
      .webp({ quality: 95 })
      .toBuffer();

    fs.writeFileSync(path.join(destAssetsDir, `miner_lvl${tier.lvl}.webp`), webp360);
    fs.writeFileSync(path.join(destPublicDir, `miner_lvl${tier.lvl}.webp`), webp360);
    console.log(`  ✓ Generated miner_lvl${tier.lvl}.webp`);
  }

  // Also update logo.webp and logo.png with Lv 9 Sovereign Pure Gold
  const sovereignWebp = await sharp(path.join(destAssetsDir, 'miner_lvl9.webp'))
    .resize(512, 512)
    .webp({ quality: 95 })
    .toBuffer();

  const sovereignPng = await sharp(path.join(destAssetsDir, 'miner_lvl9.webp'))
    .resize(512, 512)
    .png({ quality: 95 })
    .toBuffer();

  fs.writeFileSync(path.join(destAssetsDir, 'logo.webp'), sovereignWebp);
  fs.writeFileSync(path.join(destPublicDir, 'logo.webp'), sovereignWebp);
  fs.writeFileSync(path.join(destAssetsDir, 'logo.png'), sovereignPng);
  fs.writeFileSync(path.join(destPublicDir, 'logo.png'), sovereignPng);

  console.log('[Tiers] All 10 progressive 3D coins successfully created!');
}

generate10Tiers().catch(err => {
  console.error('[Tiers Error]', err);
  process.exit(1);
});
