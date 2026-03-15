// ============================================================
// Shared Utilities
// ============================================================
/**
 * Generate a unique order number
 * Format: ORD-{timestamp}-{random}
 * e.g., ORD-20240925-A3F7K2
 */
export function generateOrderNumber() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${date}-${random}`;
}
/**
 * Generate a UUID v4
 */
export function generateId() {
    return crypto.randomUUID();
}
/**
 * Format currency
 */
export function formatCurrency(amount, currency = 'KRW', locale = 'ko-KR') {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}
/**
 * Calculate shipping fee for a seller
 */
export function calculateShippingFee(subtotal, baseShippingFee, freeShippingThreshold) {
    if (freeShippingThreshold !== undefined && subtotal >= freeShippingThreshold) {
        return 0;
    }
    return baseShippingFee;
}
/**
 * Sleep utility
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Safe JSON parse
 */
export function safeJsonParse(json, fallback) {
    if (!json)
        return fallback;
    try {
        return JSON.parse(json);
    }
    catch {
        return fallback;
    }
}
/**
 * Convert hex string to ArrayBuffer
 */
export function hexToArrayBuffer(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes.buffer;
}
/**
 * Convert ArrayBuffer to hex string
 */
export function arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
/**
 * Truncate string
 */
export function truncate(str, maxLength) {
    if (str.length <= maxLength)
        return str;
    return str.slice(0, maxLength - 3) + '...';
}
/**
 * Korean date format
 */
export function formatDate(dateStr, locale = 'ko-KR', options) {
    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options,
    };
    return new Intl.DateTimeFormat(locale, defaultOptions).format(new Date(dateStr));
}
