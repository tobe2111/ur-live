/**
 * 🔔 작업 버튼 완료 감지 헬퍼(2026-07-27 대표 "완료되었다고 알람 + 결과값").
 *   각 작업이 platform_settings 에 남기는 결과 스탬프(last_run/at)를 /stats 응답에서 골라,
 *   클릭 시각 이후로 갱신되면 완료로 판정하고 숫자 요약을 만든다. AdminPartnerPoolPage 전용.
 */
export type RunObj = Record<string, unknown> & { last_run?: string; at?: string; diag?: { error?: string } }

const pick = (path: string) => (d: Record<string, unknown>): RunObj | null =>
  ((d?.[path] as { run?: RunObj } | undefined)?.run) || null

/** 버튼 경로 → /stats 응답에서 그 작업의 결과 객체를 고르는 셀렉터. */
export const STAT_PICK: Record<string, (d: Record<string, unknown>) => RunObj | null> = {
  'collect': pick('collect'), 'collect-storeinfo': pick('storeinfo'), 'collect-commerce': pick('commerce'),
  'collect-franchise': pick('franchise'), 'collect-nara': pick('nara'), 
  'collect-nps': pick('nps'), 'sweep-nts': pick('nts'), 'sweep-mx': pick('mx'),
  'enrich': d => (d?.enrichLast as RunObj) || null, 'enrich-burst': d => (d?.enrichBurst as RunObj) || null,
  'run-all': d => (d?.runAll as RunObj) || null,
}

const NUM_LABEL: Record<string, string> = {
  found: '발견', saved: '저장', matched: '적합', enriched: '연락처 확보', processed: '처리', removed: '제거',
  updated: '갱신', scanned: '검사', held: '보류', checked: '검증', cleared: '정리', rounds: '라운드', passes: '패스', emailed: '이메일',
}

/** 결과 객체의 숫자 필드를 사람이 읽는 요약("발견 214 · 저장 87")으로. */
export const fmtRun = (run: RunObj): string => Object.entries(run)
  .filter(([k, v]) => typeof v === 'number' && NUM_LABEL[k])
  .map(([k, v]) => `${NUM_LABEL[k]} ${(v as number).toLocaleString()}`).join(' · ')

export const runStamp = (run: RunObj): string => String(run.last_run || run.at || '')

/** 서버 스탬프('YYYY-MM-DD HH:MM:SS' UTC 또는 ISO)를 epoch(ms)로 — 파싱 실패는 0(완료 아님). */
export const parseStamp = (s: string): number => { const t = Date.parse(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`); return Number.isFinite(t) ? t : 0 }
