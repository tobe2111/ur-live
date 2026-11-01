export interface NaverPlaceCandidate { id: string; name: string; address?: string }
export function nameKey(s: string | null | undefined): string
export function districtTokens(address: string | null | undefined): string[]
export function pickNaverPlace(candidates: NaverPlaceCandidate[], name: string, address?: string | null): NaverPlaceCandidate | null
export function businessPhotoUrls(text: string, limit?: number): string[]
export function candidatesFromApollo(state: unknown): NaverPlaceCandidate[]
