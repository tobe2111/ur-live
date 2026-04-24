// Re-export all reel-related types from the canonical LiveTypes source
export type { ApiError, YTPlayer, YTPlayerEvent, Stream, Product, ReelData } from './LiveTypes'

// Type guard for ApiError — used in ReelCard catch blocks
export function isApiError(error: unknown): error is import('./LiveTypes').ApiError {
  return typeof error === 'object' && error !== null && ('response' in error || 'message' in error)
}
