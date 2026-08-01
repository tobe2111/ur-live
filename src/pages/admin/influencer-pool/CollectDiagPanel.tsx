import { formatNumber } from '@/utils/format'

/**
 * 🔎 수집/정비 상태 패널 — 마지막 수집 요약 + 플랫폼 진단 + 구글시트 동기화 + 🌙 야간 자동 정비 결과.
 *   AdminInfluencerPoolPage 에서 추출(600줄 캡). 순수 표시 컴포넌트(상태 없음).
 */
export interface PlatformDiag { configured: boolean; found: number; saved: number; error?: string }
export interface RunStats {
  last_run?: string; last_saved?: number; total_saved?: number; total_runs?: number; promoted?: string[]
  youtube_quota_hit?: boolean; bio_enriched?: number; perf_enriched?: number
  crash?: string; crash_at?: string; crash_spent?: number; crash_budget?: number
  diag?: { yt: PlatformDiag; naver: PlatformDiag; tistory?: PlatformDiag; naver_enrich?: { tried: number; measured: number; contacts: number; failed: number } }
  yt_budget?: { used: number; total: number; day?: string }
  /** 🎯 픽 소진 실태 — 계획한 키워드 중 실제로 몇 개를 돌았고, 그게 어느 경로에서 왔는지(성과가중/커서). */
  picks?: { planned: number; processed: number; from_yt: number; from_cursor: number }
}
/** 야간 정비 기록(platform_settings) — 실행된 단계만 키가 존재. *_error 는 그 단계 실패. */
export interface MaintenanceRecord {
  at?: string; kind?: string
  merge?: { merged?: number }; reextract?: { filled?: number }; reclassify?: { changed?: number }
  quality?: { scanned?: number; branded?: number; done?: boolean }
  rescan?: { changed?: number }; refetch?: { processed?: number }
  // 🧮 2026-07-28 예산 계측 — 무료 플랜은 인보케이션당 D1 연산 상한(~29)이 있어 한 회차가 백로그를 다 못 돈다.
  //   paused=true 는 **정상**(커서로 다음 회차가 이어받음) — 이게 안 보이면 "왜 조금만 처리됐지?"를 오진하게 된다.
  phase?: string; ops?: number; cap?: number; paused?: boolean; limit_hit?: boolean
  naver?: { measured?: number; contacts?: number } // 📝 야간 블로거 스윕(활동성·프로필 연락처)
  // 🩹 손상 핸들 복구 — 이 단계가 끝나기 전엔 블로거 보강 큐 앞머리가 측정 불가 행으로 막힌다.
  handle?: { scanned?: number; fixed?: number; unfixable?: number; reopened?: number; done?: boolean }
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
  if (m.handle?.fixed) parts.push(`🩹 핸들복구 ${formatNumber(m.handle.fixed)}${m.handle.reopened ? `(재측정 대기로 ${formatNumber(m.handle.reopened)} 복귀)` : ''}`)
  for (const k of Object.keys(m)) if (k.endsWith('_error')) err.push(k.replace('_error', ''))
  // 🧮 예산 상태 — 매시간 한 단계씩 순환하므로 "이번 회차에 얼마나 썼고 왜 멈췄는지"가 보여야 한다.
  if (typeof m.ops === 'number' && m.cap) parts.push(`연산 ${m.ops}/${m.cap}${m.paused ? ' · 예산소진(다음 회차 이어서)' : ''}`)
  if (m.limit_hit) parts.push('⚠️ 플랫폼 한도 도달(상한 자동 하향)')
  return { text: parts.length ? parts.join(' · ') : '변경 없음(이미 정리됨)', hasError: err.length > 0 }
}

