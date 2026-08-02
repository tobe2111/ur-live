/** 순위(tier) 분포 한 줄 — 페이지 본문에서 추출(600줄 캡). 렌더 로직 불변. */
export default function TierBreakdown({ leads }: { leads: Array<{ tier: number | null }> }) {
  const by = new Map<string, number>()
  for (const l of leads) { const k = l.tier == null ? '—' : `${l.tier}순위`; by.set(k, (by.get(k) || 0) + 1) }
  return <>{[...by.entries()].map(([k, n]) => `${k} ${n}`).join(' · ') || '—'}</>
}
