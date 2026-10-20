/**
 * Generate PBKDF2 password hashes for test accounts
 * 
 * Usage:
 * node generate-password-hashes.mjs
 */

import crypto from 'crypto';

/**
 * Hash a password using PBKDF2
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password string (format: salt$hash)
 */
async function hashPassword(password) {
  // Generate random salt (16 bytes = 128 bits)
  const salt = crypto.randomBytes(16);
  
  // Derive hash using PBKDF2
  const hash = await new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
  
  // Convert to base64 for storage
  const saltBase64 = salt.toString('base64');
  const hashBase64 = hash.toString('base64');
  
  // Format: salt$hash
  return `${saltBase64}$${hashBase64}`;
}

// Generate hashes for test accounts
async function main() {
  console.log('🔐 Generating PBKDF2 password hashes...\n');
  
  const adminPassword = 'admin123';
  const sellerPassword = 'seller123';
  
  const adminHash = await hashPassword(adminPassword);
  const sellerHash = await hashPassword(sellerPassword);
  
  console.log('✅ Admin password hash:');
  console.log(`   Password: ${adminPassword}`);
  console.log(`   Hash: ${adminHash}\n`);
  
  console.log('✅ Seller password hash:');
  console.log(`   Password: ${sellerPassword}`);
  console.log(`   Hash: ${sellerHash}\n`);
  
  console.log('📝 SQL to create test accounts:\n');
  console.log(`-- Admin account (admin@ur-team.com / admin123)`);
  console.log(`INSERT OR IGNORE INTO admins (username, email, password_hash, name, role, created_at)`);
  console.log(`VALUES ('admin', 'admin@ur-team.com', '${adminHash}', '관리자', 'super_admin', datetime('now'));\n`);
  
  console.log(`-- Seller account (seller@ur-team.com / seller123)`);
  console.log(`INSERT OR IGNORE INTO sellers (username, email, password_hash, name, business_name, business_number, phone, status, commission_rate, created_at, updated_at)`);
  console.log(`VALUES ('testseller', 'seller@ur-team.com', '${sellerHash}', '테스트 셀러', '테스트 상점', '123-45-67890', '010-1234-5678', 'approved', 10.00, datetime('now'), datetime('now'));\n`);
  
  console.log('📋 Copy the SQL above and run it in Cloudflare D1 Console:\n');
  console.log('   1. Go to https://dash.cloudflare.com');
  console.log('   2. Workers & Pages → D1 Database → toss-live-commerce-db');
  console.log('   3. Console tab → Paste SQL → Execute\n');
}

main().catch(console.error);
