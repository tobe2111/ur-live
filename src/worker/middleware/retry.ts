/**
 * 📡 Retry Middleware - External API Call Retry Logic
 * 
 * Purpose:
 * - Automatically retry failed external API calls (Toss, Kakao, Firebase, etc.)
 * - Exponential backoff to avoid overwhelming failing services
 * - Configurable retry count and timeout
 * 
 * Features:
 * - Transient error detection (network timeout, 5xx errors)
 * - Exponential backoff: 1s → 2s → 4s → 8s
 * - Circuit breaker pattern to prevent cascading failures
 * - Detailed logging for debugging
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
  timeoutMs?: number;
}

interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDurationMs: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  timeoutMs: 30000,
};

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: any, options: Required<RetryOptions>): boolean {
  // Network errors
  if (error.name === 'NetworkError' || error.name === 'TimeoutError') {
    return true;
  }

  // HTTP status codes
  if (error.status && options.retryableStatuses.includes(error.status)) {
    return true;
  }

  // Fetch API errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  return false;
}

/**
 * Calculate exponential backoff delay
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const delay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);
  return Math.min(delay, options.maxDelayMs);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 * 
 * @example
 * const result = await retryWithBackoff(
 *   async () => {
 *     const response = await fetch('https://api.example.com/data');
 *     if (!response.ok) throw new Error(`HTTP ${response.status}`);
 *     return response.json();
 *   },
 *   { maxRetries: 3, initialDelayMs: 1000 }
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      console.log(`[Retry] Attempt ${attempt + 1}/${opts.maxRetries + 1}`);

      // Execute function with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('TimeoutError')), opts.timeoutMs);
      });

      const data = await Promise.race([fn(), timeoutPromise]);

      const totalDurationMs = Date.now() - startTime;
      console.log(`[Retry] ✅ Success on attempt ${attempt + 1}, duration: ${totalDurationMs}ms`);

      return {
        success: true,
        data,
        attempts: attempt + 1,
        totalDurationMs,
      };
    } catch (error: any) {
      lastError = error;
      console.error(`[Retry] ❌ Attempt ${attempt + 1} failed:`, error.message || error);

      // Check if error is retryable
      if (!isRetryableError(error, opts)) {
        console.log('[Retry] Non-retryable error, aborting');
        break;
      }

      // Don't delay after last attempt
      if (attempt < opts.maxRetries) {
        const delayMs = calculateDelay(attempt, opts);
        console.log(`[Retry] Waiting ${delayMs}ms before next attempt...`);
        await sleep(delayMs);
      }
    }
  }

  const totalDurationMs = Date.now() - startTime;
  console.error(`[Retry] ❌ All attempts failed after ${totalDurationMs}ms`);

  return {
    success: false,
    error: lastError,
    attempts: opts.maxRetries + 1,
    totalDurationMs,
  };
}

/**
 * Retry middleware for fetch requests
 * 
 * @example
 * const response = await retryFetch('https://api.example.com/data', {
 *   method: 'POST',
 *   body: JSON.stringify({ data: 'test' }),
 * }, { maxRetries: 3 });
 */
export async function retryFetch(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  const result = await retryWithBackoff(async () => {
    const response = await fetch(url, init);
    
    // Treat 4xx as non-retryable (except 408, 429)
    if (response.status >= 400 && response.status < 500) {
      if (response.status === 408 || response.status === 429) {
        throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
      }
      // Don't retry client errors
      return response;
    }

    // Retry 5xx errors
    if (!response.ok) {
      throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
    }

    return response;
  }, options);

  if (!result.success || !result.data) {
    throw result.error || new Error('Retry failed');
  }

  return result.data;
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

/**
 * Circuit breaker pattern to prevent cascading failures
 * 
 * @example
 * const result = await withCircuitBreaker(
 *   'payment-api',
 *   async () => {
 *     return await fetch('https://payment-api.example.com/charge');
 *   },
 *   { threshold: 5, resetTimeoutMs: 60000 }
 * );
 */
export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  options: {
    threshold?: number;
    resetTimeoutMs?: number;
  } = {}
): Promise<T> {
  const { threshold = 5, resetTimeoutMs = 60000 } = options;

  let state = circuitBreakers.get(name) || {
    failures: 0,
    lastFailureTime: 0,
    state: 'closed',
  };

  // Check if circuit should reset
  if (state.state === 'open' && Date.now() - state.lastFailureTime > resetTimeoutMs) {
    console.log(`[CircuitBreaker:${name}] Transitioning to half-open`);
    state.state = 'half-open';
  }

  // Circuit is open, reject immediately
  if (state.state === 'open') {
    console.error(`[CircuitBreaker:${name}] ⛔ Circuit is OPEN, rejecting request`);
    throw new Error(`Circuit breaker for ${name} is OPEN`);
  }

  try {
    const result = await fn();

    // Success - reset circuit breaker
    if (state.state === 'half-open') {
      console.log(`[CircuitBreaker:${name}] ✅ Half-open success, closing circuit`);
    }
    state = { failures: 0, lastFailureTime: 0, state: 'closed' };
    circuitBreakers.set(name, state);

    return result;
  } catch (error) {
    state.failures++;
    state.lastFailureTime = Date.now();

    console.error(`[CircuitBreaker:${name}] ❌ Failure ${state.failures}/${threshold}`);

    // Open circuit if threshold exceeded
    if (state.failures >= threshold) {
      console.error(`[CircuitBreaker:${name}] ⛔ Opening circuit after ${state.failures} failures`);
      state.state = 'open';
    }

    circuitBreakers.set(name, state);
    throw error;
  }
}

/**
 * Export all retry utilities
 */
export default {
  retryWithBackoff,
  retryFetch,
  withCircuitBreaker,
};
