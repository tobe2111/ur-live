import { formatNumber } from '@/utils/format'

/**
 * 🔎 수집/정비 상태 패널 — 마지막 수집 요약 + 플랫폼 진단 + 구글시트 동기화 + 🌙 야간 자동 정비 결과.
 *   AdminInfluencerPoolPage 에서 추출(600줄 캡). 순수 표시 컴포넌트(상태 없음).
 */
export interface PlatformDiag { configured: boolean; found: number; saved: number; error?: string }
export interface RunStats {
  last_run?: string; last_saved?: number; total_saved?: number; total_runs?: number; promoted?: string[]
  youtube_quota_hit?: boolean; bio_enriched?: number; perf_enriched?: number
  diag?: { yt: PlatformDiag; naver: PlatformDiag; tistory?: PlatformDiag; naver_enrich?: { tried: number; measured: number; contacts: number; failed: number } }
  yt_budget?: { used: number; total: number; day?: string }
}
/** 야간 정비 기록(platform_settings) — 실행된 단계만 키가 존재. *_error 는 그 단계 실패. */
export interface MaintenanceRecord {
  at?: string; kind?: string
  merge?: { merged?: number }; reextract?: { filled?: number }; reclassify?: { changed?: number }
  quality?: { scanned?: number; branded?: number; done?: boolean }
  rescan?: { changed?: number }; refetch?: { processed?: number }
  naver?: { measured?: number; contacts?: number } // 📝 야간 블로거 스윕(활동성·프로필 연락처)
  [k: string]: unknown
}

