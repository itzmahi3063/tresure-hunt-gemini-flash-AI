const sharp = require('C:/Users/Grow With Mahi/.gemini/antigravity/scratch/hoocooh-miner/node_modules/sharp');
const path = require('path');
const fs = require('fs');

const srcPath = 'C:/Users/Grow With Mahi/.gemini/antigravity/brain/db47226f-7a24-42ad-8e74-00003eafa8b0/treasure_coin_soja_1791990163506.jpg';
const destAssetsDir = path.join(__dirname, '../public/assets');

async function buildCleanAssets() {
  console.log('[Assets] Reading new straight coin image:', srcPath);

  // Exact circle mask on 1024x1024:
  // Center is (512, 512). The coin outer milled edge spans from 30 to 994 (diameter 964, radius 482).
  // Radius 480 provides a perfect, crisp circular border with no white fringe and no black outer layer!
  const maskSvg = Buffer.from(
    `<svg width="1024" height="1024">
      <circle cx="512" cy="512" r="481" fill="#ffffff" />
    </svg>`
  );

  const maskBuffer = await sharp(maskSvg).png().toBuffer();

  const cleanCoin1024 = await sharp(srcPath)
    .composite([{ input: maskBuffer, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // 1. Output logo.webp and logo.png (512x512)
  console.log('[Assets] Saving logo.webp and logo.png (512x512)...');
  await sharp(cleanCoin1024)
    .resize(512, 512)
    .webp({ quality: 95 })
    .toFile(path.join(destAssetsDir, 'logo.webp'));

  await sharp(cleanCoin1024)
    .resize(512, 512)
    .png({ quality: 95 })
    .toFile(path.join(destAssetsDir, 'logo.png'));

  // 2. Output 10 miner level webp images (miner_lvl1.webp to miner_lvl10.webp)
  // NO level badge or text on the coin ("coin er upore jono level gula kora na thake")!
  // NO black layer or border around it ("ashe pasher black layer jono na thake")!
  // Clean straight coin ("coin soja kore deo")!
  // We provide the crisp 360x360 clean straight coin for all 10 levels.
  console.log('[Assets] Generating clean 360x360 level assets without badge overlay...');

  const cleanCoin360 = await sharp(cleanCoin1024)
    .resize(360, 360)
    .webp({ quality: 95 })
    .toBuffer();

  for (let lvl = 1; lvl <= 10; lvl++) {
    const targetFile = path.join(destAssetsDir, `miner_lvl${lvl}.webp`);
    fs.writeFileSync(targetFile, cleanCoin360);
    console.log(`  ✓ Generated miner_lvl${lvl}.webp (clean straight coin, no badges)`);
  }

  console.log('[Assets] All assets generated successfully!');
}

buildCleanAssets().catch(err => {
  console.error('[Assets Error]', err);
  process.exit(1);
});
