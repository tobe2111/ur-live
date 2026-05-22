/**
 * Operation Guide — Default seeds
 *
 * 🛡️ 2026-05-22: 2012줄 → 분할.
 *   ADMIN_SEED  → guide-seed-admin.ts
 *   SELLER_SEED → guide-seed-seller.ts
 *   AGENCY_SEED → guide-seed-agency.ts
 *   SeedSection → guide-seed-types.ts
 *
 * 최초 배포 시 자동 삽입되는 기본 가이드 콘텐츠 (markdown).
 * 어드민이 /admin/operations-guide 에서 수정 가능.
 *
 * 🤖 자동 생성 섹션:
 *   각 역할 가이드 끝에 'auto-reference' 섹션이 자동 추가됨.
 *   업데이트: `npm run generate:guide-refs`
 */

import { AUTO_REFERENCE } from './auto-reference'
import type { SeedSection } from './guide-seed-types'
import { ADMIN_SEED } from './guide-seed-admin'
import { SELLER_SEED } from './guide-seed-seller'
import { AGENCY_SEED } from './guide-seed-agency'

function autoRefSection(role: 'admin' | 'seller' | 'agency'): SeedSection {
  return {
    key: 'auto-reference',
    icon: '🤖',
    title: '코드 자동 참조 (페이지 + API)',
    order: 999,
    content: AUTO_REFERENCE[role],
  }
}

export const GUIDE_SEEDS: Record<'admin' | 'seller' | 'agency', SeedSection[]> = {
  admin: [...ADMIN_SEED, autoRefSection('admin')],
  seller: [...SELLER_SEED, autoRefSection('seller')],
  agency: [...AGENCY_SEED, autoRefSection('agency')],
}

export type { SeedSection }
