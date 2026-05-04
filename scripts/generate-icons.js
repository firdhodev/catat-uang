const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const srcImage = process.argv[2];
const outputDir = path.join(__dirname, '..', 'public', 'icons');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

Promise.all(
  sizes.map((size) =>
    sharp(srcImage)
      .resize(size, size)
      .png()
      .toFile(path.join(outputDir, `icon-${size}.png`))
      .then(() => console.log(`✅ Generated icon-${size}.png`))
  )
).then(() => console.log('All icons generated!'));
