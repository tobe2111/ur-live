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
 * Format: ORDER_{timestamp}_{randomId}
 * Example: ORDER_1234567890123_aBc123XyZ456
 * 
 * @param userId - Optional user ID to include in the order ID (for debugging)
 * @returns Toss Payments compliant order ID (6-64 chars)
 */
export function generateOrderId(userId?: string | number): string {
  const timestamp = Date.now();
  const randomId = generateRandomId(12);
  
  if (userId) {
    const sanitized = sanitizeUserId(userId);
    // Format: ORDER_{timestamp}_{sanitizedUserId}_{randomId}
    // Length: 6 + 13 + 1 + up to 16 + 1 + 12 = max 49 chars (within 64 limit)
    return `ORDER_${timestamp}_${sanitized}_${randomId}`;
  }
  
  // Format: ORDER_{timestamp}_{randomId}
  // Length: 6 + 13 + 1 + 12 = 32 chars (within 6-64 limit)
  return `ORDER_${timestamp}_${randomId}`;
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
 */
export function testOrderIdGeneration() {
  console.log('Testing Order ID Generation:');
  
  // Test 1: Without user ID
  const orderId1 = generateOrderId();
  console.log('1. Without user ID:', orderId1, 'Valid:', validateOrderId(orderId1));
  
  // Test 2: With numeric user ID
  const orderId2 = generateOrderId(123456);
  console.log('2. With numeric user ID:', orderId2, 'Valid:', validateOrderId(orderId2));
  
  // Test 3: With Firebase UID (alphanumeric)
  const orderId3 = generateOrderId('abc123XYZ789def456');
  console.log('3. With Firebase UID:', orderId3, 'Valid:', validateOrderId(orderId3));
  
  // Test 4: With Korean characters (should be sanitized)
  const orderId4 = generateOrderId('사용자123');
  console.log('4. With Korean characters:', orderId4, 'Valid:', validateOrderId(orderId4));
  
  // Test 5: With special characters (should be sanitized)
  const orderId5 = generateOrderId('user@email.com');
  console.log('5. With special characters:', orderId5, 'Valid:', validateOrderId(orderId5));
  
  console.log('All tests completed!');
}
