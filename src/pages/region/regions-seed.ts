/**
 * 🗺️ 2026-11-08 — 지역 착지 문서에 워커가 실은 `/api/regions` 시드(`__SSR_INITIAL_REGIONS__`)를 읽는다.
 * 지역 화면은 그 통계로 딜 수를 그리는데, 종전엔 첫 렌더에 통계가 없어 "아직 딜이 없어요" 를 잠깐 그렸다.
 * 없으면 undefined(종전처럼 요청).
 */
import type { SidoStat } from '@/shared/constants/region-slugs'

export function readRegionsSeed(): SidoStat[] | undefined {
  if (typeof document === 'undefined') return undefined
  try {
    const t = document.getElementById('__SSR_INITIAL_REGIONS__')?.textContent
    if (!t) return undefined
    const r = JSON.parse(t) as { success?: boolean; data?: SidoStat[] }
    return r?.success && Array.isArray(r.data) ? r.data : undefined
  } catch { return undefined }
}
