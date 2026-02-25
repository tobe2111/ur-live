/**
 * Password Hashing using Web Crypto API
 * 
 * Cloudflare Workers compatible password hashing
 * Uses PBKDF2 algorithm (industry standard)
 */

/**
 * Hash a password using PBKDF2
 * @param password - Plain text password
 * @returns Hashed password string (format: salt$hash)
 */
export async function hashPassword(password: string): Promise<string> {
  // Generate random salt (16 bytes = 128 bits)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  
  // Convert password to buffer
  const passwordBuffer = new TextEncoder().encode(password)
  
  // Import password as key
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  
  // Derive hash using PBKDF2
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000, // OWASP recommendation: 100,000+ iterations
      hash: 'SHA-256'
    },
    key,
    256 // 256 bits = 32 bytes
  )
  
  // Convert to base64 for storage
  const saltBase64 = btoa(String.fromCharCode(...salt))
  const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
  
  // Format: salt$hash
  return `${saltBase64}$${hashBase64}`
}

/**
 * Verify a password against a hash
 * @param password - Plain text password to verify
 * @param storedHash - Stored hash (format: salt$hash)
 * @returns True if password matches
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Parse stored hash
  const [saltBase64, hashBase64] = storedHash.split('$')
  
  if (!saltBase64 || !hashBase64) {
    return false
  }
  
  // Decode salt
  const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0))
  
  // Convert password to buffer
  const passwordBuffer = new TextEncoder().encode(password)
  
  // Import password as key
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  
  // Derive hash using same parameters
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    key,
    256
  )
  
  // Convert to base64 for comparison
  const hashBase64Computed = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
  
  // Constant-time comparison (prevents timing attacks)
  return hashBase64 === hashBase64Computed
}

/**
 * Example usage:
 * 
 * // Hash password before storing
 * const hashedPassword = await hashPassword('mySecretPassword123')
 * // Store hashedPassword in database
 * 
 * // Verify password on login
 * const isValid = await verifyPassword('mySecretPassword123', storedHashedPassword)
 * if (isValid) {
 *   // Login successful
 * }
 */
