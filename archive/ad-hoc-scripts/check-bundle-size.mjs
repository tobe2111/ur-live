import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, 'dist/assets');
const files = fs.readdirSync(distDir);

const jsFiles = files
  .filter(f => f.endsWith('.js'))
  .map(f => {
    const stats = fs.statSync(path.join(distDir, f));
    const gzPath = path.join(distDir, f + '.gz');
    const gzStats = fs.existsSync(gzPath) ? fs.statSync(gzPath) : null;
    const brPath = path.join(distDir, f + '.br');
    const brStats = fs.existsSync(brPath) ? fs.statSync(brPath) : null;
    
    return {
      name: f,
      size: stats.size,
      gzip: gzStats ? gzStats.size : 0,
      brotli: brStats ? brStats.size : 0,
    };
  })
  .sort((a, b) => b.size - a.size);

console.log('\n📦 Bundle Size Analysis\n');
console.log('Top 10 Largest Files:');
console.log('─'.repeat(100));

jsFiles.slice(0, 10).forEach((file, i) => {
  const sizeKB = (file.size / 1024).toFixed(2);
  const gzipKB = (file.gzip / 1024).toFixed(2);
  const brotliKB = (file.brotli / 1024).toFixed(2);
  const reduction = file.gzip > 0 ? (((file.size - file.gzip) / file.size) * 100).toFixed(1) : 0;
  
  console.log(`${i + 1}. ${file.name}`);
  console.log(`   Raw: ${sizeKB} KB | Gzip: ${gzipKB} KB (-${reduction}%) | Brotli: ${brotliKB} KB`);
});

const totalSize = jsFiles.reduce((sum, f) => sum + f.size, 0);
const totalGzip = jsFiles.reduce((sum, f) => sum + f.gzip, 0);
const totalBrotli = jsFiles.reduce((sum, f) => sum + f.brotli, 0);

console.log('\n' + '─'.repeat(100));
console.log(`📊 Total JS Bundle:`);
console.log(`   Raw: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`   Gzip: ${(totalGzip / 1024).toFixed(2)} KB`);
console.log(`   Brotli: ${(totalBrotli / 1024).toFixed(2)} KB`);
console.log(`   Reduction: Gzip -${(((totalSize - totalGzip) / totalSize) * 100).toFixed(1)}%, Brotli -${(((totalSize - totalBrotli) / totalSize) * 100).toFixed(1)}%`);
