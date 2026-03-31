/**
 * Toss Payments Order ID Generator
 * 
 * Toss Payments orderId requirements:
 * - Only English letters (a-z, A-Z), numbers (0-9), hyphens (-), underscores (_)
 * - Length: 6 to 64 characters
 * - Must be unique for each order
 */

/**
 * Generate a random alphanumeric string
 * @param length - Length of the random string (default: 12)
 * @returns Random string with only a-z, A-Z, 0-9
 */
export function generateRandomId(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Sanitize user ID to be Toss Payments compliant
 * - Remove all non-alphanumeric characters except - and _
 * - Truncate to max 16 characters
 * @param userId - User ID to sanitize
 * @returns Sanitized user ID
 */
export function sanitizeUserId(userId: string | number): string {
  const userIdStr = String(userId);
  return userIdStr
    .replace(/[^a-zA-Z0-9\-_]/g, '') // Remove invalid characters
    .substring(0, 16); // Limit length
}

/**
 * Generate a unique order ID for Toss Payments
 * Format: 숫자만 사용 (YYMMDDHHmmss + random 6자리)
 * Example: 260331095312847291
 * Length: 18자리
 */
export function generateOrderId(_userId?: string | number): string {
  const now = new Date();
  const datePart = [
    String(now.getFullYear()).slice(2),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('')
  const randomPart = String(Math.floor(100000 + Math.random() * 900000))
  return datePart + randomPart
}

/**
 * Validate if an order ID is Toss Payments compliant
 * @param orderId - Order ID to validate
 * @returns true if valid, false otherwise
 */
export function validateOrderId(orderId: string): boolean {
  // Check length
  if (orderId.length < 6 || orderId.length > 64) {
    return false;
  }
  
  // Check characters (only a-z, A-Z, 0-9, -, _)
  const validPattern = /^[a-zA-Z0-9\-_]+$/;
  return validPattern.test(orderId);
}

/**
 * Test function to verify order ID generation
 * Returns test results for programmatic verification.
 */
export function testOrderIdGeneration() {
  const results = [
    { label: 'Without user ID', id: generateOrderId() },
    { label: 'With numeric user ID', id: generateOrderId(123456) },
    { label: 'With Firebase UID', id: generateOrderId('abc123XYZ789def456') },
    { label: 'With Korean characters', id: generateOrderId('사용자123') },
    { label: 'With special characters', id: generateOrderId('user@email.com') },
  ];

  return results.map(r => ({ ...r, valid: validateOrderId(r.id) }));
}
