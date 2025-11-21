const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src/native/build/Release');
const destDir = path.join(__dirname, '../dist/src/native/build/Release');

if (fs.existsSync(srcDir)) {
  console.log('Copying native addon to dist...');
  fs.mkdirSync(destDir, { recursive: true });
  
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    if (file.endsWith('.node')) {
      fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
      console.log(`Copied ${file}`);
    }
  }
} else {
  console.log('Native addon build not found, skipping copy. (App will use JS fallback)');
}