export const fmtKST = (iso?: string) => {
  if (!iso) return '-'
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
  return isNaN(d.getTime()) ? '-' : d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** 정비 기록 → 사람이 읽는 한 줄(실행된 단계만). 에러 키가 있으면 그 단계를 ⚠️ 로 표시. */
function summarize(m?: MaintenanceRecord | null): { text: string; hasError: boolean } | null {
  if (!m) return null
  const parts: string[] = []
  const err: string[] = []
  const add = (label: string, n?: number) => { if (typeof n === 'number' && n > 0) parts.push(`${label} ${formatNumber(n)}`) }
  add('중복통합', m.merge?.merged); add('연락처보강', m.reextract?.filled); add('재분류', m.reclassify?.changed)
  if (m.quality) parts.push(`품질채점 ${formatNumber(m.quality.scanned || 0)}${m.quality.branded ? ` · 브랜드태깅 +${formatNumber(m.quality.branded)}` : ''}`)
  add('카테고리재보정', m.rescan?.changed); add('라이브재조회', m.refetch?.processed)
  if (m.naver?.measured) parts.push(`블로거측정 ${formatNumber(m.naver.measured)}${m.naver.contacts ? `(연락처 +${formatNumber(m.naver.contacts)})` : ''}`)
  for (const k of Object.keys(m)) if (k.endsWith('_error')) err.push(k.replace('_error', ''))
  return { text: parts.length ? parts.join(' · ') : '변경 없음(이미 정리됨)', hasError: err.length > 0 }
}

export default function CollectDiagPanel({ run, sheetsSync, maintenance, maintenanceRescan }: {
  run: RunStats | null
  sheetsSync: { ok: boolean; at?: string; error?: string | null } | null
  maintenance?: MaintenanceRecord | null
  maintenanceRescan?: MaintenanceRecord | null
}) {
  const mSum = summarize(maintenance)
  const rSum = summarize(maintenanceRescan)
  // 플랫폼 상태: 키없음 or (에러 & 저장0)=hard, (에러 & 저장>0)=일시부분실패, 그 외 정상.
  const cls = (p: PlatformDiag) => !p.configured ? 'missing' : (p.error && p.saved === 0) ? 'failed' : (p.error && p.saved > 0) ? 'partial' : 'ok'
  const d = run?.diag
  const yt = d ? cls(d.yt) : 'ok', nv = d ? cls(d.naver) : 'ok'
  const hard = yt === 'missing' || yt === 'failed' || nv === 'missing' || nv === 'failed'
  const soft = yt === 'partial' || nv === 'partial'
  const line = (label: string, p: PlatformDiag, st: string) => (
    <div>{label} — {p.configured ? `발굴 ${formatNumber(p.found)} · 저장 ${formatNumber(p.saved)}` : '키 미설정'}
      {st === 'ok' ? ' · 정상' : st === 'partial' ? ' · 일부 키워드 일시 실패(다음 시간 자동 재시도)' : st === 'failed' ? ` · ⚠️ ${p.error}` : ''}</div>
  )

  return (
    <>
      {/* 📊 구글시트 마지막 동기화 상태 — 무음 실패 가시화. 실패 시에만 표시. */}
      {sheetsSync && !sheetsSync.ok ? (
        <div className="mb-2 mt-1 text-[11px] text-red-600">📊 구글시트 동기화 실패({fmtKST(sheetsSync.at)}): {sheetsSync.error || '원인 미상'} — 정비 도구에서 수동 재시도 가능</div>
      ) : null}

      {run?.diag?.naver_enrich && run.diag.naver_enrich.tried > 0 && run.diag.naver_enrich.measured === 0 ? (
        <div className="mb-2 mt-1 text-[11px] text-amber-600">📝 블로거 활동성 측정 실패(시도 {run.diag.naver_enrich.tried} · 성공 0) — 네이버가 서버 요청을 차단 중일 수 있어요. 반복되면 '마지막 글' 날짜(검색 기반)만으로 활동을 판단하세요.</div>
      ) : null}
      {run && (
        <div className="mb-1 text-xs text-gray-500">
          마지막 수집 {fmtKST(run.last_run)} · 신규 {formatNumber(run.last_saved)}건 · 누적 {formatNumber(run.total_saved)}건 · 실행 {formatNumber(run.total_runs)}회{run.bio_enriched ? ` · 🔗 링크 컨택보강 ${formatNumber(run.bio_enriched)}건` : ''}{run.diag?.naver_enrich?.measured ? ` · 📝 블로거 측정 ${formatNumber(run.diag.naver_enrich.measured)}${run.diag.naver_enrich.contacts ? `(연락처 +${formatNumber(run.diag.naver_enrich.contacts)})` : ''}` : ''}
          {run.yt_budget ? <span className={run.yt_budget.used >= run.yt_budget.total ? 'text-amber-600 font-medium' : ''}>{` · 🎯 YT 검색 예산 ${formatNumber(run.yt_budget.used)}/${formatNumber(run.yt_budget.total)}`}{run.yt_budget.used >= run.yt_budget.total ? ' (오후 4~5시 리셋)' : ''}</span> : ''}
          {run.youtube_quota_hit ? ' · ⚠️ 유튜브 일일 한도 도달(네이버만 계속)' : ''}
          {run.promoted?.length ? ` · 자동확장 키워드 +${run.promoted.length}` : ''}
        </div>
      )}

      {/* 🌙 야간 자동 정비(KST 03시 정비 / 04시 라이브 재보정) — 자동화가 실제로 돌았는지 확인. */}
      {(mSum || rSum) && (
        <div className="mb-4 text-xs text-gray-500">
          🌙 자동 정비
          {mSum && <span className={mSum.hasError ? 'text-amber-600' : ''}> {fmtKST(maintenance?.at)} — {mSum.text}{mSum.hasError ? ' ⚠️일부 단계 실패' : ''}</span>}
          {mSum && rSum ? <span className="text-gray-300"> | </span> : null}
          {rSum && <span className={rSum.hasError ? 'text-amber-600' : ''}>재보정 {fmtKST(maintenanceRescan?.at)} — {rSum.text}{rSum.hasError ? ' ⚠️일부 단계 실패' : ''}</span>}
        </div>
      )}

      {/* 🔎 플랫폼별 진단 — 실제 문제(키없음/전건실패)면 빨강, 일시 부분실패(저장>0)면 앰버, 완전정상이면 숨김 */}
      {d && (hard || soft) && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-xs space-y-1 ${hard ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          <div className="font-medium">수집 진단 (마지막 실행){!hard && soft ? ' — 정상(일부 일시 실패)' : ''}</div>
          {line('유튜브', d.yt, yt)}
          {line('네이버', d.naver, nv)}
          {hard && <div className="text-red-500">키 미설정이면: Cloudflare → Workers &amp; Pages → <b>ur-ads</b> → Settings → Variables and Secrets 에 해당 키 추가.</div>}
        </div>
      )}
    </>
  )
}
