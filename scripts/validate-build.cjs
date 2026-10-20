#!/usr/bin/env node

/**
 * 🔒 Build Validation - Pre-build hook
 * 
 * This script runs BEFORE every build to ensure:
 * 1. React version is correct (18.3.1)
 * 2. No duplicate React instances in node_modules
 * 3. Vite config has correct chunk splitting
 * 
 * Purpose: Catch configuration errors before they cause production issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n🔒 [Pre-Build Validation] Starting checks...\n');

let hasError = false;

// ============================================
// 1. Verify React Version
// ============================================
try {
  const packageJson = require(path.join(process.cwd(), 'package.json'));
  const reactVersion = packageJson.dependencies.react;
  
  if (reactVersion !== '18.3.1') {
    console.error('❌ ERROR: Wrong React version in package.json');
    console.error(`   Expected: 18.3.1`);
    console.error(`   Found: ${reactVersion}`);
    hasError = true;
  } else {
    console.log('✅ React version: 18.3.1');
  }
} catch (error) {
  console.error('❌ ERROR: Could not read package.json:', error.message);
  hasError = true;
}

// ============================================
// 2. Check for Duplicate React Instances
// ============================================
try {
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  
  if (fs.existsSync(nodeModulesPath)) {
    // Count React installations
    const reactPath = path.join(nodeModulesPath, 'react');
    const reactDomPath = path.join(nodeModulesPath, 'react-dom');
    
    if (fs.existsSync(reactPath)) {
      const reactPkg = require(path.join(reactPath, 'package.json'));
      console.log(`✅ React installed: ${reactPkg.version}`);
      
      // Check for nested React installations (common cause of duplicates)
      try {
        const result = execSync('find node_modules -name "react" -type d -path "*/node_modules/react" 2>/dev/null | wc -l', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore']
        });
        const nestedCount = parseInt(result.trim());
        
        if (nestedCount > 0) {
          console.error(`❌ ERROR: Found ${nestedCount} nested React installation(s)!`);
          console.error(`   This will cause "Cannot set properties of undefined" errors!`);
          console.error(`\n   To fix:`);
          console.error(`   1. Delete node_modules and package-lock.json`);
          console.error(`   2. Run: npm install`);
          console.error(`   3. Verify with: npm ls react\n`);
          hasError = true;
        } else {
          console.log('✅ No nested React installations found');
        }
      } catch (e) {
        console.log('⚠️  Could not check for nested React (find command not available)');
      }
    }
  } else {
    console.warn('⚠️  Warning: node_modules not found (first install?)');
  }
} catch (error) {
  console.warn('⚠️  Warning: Could not check for duplicate React:', error.message);
}

// ============================================
// 3. Validate Vite Config
// ============================================
try {
  const viteConfigPath = path.join(process.cwd(), 'vite.config.ts');
  const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
  
  // Check for correct React chunk pattern
  const hasCorrectPattern = viteConfig.includes("id.includes('node_modules/react/')") ||
                           viteConfig.includes('node_modules/react/');
  
  if (!hasCorrectPattern) {
    console.error('❌ ERROR: Vite config missing correct React chunk pattern!');
    console.error(`   Required pattern: id.includes('node_modules/react/')`);
    console.error(`   This prevents React from being split into multiple chunks.`);
    hasError = true;
  } else {
    console.log('✅ Vite config has correct React chunking');
  }
  
  // Check for scheduler in react-core
  const hasScheduler = viteConfig.includes('scheduler');
  if (!hasScheduler) {
    console.warn('⚠️  Warning: scheduler not in react-core chunk (React 18 dependency)');
  } else {
    console.log('✅ Scheduler included in react-core chunk');
  }
  
} catch (error) {
  console.error('❌ ERROR: Could not validate vite.config.ts:', error.message);
  hasError = true;
}

// ============================================
// 4. Check for Common Mistakes
// ============================================
try {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    
    if (!gitignore.includes('node_modules')) {
      console.error('❌ ERROR: node_modules not in .gitignore!');
      hasError = true;
    } else {
      console.log('✅ .gitignore configured correctly');
    }
  }
} catch (error) {
  console.warn('⚠️  Warning: Could not check .gitignore:', error.message);
}

// ============================================
// Final Result
// ============================================
console.log('\n' + '='.repeat(50));
if (hasError) {
  console.error('❌ Pre-build validation FAILED!');
  console.error('   Fix the errors above before building.\n');
  process.exit(1);
} else {
  console.log('✅ Pre-build validation PASSED!');
  console.log('   Safe to proceed with build.\n');
  process.exit(0);
}
