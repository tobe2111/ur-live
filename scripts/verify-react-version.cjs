#!/usr/bin/env node

/**
 * 🔍 React Version Verification - postinstall hook
 * 
 * This script verifies that node_modules actually contains the correct React version
 * after npm install completes.
 * 
 * Purpose: Detect if npm overrides were ignored or if a transitive dependency
 * installed a different React version.
 */

const fs = require('fs');
const path = require('path');

const EXPECTED_REACT_VERSION = '18.3.1';

console.log('\n🔍 [Post-Install Verification] Checking installed React version...\n');

try {
  // Check React package.json in node_modules
  const reactPkgPath = path.join(process.cwd(), 'node_modules', 'react', 'package.json');
  
  if (!fs.existsSync(reactPkgPath)) {
    console.warn('⚠️  Warning: React not found in node_modules');
    console.warn('   This is normal during initial setup.\n');
    process.exit(0);
  }
  
  const reactPkg = JSON.parse(fs.readFileSync(reactPkgPath, 'utf8'));
  const installedVersion = reactPkg.version;
  
  if (installedVersion !== EXPECTED_REACT_VERSION) {
    console.error(`\n❌ CRITICAL ERROR: Wrong React version installed!`);
    console.error(`   Expected: ${EXPECTED_REACT_VERSION}`);
    console.error(`   Installed: ${installedVersion}`);
    console.error(`\n⚠️  This WILL cause forwardRef errors and white screens!`);
    console.error(`\n🔧 To fix:`);
    console.error(`   1. Delete node_modules and package-lock.json`);
    console.error(`   2. Run: npm install`);
    console.error(`   3. If problem persists, check for conflicting dependencies\n`);
    process.exit(1);
  }
  
  // Also check React DOM
  const reactDomPkgPath = path.join(process.cwd(), 'node_modules', 'react-dom', 'package.json');
  if (fs.existsSync(reactDomPkgPath)) {
    const reactDomPkg = JSON.parse(fs.readFileSync(reactDomPkgPath, 'utf8'));
    const domVersion = reactDomPkg.version;
    
    if (domVersion !== EXPECTED_REACT_VERSION) {
      console.error(`\n❌ ERROR: React DOM version mismatch!`);
      console.error(`   Expected: ${EXPECTED_REACT_VERSION}`);
      console.error(`   Installed: ${domVersion}\n`);
      process.exit(1);
    }
  }
  
  console.log(`✅ Verification passed:`);
  console.log(`   - React ${installedVersion} is correctly installed`);
  console.log(`   - All versions match expected configuration`);
  console.log(`\n🎉 Safe to proceed!\n`);
  
} catch (error) {
  console.warn(`⚠️  Warning: Verification error: ${error.message}`);
  console.warn(`   Manual verification recommended.\n`);
}