/** 📝 보강 전용 레인 스냅샷(`ads_influencer_enrich_last`) — 마지막 라운드 결과. 서버 타입과 1:1. */
export interface EnrichLaneRecord {
  last_run?: string
  bio?: number
  yt?: number
  yt_units?: { used?: number; total?: number; day?: string }
  naver?: { tried?: number; measured?: number; contacts?: number; failed?: number; selected?: number; skipped?: number; healed?: number }
  spent?: number; budget_total?: number
  limit_hit?: boolean; deadline_hit?: boolean; elapsed_ms?: number
  total_measured?: number; total_contacts?: number
  /**
   * 📧 누적 이메일 — **이 레인이 '쓸 수 있는 리드'를 만드는지** 판정하는 값.
   *   ⚠️ `total_contacts` 를 대신 보면 안 된다: 2026-07-29 까지 그 값은 네이버 블로거의 **자기 블로그 링크**를
   *   연락처로 세어 부풀어 있었다(실측: 이메일 없는 303명 중 295명이 자기링크만 보유). 유입은 막았지만
   *   기존 누적치는 그대로다 — 화면엔 **이메일만** 보여 오독을 원천 차단한다.
   */
  total_emails?: number
  /**
   * 🔗 **이번 정각 전체의 합**(라운드 N개). 위 필드들은 전부 *마지막 라운드 한 장*이라,
   *   체인이 3라운드를 돌아도 앞 두 라운드가 무엇을 했는지 화면에서 볼 수 없었다.
   *   ⚠️ `rounds` 를 먼저 볼 것 — `max_depth + 1` 보다 작으면 중간 라운드가 죽은 것이고,
   *      그때 합계 0 은 '못 쟀다'가 아니라 '기록이 없다'는 뜻이다.
   */
  chain?: {
    rounds?: number; rounds_planned?: number; max_depth?: number; bio?: number; yt?: number
    naver_selected?: number; naver_tried?: number; naver_measured?: number; naver_contacts?: number
    deadline_hits?: number; spent?: number; started_at?: string
  }
  crash?: string; crash_at?: string
}

