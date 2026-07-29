/**
 * 🧬 파트너풀 중복 병합 라우트 — `partner-pool.routes.ts` 에서 분리 (2026-07-28).
 *
 *   분리 이유: 본 파일이 600줄(god 파일 래칫) 한도에 닿았다. CLAUDE.md "새 페이지 체크리스트" 대로
 *   **우회하지 않고 핸들러群을 모듈로 추출**한다. 병합은 라이브 리드 테이블을 수정하는 별개 관심사라
 *   경계도 자연스럽다(로직 SSOT 는 `company-dedupe.ts`).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'

export const partnerPoolDedupeRoutes = new Hono<{ Bindings: Env }>()

/**
 * POST /api/admin/partner-pool/dedupe { dryRun?, maxGroups? } — 중복 행 병합.
 *   전화 + 정규화 상호가 **둘 다** 같은 그룹만 접는다. 큐레이션 행(대표가 손댄 행)은 승자 우선이고
 *   한 그룹에 둘 이상이면 그룹째 보류한다. 패자는 `active=0` + `merged_into=<승자>` **표시만**(삭제 0).
 *   기본 `dryRun=true` — 세어보고 나서 실행한다.
 */
partnerPoolDedupeRoutes.post('/dedupe', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { dryRun?: boolean; maxGroups?: number }
  const { dedupeCompanyLeads } = await import('./company-dedupe')
  const r = await dedupeCompanyLeads(c.env.DB, { dryRun: b.dryRun !== false, maxGroups: b.maxGroups })
  return c.json({ success: true, data: r })
})

/** ↩️ POST /api/admin/partner-pool/dedupe-undo { survivorId } — 특정 승자로 접힌 행 전량 복원. */
partnerPoolDedupeRoutes.post('/dedupe-undo', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { survivorId?: number }
  const id = Number(b.survivorId)
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: 'survivorId 필요' }, 400)
  const { undoDedupe } = await import('./company-dedupe')
  return c.json({ success: true, restored: await undoDedupe(c.env.DB, id) })
})

export default partnerPoolDedupeRoutes
