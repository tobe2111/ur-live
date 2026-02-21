#!/usr/bin/env node

/**
 * Version Update Script
 * Generates a unique version hash for each build to prevent cache issues
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versionFilePath = path.join(__dirname, '../public/version.json');

// Generate unique version hash
const buildTime = new Date().toISOString();
const versionHash = crypto.createHash('sha256')
  .update(buildTime + Math.random().toString())
  .digest('hex')
  .substring(0, 8);

const versionData = {
  version: versionHash,
  buildTime: buildTime
};

// Write version file
fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2));

console.log(`✅ Version updated: ${versionHash} (${buildTime})`);