export default function CollectDiagPanel({ run, sheetsSync, sheetsCron, sheetsGate, maintenance, maintenanceRescan, maintainRunning, enrichLane, nbUnmeasured, naverBlogTotal }: {
  run: RunStats | null
  sheetsSync: { ok: boolean; at?: string; error?: string | null; rows?: number | null; subreq?: number; trigger?: string } | null
  /** 🕘 cron 회차 전용 마지막 시각 — 수동 실행이 덮어쓰는 sheetsSync 로는 "자동으로 돈 적 있나"를 못 답한다. */
  sheetsCron?: { at?: string; ok?: boolean } | null
  /** 🚦 ur-ads env 의 시트 동기화 게이트 실값. null=알 수 없음 — 모를 때는 단정하지 않는다. */
  sheetsGate?: boolean | null
  maintenance?: MaintenanceRecord | null
  maintenanceRescan?: MaintenanceRecord | null
  /** 🔧 2026-07-28: 서버 lease 기준 '정비 진행 중'. 없으면 버튼을 눌러도 진행/완료를 알 수 없었다. */
  maintainRunning?: boolean
  enrichLane?: EnrichLaneRecord | null
  nbUnmeasured?: number      // 📝 활동성 미측정 블로거 수(보강 백로그) — 줄어들어야 레인이 도는 것
  naverBlogTotal?: number
}) {
  const mSum = summarize(maintenance)
  const rSum = summarize(maintenanceRescan)
  // 플랫폼 상태: 키없음 or (에러 & 저장0)=hard, (에러 & 저장>0)=일시부분실패, 그 외 정상.
  const cls = (p: PlatformDiag) => !p.configured ? 'missing' : (p.error && p.saved === 0) ? 'failed' : (p.error && p.saved > 0) ? 'partial' : 'ok'
  const d = run?.diag
  const yt = d ? cls(d.yt) : 'ok', nv = d ? cls(d.naver) : 'ok'
  // 🆕 티스토리(카카오 Daum 검색) — 옛 스냅샷엔 이 슬롯이 없다. 없으면 'ok' 로 둬서 **옛 기록이 빨간불을
  //   내지 않게** 한다(배선 전 회차와 배선 후 회차가 같은 화면에 섞인다).
  const ts = d?.tistory ? cls(d.tistory) : 'ok'
  const hard = [yt, nv, ts].some(x => x === 'missing' || x === 'failed')
  const soft = [yt, nv, ts].some(x => x === 'partial')
  const line = (label: string, p: PlatformDiag, st: string) => (
    <div>{label} — {p.configured ? `발굴 ${formatNumber(p.found)} · 저장 ${formatNumber(p.saved)}` : '키 미설정'}
      {st === 'ok' ? ' · 정상' : st === 'partial' ? ' · 일부 키워드 일시 실패(다음 시간 자동 재시도)' : st === 'failed' ? ` · ⚠️ ${p.error}` : ''}</div>
  )

  return (
    <>
      {/* 📊 구글시트 마지막 동기화 — 실패뿐 아니라 **멈춤**도 보여야 한다.
          2026-07-28 실사고: 미러가 34시간 정지했는데 스탬프는 `ok:true` 인 옛 값이라(예외로 죽어 갱신조차 못 함)
          화면에도 경보에도 아무 신호가 없었다. 매시간 도는 잡이므로 3시간 넘게 조용하면 그 자체가 이상 신호다. */}
      {sheetsSync && !sheetsSync.ok ? (
        <div className="mb-2 mt-1 text-[11px] text-red-600">📊 구글시트 동기화 실패({fmtKST(sheetsSync.at)}): {sheetsSync.error || '원인 미상'} — 정비 도구에서 수동 재시도 가능</div>
      ) : sheetsSync?.at && Date.now() - Date.parse(sheetsSync.at) > 3 * 3600_000 ? (
        // 🚦 '꺼짐'과 '고장'을 나눠 말한다 — 다음 행동이 정반대다(env 를 켠다 vs 원인을 캔다).
        //    2026-07-28: 게이트를 모른 채 "매시간 도는 작업입니다"라고 단정해, 꺼져 있을 때도 고장으로 읽혔다.
        sheetsGate === false ? (
          <div className="mb-2 mt-1 text-[11px] text-gray-500">
            📊 구글시트 동기화가 <b>꺼져 있습니다</b>(ur-ads <code>ADS_SHEETS_SYNC_ENABLED</code>) — 마지막 {fmtKST(sheetsSync.at)}
            {sheetsSync.rows ? ` · ${formatNumber(sheetsSync.rows)}행` : ''}. 고장이 아니라 설정입니다. 필요하면 정비 도구에서 수동 동기화하세요.
          </div>
        ) : (
          <div className="mb-2 mt-1 text-[11px] text-amber-600">
            📊 구글시트 동기화가 {Math.floor((Date.now() - Date.parse(sheetsSync.at)) / 3600_000)}시간째 멈춰 있어요(마지막 {fmtKST(sheetsSync.at)}
            {sheetsSync.rows ? ` · ${formatNumber(sheetsSync.rows)}행` : ''}
            {sheetsSync.trigger ? ` · ${sheetsSync.trigger === 'cron' ? '자동' : sheetsSync.trigger === 'manual' ? '수동 실행' : '출처 미상'}` : ''})
            {/* 🔎 cron 기록 유무가 '고장'과 '한 번도 안 돎'을 가른다 — 마지막 스탬프는 수동 실행이 덮어쓴다. */}
            {sheetsGate === true
              ? (sheetsCron?.at
                ? ` — 게이트는 켜져 있고 자동 실행 기록도 있습니다(마지막 자동 ${fmtKST(sheetsCron.at)}) — 실행이 중간에 죽고 있는 것입니다.`
                : ' — 게이트는 켜져 있는데 자동 실행 기록이 아예 없습니다(cron 이 이 잡에 도달하지 못하는 것).')
              : ' — 매시간 도는 작업입니다(게이트 상태 확인 불가).'}
            {' '}정비 도구에서 수동 동기화로 원인이 기록됩니다.
          </div>
        )
      ) : null}

      {/* 🎯 계획 대비 실행 — 예산이 앞 몇 개에서 끝나면 뒤쪽(커서픽)은 영영 안 돈다. 숫자로 보여야
          "왜 같은 키워드만 도나"를 코드를 뒤지지 않고 알 수 있다(2026-07-29 실측: 16개 계획 / 3개 실행). */}
      {run?.picks ? (
        <div className="mb-2 mt-1 text-[11px] text-gray-500">
          🎯 이번 회차 키워드 {formatNumber(run.picks.processed)}개 실행 / {formatNumber(run.picks.planned)}개 계획
          {` · 성과가중 ${formatNumber(run.picks.from_yt)} · 커서순환 ${formatNumber(run.picks.from_cursor)}`}
          {run.picks.from_cursor === 0 && run.picks.planned > run.picks.processed
            ? ' — 커서순환 키워드가 한 개도 도달하지 못했습니다(예산이 앞쪽에서 소진). 순환 폭이 성과가중 픽에만 의존합니다.'
            : ''}
        </div>
      ) : null}

      {run?.diag?.naver_enrich && run.diag.naver_enrich.tried > 0 && run.diag.naver_enrich.measured === 0 ? (
        <div className="mb-2 mt-1 text-[11px] text-amber-600">📝 블로거 활동성 측정 실패(시도 {run.diag.naver_enrich.tried} · 성공 0) — 네이버가 서버 요청을 차단 중일 수 있어요. 반복되면 '마지막 글' 날짜(검색 기반)만으로 활동을 판단하세요.</div>
      ) : null}
      {/* 💥 수집이 예외로 끝났다 / ⏸️ 매시간 도는데 오래 조용하다 — 2026-07-28 실사고: 수집이 2시간 넘게
          죽어 있었는데(다른 레인은 정상) 화면엔 옛 성공 시각만 있어 아무도 몰랐다. */}
      {run?.crash ? (
        <div className="mb-2 mt-1 text-[11px] text-red-600">
          💥 수집 실패({fmtKST(run.crash_at)}): {run.crash}
          {run.crash_budget ? ` · 예산 ${formatNumber(run.crash_spent || 0)}/${formatNumber(run.crash_budget)}` : ''}
          {' '}— 한도 신호면 상한을 자동으로 낮춰 다음 시간에 재시도합니다.
        </div>
      ) : run?.last_run && Date.now() - Date.parse(run.last_run.replace(' ', 'T') + 'Z') > 3 * 3600_000 ? (
        <div className="mb-2 mt-1 text-[11px] text-amber-600">
          ⏸️ 자동 수집이 {Math.floor((Date.now() - Date.parse(run.last_run.replace(' ', 'T') + 'Z')) / 3600_000)}시간째 조용합니다(매시간 실행) — 게이트가 켜져 있는데도 이러면 실행이 중간에 죽고 있는 것입니다.
        </div>
      ) : null}
      {run && (
        <div className="mb-1 text-xs text-gray-500">
          마지막 수집 {fmtKST(run.last_run)} · 신규 {formatNumber(run.last_saved)}건 · 누적 {formatNumber(run.total_saved)}건 · 실행 {formatNumber(run.total_runs)}회{run.bio_enriched ? ` · 🔗 링크 컨택보강 ${formatNumber(run.bio_enriched)}건` : ''}{run.diag?.naver_enrich?.measured ? ` · 📝 블로거 측정 ${formatNumber(run.diag.naver_enrich.measured)}${run.diag.naver_enrich.contacts ? `(연락처 +${formatNumber(run.diag.naver_enrich.contacts)})` : ''}` : ''}
          {run.yt_budget ? <span className={run.yt_budget.used >= run.yt_budget.total ? 'text-amber-600 font-medium' : ''}>{` · 🎯 YT 검색 예산 ${formatNumber(run.yt_budget.used)}/${formatNumber(run.yt_budget.total)}`}{run.yt_budget.used >= run.yt_budget.total ? ' (오후 4~5시 리셋)' : ''}</span> : ''}
          {run.youtube_quota_hit ? ' · ⚠️ 유튜브 일일 한도 도달(네이버만 계속)' : ''}
          {run.promoted?.length ? ` · 자동확장 키워드 +${run.promoted.length}` : ''}
        </div>
      )}

      {/* 📝 보강 전용 레인(시간당 N라운드, 수집과 분리) — 블로거 활동성·연락처 백로그를 실제로 줄이고 있는지.
          측정 시도는 했는데 성공이 0 이면 네이버 차단 신호(값이 0/0 이면 원인 판별이 안 되므로 tried 를 같이 본다). */}
      {enrichLane?.last_run ? (
        <div className="mb-1 text-xs text-gray-500">
          📝 풀 보강 {fmtKST(enrichLane.last_run)} — 블로거 측정 {formatNumber(enrichLane.naver?.measured || 0)}/{formatNumber(enrichLane.naver?.tried || 0)}
          {enrichLane.naver?.contacts ? ` (연락처 +${formatNumber(enrichLane.naver.contacts)})` : ''}
          {enrichLane.yt ? ` · 📈 유튜브 성과 ${formatNumber(enrichLane.yt)}` : ''}
          {enrichLane.bio ? ` · 🔗 링크 컨택보강 ${formatNumber(enrichLane.bio)}` : ''}
          {` · 예산 ${formatNumber(enrichLane.spent || 0)}/${formatNumber(enrichLane.budget_total || 0)}`}
          {enrichLane.deadline_hit ? ' · ⏱️ 시간상한' : ''}
          {enrichLane.limit_hit ? ' · ⚠️ 플랫폼 한도(상한 자동 하향)' : ''}
          {nbUnmeasured != null && naverBlogTotal ? ` · 남은 블로거 ${formatNumber(nbUnmeasured)}/${formatNumber(naverBlogTotal)}` : ''}
          {enrichLane.yt_units?.total ? <span className={(enrichLane.yt_units.used || 0) >= enrichLane.yt_units.total ? 'text-amber-600' : ''}>{` · 📈 YT 성과 쿼터 ${formatNumber(enrichLane.yt_units.used || 0)}/${formatNumber(enrichLane.yt_units.total)}`}</span> : null}
          {enrichLane.total_measured ? ` · 누적 측정 ${formatNumber(enrichLane.total_measured)}` : ''}
          {enrichLane.total_emails != null ? <span className="text-emerald-700">{` · 📧 누적 이메일 ${formatNumber(enrichLane.total_emails)}`}</span> : null}
        </div>
      ) : null}
      {/* 🔗 이번 정각 **전체**(라운드 합) — 위 줄은 마지막 라운드 한 장이라, 앞 라운드의 성과가 안 보였다.
          `rounds < max_depth+1` 이면 중간 라운드가 죽은 것 → 합계 0 을 '못 쟀다'로 읽으면 오진이다. */}
      {enrichLane?.chain?.rounds ? (
        <div className="mb-1 text-xs text-gray-500">
          {`🔗 이번 회차 합계 — 라운드 ${formatNumber(enrichLane.chain.rounds)}`}
          {/* 🧱 계획 대비 도달 — 격차가 곧 체인 수명 천장이다(계획 12에 도달 3이면 9라운드는 존재한 적이 없다). */}
          {enrichLane.chain.rounds_planned
            ? <span className={(enrichLane.chain.rounds || 0) < enrichLane.chain.rounds_planned ? 'text-amber-600' : ''}>
                {`/${formatNumber(enrichLane.chain.rounds_planned)}`}
                {(enrichLane.chain.rounds || 0) < enrichLane.chain.rounds_planned ? ' (수명으로 조기 종료)' : ''}
              </span> : ''}
          {(enrichLane.chain.rounds || 0) < (enrichLane.chain.max_depth || 0) + 1
            ? <span className="text-amber-600">{` (⚠️ 깊이 ${enrichLane.chain.max_depth} — 중간 라운드 기록 없음)`}</span> : ''}
          {` · 블로거 ${formatNumber(enrichLane.chain.naver_measured || 0)}/${formatNumber(enrichLane.chain.naver_tried || 0)}`}
          {(enrichLane.chain.naver_selected || 0) > (enrichLane.chain.naver_tried || 0)
            ? <span className="text-amber-600">{` (고른 ${formatNumber(enrichLane.chain.naver_selected || 0)} 중 ${formatNumber((enrichLane.chain.naver_selected || 0) - (enrichLane.chain.naver_tried || 0))}명 못 잼)`}</span> : ''}
          {enrichLane.chain.naver_contacts ? ` · 연락처 +${formatNumber(enrichLane.chain.naver_contacts)}` : ''}
          {enrichLane.chain.yt ? ` · 📈 ${formatNumber(enrichLane.chain.yt)}` : ''}
          {enrichLane.chain.deadline_hits ? ` · ⏱️ 시간상한 ${formatNumber(enrichLane.chain.deadline_hits)}회` : ''}
        </div>
      ) : null}
      {enrichLane?.crash ? (
        <div className="mb-2 text-[11px] text-red-600">📝 보강 레인 오류({fmtKST(enrichLane.crash_at)}): {enrichLane.crash}</div>
      ) : null}
      {enrichLane && (enrichLane.naver?.tried || 0) >= 5 && !enrichLane.naver?.measured ? (
        <div className="mb-2 text-[11px] text-amber-600">📝 블로거 활동성 측정 실패(시도 {enrichLane.naver?.tried} · 성공 0) — 네이버가 서버 요청을 차단 중일 수 있어요. 반복되면 &apos;마지막 글&apos; 날짜(검색 기반)만으로 활동을 판단하세요.</div>
      ) : null}
      {/* 🩹 "뽑았는데 한 건도 시도 안 함" — 2026-07-28 에 실제로 이 상태로 멈춰 있었고, 스냅샷에 이 구분이
          없어서 원인을 찾는 데 라이브 행을 직접 조회해야 했다. 이제 한 줄로 보인다. */}
      {enrichLane && (enrichLane.naver?.selected || 0) > 0 && !(enrichLane.naver?.tried || 0) ? (
        <div className="mb-2 text-[11px] text-amber-600">🩹 블로거 후보 {enrichLane.naver?.selected}건을 뽑았지만 전부 건너뜀(핸들 복구 불가 {enrichLane.naver?.skipped || 0}건) — 정비의 &apos;핸들복구&apos; 단계가 도는지 확인하세요.</div>
      ) : null}

      {/* 🌙 야간 자동 정비(KST 03시 정비 / 04시 라이브 재보정) — 자동화가 실제로 돌았는지 확인. */}
      {(mSum || rSum || maintainRunning) && (
        <div className="mb-4 text-xs text-gray-500">
          {maintainRunning
            ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />정비 진행 중…
              </span>
            : '🌙 자동 정비'}
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
          {d.tistory ? line('티스토리', d.tistory, ts) : null}
          {hard && <div className="text-red-500">키 미설정이면: Cloudflare → Workers &amp; Pages → <b>ur-ads</b> → Settings → Variables and Secrets 에 해당 키 추가.</div>}
        </div>
      )}
    </>
  )
}
