// ============================================================
// Simple Circuit Breaker for External Service Resilience
//
// Purpose: When an upstream service (Toss, Kakao, YouTube, Resend,
// Cafe24, etc.) starts failing, stop hammering it for a short
// window and either run a fallback or fail fast. This protects
// our workers from cascading timeouts / quota exhaustion.
//
// States:
//   CLOSED     — normal operation, failures are counted
//   OPEN       — reject all calls (use fallback / throw) until
//                `resetTimeoutMs` elapses since last failure
//   HALF_OPEN  — one probe request is allowed through; success
//                closes the circuit, failure re-opens it
//
// Note: Cloudflare Workers are stateless across requests in
// different isolates, so in-memory `circuits` state is per-isolate.
// That's fine for rate-limiting a single hot instance; for
// cross-isolate coordination you'd need KV (future enhancement).
// ============================================================

interface CircuitState {
  failures: number
  lastFailureAt: number
  state: 'closed' | 'open' | 'half-open'
}

const circuits = new Map<string, CircuitState>()

export interface CircuitBreakerOptions {
  name: string
  maxFailures?: number        // default 5
  resetTimeoutMs?: number     // default 30s
  halfOpenAttempts?: number   // default 1 (reserved for future)
}

export async function withCircuitBreaker<T>(
  opts: CircuitBreakerOptions,
  operation: () => Promise<T>,
  fallback?: () => T | Promise<T>,
): Promise<T> {
  const { name, maxFailures = 5, resetTimeoutMs = 30_000 } = opts
  let state = circuits.get(name)

  if (!state) {
    state = { failures: 0, lastFailureAt: 0, state: 'closed' }
    circuits.set(name, state)
  }

  // If OPEN, check if we should try half-open
  if (state.state === 'open') {
    if (Date.now() - state.lastFailureAt > resetTimeoutMs) {
      state.state = 'half-open'
    } else {
      // Still failing — use fallback or throw
      if (fallback) return await fallback()
      throw new Error(`Circuit breaker [${name}] is OPEN (service unavailable)`)
    }
  }

  try {
    const result = await operation()
    // Success — reset
    state.failures = 0
    state.state = 'closed'
    return result
  } catch (e) {
    state.failures++
    state.lastFailureAt = Date.now()
    if (state.failures >= maxFailures) {
      state.state = 'open'
    }
    if (fallback) return await fallback()
    throw e
  }
}

/**
 * Inspect current circuit state (useful for /api/health).
 */
export function getCircuitState(name: string): CircuitState | null {
  return circuits.get(name) ?? null
}

/**
 * List all circuits (useful for admin diagnostics).
 */
export function listCircuits(): Record<string, CircuitState> {
  const out: Record<string, CircuitState> = {}
  for (const [k, v] of circuits.entries()) out[k] = { ...v }
  return out
}

/**
 * Manually reset a circuit — useful for tests or ops recovery.
 */
export function resetCircuit(name: string): void {
  circuits.delete(name)
}

/**
 * Helper: fetch with circuit breaker + timeout + optional fallback.
 * Use this for non-critical external fetches. For payment-critical
 * paths, call `withCircuitBreaker` directly so you control errors.
 */
export async function fetchWithFallback<T>(
  fn: () => Promise<T>,
  fallback: T,
  timeoutMs = 5000,
): Promise<T> {
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs),
      ),
    ])
  } catch {
    return fallback
  }
}
