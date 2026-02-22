#!/usr/bin/env node

/**
 * 🔍 Post-Build Validation
 * 
 * This script runs AFTER build to verify:
 * 1. React is in ONE chunk only (no duplicates)
 * 2. Chunk sizes are reasonable
 * 3. Critical files exist
 * 
 * Purpose: Catch build output issues before deployment
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 [Post-Build Validation] Analyzing build output...\n');

let hasError = false;
let hasWarning = false;

// ============================================
// 1. Check dist directory exists
// ============================================
const distPath = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ ERROR: dist/ directory not found!');
  console.error('   Build may have failed.');
  process.exit(1);
}

// ============================================
// 2. Find all JavaScript chunks
// ============================================
const assetsPath = path.join(distPath, 'assets');
if (!fs.existsSync(assetsPath)) {
  console.error('❌ ERROR: dist/assets/ directory not found!');
  process.exit(1);
}

const jsFiles = fs.readdirSync(assetsPath)
  .filter(f => f.endsWith('.js'))
  .map(f => ({
    name: f,
    path: path.join(assetsPath, f),
    size: fs.statSync(path.join(assetsPath, f)).size
  }));

console.log(`📦 Found ${jsFiles.length} JavaScript chunks\n`);

// ============================================
// 3. Check for React chunks
// ============================================
const reactCoreChunks = jsFiles.filter(f => f.name.includes('react-core'));
const vendorChunks = jsFiles.filter(f => f.name.includes('vendor-') && !f.name.includes('vendor-D') && !f.name.includes('utils'));

if (reactCoreChunks.length === 0) {
  console.error('❌ ERROR: No react-core chunk found!');
  console.error('   Vite config may be broken.');
  hasError = true;
} else if (reactCoreChunks.length > 1) {
  console.error('❌ ERROR: Multiple react-core chunks found!');
  console.error('   This will cause duplicate React instances!');
  reactCoreChunks.forEach(c => console.error(`   - ${c.name}`));
  hasError = true;
} else {
  const chunk = reactCoreChunks[0];
  const sizeKB = (chunk.size / 1024).toFixed(2);
  console.log(`✅ Single react-core chunk: ${chunk.name} (${sizeKB} KB)`);
  
  // Check size is reasonable (React 18 should be ~140-160 KB)
  if (chunk.size > 170 * 1024) {
    console.warn(`⚠️  Warning: react-core is larger than expected (${sizeKB} KB > 170 KB)`);
    console.warn(`   May contain duplicate React code!`);
    hasWarning = true;
  }
}

// ============================================
// 4. Check vendor chunks don't contain React
// ============================================
console.log('\n🔍 Checking vendor chunks for React code...');

vendorChunks.forEach(chunk => {
  const content = fs.readFileSync(chunk.path, 'utf8');
  
  // Look for React-specific code patterns
  const hasReactCode = content.includes('__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED') ||
                       content.includes('Children:') && content.includes('createElement:') ||
                       content.includes('react-dom') && content.includes('createRoot');
  
  if (hasReactCode) {
    console.error(`❌ ERROR: ${chunk.name} contains React code!`);
    console.error(`   This will cause duplicate React instances!`);
    console.error(`   Check vite.config.ts manualChunks configuration.`);
    hasError = true;
  } else {
    const sizeKB = (chunk.size / 1024).toFixed(2);
    console.log(`✅ ${chunk.name} is clean (${sizeKB} KB)`);
  }
});

// ============================================
// 5. Check critical files
// ============================================
console.log('\n🔍 Checking critical files...');

const criticalFiles = [
  'index.html',
  '_worker.js',
  '_routes.json'
];

criticalFiles.forEach(file => {
  const filePath = path.join(distPath, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ERROR: ${file} not found!`);
    hasError = true;
  } else {
    console.log(`✅ ${file} exists`);
  }
});

// ============================================
// 6. Summary
// ============================================
console.log('\n' + '='.repeat(50));

if (hasError) {
  console.error('❌ Post-build validation FAILED!');
  console.error('   DO NOT DEPLOY! Fix errors above first.\n');
  process.exit(1);
} else if (hasWarning) {
  console.warn('⚠️  Post-build validation passed with warnings.');
  console.warn('   Review warnings above.\n');
  process.exit(0);
} else {
  console.log('✅ Post-build validation PASSED!');
  console.log('   Build output is safe to deploy.\n');
  
  // Print chunk summary
  console.log('📊 Chunk Summary:');
  const sortedChunks = jsFiles.sort((a, b) => b.size - a.size).slice(0, 10);
  sortedChunks.forEach(chunk => {
    const sizeKB = (chunk.size / 1024).toFixed(2);
    console.log(`   ${chunk.name.padEnd(40)} ${sizeKB.padStart(8)} KB`);
  });
  console.log('');
  
  process.exit(0);
}
