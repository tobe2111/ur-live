#!/usr/bin/env node
/**
 * Force update script
 * Injects unique timestamp into static files to force Cloudflare Pages re-upload
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const staticDir = path.join(__dirname, 'dist', 'static');
const timestamp = new Date().toISOString();
const buildId = crypto.randomBytes(8).toString('hex');

// Files to force update
const filesToUpdate = [
  'live.html',
  'cart.html'
];

console.log(`🔄 Forcing file updates (Build: ${buildId})...`);

filesToUpdate.forEach(filename => {
  const filepath = path.join(staticDir, filename);
  
  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  ${filename} not found, skipping...`);
    return;
  }
  
  let content = fs.readFileSync(filepath, 'utf8');
  
  if (filename.endsWith('.html')) {
    // Inject timestamp in <head> section to change file hash
    const uniqueComment = `    <!-- Build: ${timestamp} | ID: ${buildId} -->\n`;
    content = content.replace('</head>', `${uniqueComment}</head>`);
  }
  
  fs.writeFileSync(filepath, content);
  
  const newHash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
  console.log(`✅ Updated ${filename} (hash: ${newHash})`);
});

console.log('✅ Force update complete!');
