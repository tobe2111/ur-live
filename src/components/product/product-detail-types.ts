export interface GroupTier {
  count: number
  discount: number
}

export interface ActiveGroup {
  id?: number | string
  invite_code: string
  creator_name: string
  current_count: number
  target_count: number
  tiers?: GroupTier[]
  expires_at?: string
  unlocked_tier?: GroupTier | null
}
