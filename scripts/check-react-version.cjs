#!/usr/bin/env node

/**
 * 🔒 React Version Guard - preinstall hook
 * 
 * This script prevents accidental React version upgrades that cause:
 * - "Cannot read properties of undefined (reading 'forwardRef')" errors
 * - White screen on all pages
 * - Incompatibility with UI libraries (Radix UI, Recharts, lucide-react)
 * 
 * CRITICAL: React MUST stay at 18.3.1
 * DO NOT upgrade to React 19.x or higher!
 */

const fs = require('fs');
const path = require('path');

const ALLOWED_REACT_VERSION = '18.3.1';
const ALLOWED_REACT_DOM_VERSION = '18.3.1';
const ALLOWED_ROUTER_VERSION = '6.28.1';

console.log('\n🔒 [React Version Guard] Checking package.json...\n');

try {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const reactVersion = packageJson.dependencies?.react;
  const reactDomVersion = packageJson.dependencies?.['react-dom'];
  const routerVersion = packageJson.dependencies?.['react-router-dom'];
  
  let hasError = false;
  
  // Check React version
  if (reactVersion && reactVersion !== ALLOWED_REACT_VERSION && !reactVersion.includes(ALLOWED_REACT_VERSION)) {
    console.error(`❌ ERROR: React version mismatch!`);
    console.error(`   Found: ${reactVersion}`);
    console.error(`   Required: ${ALLOWED_REACT_VERSION} (exact)`);
    console.error(`   Reason: React 19+ causes forwardRef errors with UI libraries\n`);
    hasError = true;
  }
  
  // Check React DOM version
  if (reactDomVersion && reactDomVersion !== ALLOWED_REACT_DOM_VERSION && !reactDomVersion.includes(ALLOWED_REACT_DOM_VERSION)) {
    console.error(`❌ ERROR: React DOM version mismatch!`);
    console.error(`   Found: ${reactDomVersion}`);
    console.error(`   Required: ${ALLOWED_REACT_DOM_VERSION} (exact)`);
    hasError = true;
  }
  
  // Check React Router version (6.x is compatible with React 18)
  if (routerVersion && !routerVersion.includes('6.')) {
    console.error(`❌ ERROR: React Router version incompatible!`);
    console.error(`   Found: ${routerVersion}`);
    console.error(`   Required: 6.x.x (React Router 7+ requires React 19)`);
    hasError = true;
  }
  
  if (hasError) {
    console.error(`\n⚠️  CRITICAL: Do NOT proceed with installation!`);
    console.error(`\n📋 To fix, run:`);
    console.error(`   npm install react@18.3.1 react-dom@18.3.1 react-router-dom@6.28.1 --save-exact\n`);
    process.exit(1);
  }
  
  console.log(`✅ React version check passed:`);
  console.log(`   - React: ${reactVersion || 'not found'}`);
  console.log(`   - React DOM: ${reactDomVersion || 'not found'}`);
  console.log(`   - React Router: ${routerVersion || 'not found'}`);
  console.log(`\n🔒 Version guard: ACTIVE\n`);
  
} catch (error) {
  console.warn(`⚠️  Warning: Could not verify React version: ${error.message}`);
  console.warn(`   This check will be skipped.\n`);
}
