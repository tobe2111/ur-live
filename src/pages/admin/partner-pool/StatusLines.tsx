/**
 * 📊 파트너 풀 상태줄 묶음 — 수집 레인/정리 진행률/이메일 퍼널/소스별 진단(부모 600줄 캡 준수 추출).
 *   데이터는 부모의 /stats 응답 그대로 — 표시 전용(로직 무).
 */
import { formatNumber, kstShort } from '@/utils/format'

/** 크롤 실패 사유 라벨(contact-enrich CrawlReason SSOT 미러) — 적중률 저하의 원인 진단용. */
const CRAWL_REASON_LABEL: Record<string, string> = {
  ok: '성공', no_contact: '이메일 미게시', fetch_fail: '페이지 못가져옴', robots: 'robots 차단',
  dead_domain: '죽은 도메인', no_name: '상호 불일치', blocked_host: '제외 호스트', bad_url: '잘못된 주소', budget: '예산 소진',
  http_403: '봇차단(403)', http_404: '경로없음(404)', http_5xx: '서버오류(5xx)', network: '접속불가(DNS·TLS)',
  subreq_limit: '⛔ 플랫폼 요청한도', timeout: '⏱ 응답 시간초과(상대 서버)',
}

export interface RunInfo { last_run?: string; found?: number; saved?: number; enriched?: number; total_saved?: number; target?: string; diag?: { configured?: boolean; error?: string; kakao?: boolean; naver?: boolean; enrich_note?: string } }
export interface Collect { gate: boolean; adsBinding: boolean; run: RunInfo | null }
export interface StoreInfo { gate: boolean; run: RunInfo | null }
export interface Commerce { gate: boolean; run: (RunInfo & { diag?: { error?: string; sample?: unknown } }) | null; probe?: { keys?: string[]; hasEmail?: boolean; emailField?: string } }
export interface Franchise { gate: boolean; run: (RunInfo & { diag?: { error?: string } }) | null }
export interface NtsSweep { run: { last_run?: string; checked?: number; closed?: number; total_closed?: number; note?: string } | null }
export interface AgencyFunnel { total: number; with_email: number; site_no_email: number; site_tried?: number; no_site: number }
export interface NpsInfo { gate: boolean; run: { last_run?: string; checked?: number; matched?: number; total_matched?: number; diag?: { error?: string } } | null }
export interface ReclassifyInfo { run: { last_run?: string; scanned?: number; removed?: number; remaining_unclassified?: number; total_removed?: number; total_updated?: number } | null }
export interface EnrichInfo { last_run?: string; processed?: number; enriched?: number; crawls?: number; hit_rate?: number; remaining?: number; crawl_reason?: Record<string, number>; fail_samples?: string[]; fetches?: number; budget_total?: number; spent?: number; limit_hit?: boolean; learned_cap?: number; partial?: boolean; d1?: number; deadline_hit?: boolean; elapsed_ms?: number }
export interface EnrichRollupInfo { day: string; rounds: number; partial: number; deadline: number; limit: number; crash: number; processed: number; enriched: number; crawls: number; phase?: Record<string, number> }
export interface RegistryMatchInfo { last_run?: string; scanned?: number; matched?: number; total_matched?: number; skip_reason?: Record<string, number> }
export interface LocalDataInfo { gate: boolean; run: { last_run?: string; saved?: number; updated?: number; closed?: number; diag?: { configured?: boolean; error?: string } } | null }
export interface Work24Info { gate: boolean; run: { last_run?: string; keyword?: string; found?: number; matched?: number; saved?: number; total_saved?: number; diag?: { error?: string; sample?: unknown } } | null }

export default function StatusLines({ collect, storeinfo, commerce, franchise, nts, npsInfo, reclassifyInfo, agencyFunnel, work24, localdata, enrichLast, enrichRollup, registryMatch }: {
  collect: Collect | null; storeinfo: StoreInfo | null; commerce: Commerce | null; franchise: Franchise | null
  nts: NtsSweep | null; npsInfo: NpsInfo | null; reclassifyInfo: ReclassifyInfo | null; agencyFunnel: AgencyFunnel | null
  work24: Work24Info | null; localdata: LocalDataInfo | null; enrichLast: EnrichInfo | null; enrichRollup?: EnrichRollupInfo | null; registryMatch?: RegistryMatchInfo | null
}) {
  return (
    <>
    {/* 레인 A(네이버 지역검색) 자동수집 상태 */}
    {collect && (
      <div className="mb-3 text-xs text-gray-500">
        레인 A 자동수집 <span className={collect.gate ? 'text-green-600 font-semibold' : 'text-gray-400'}>{collect.gate ? 'ON · 홀수시' : 'OFF'}</span>
        {collect.run?.diag?.error ? <span className="text-amber-600"> · {collect.run.diag.error}</span>
          : collect.run?.last_run ? <span> · 최근 {kstShort(collect.run.last_run)} · 발굴 {collect.run.found ?? 0} / 저장 {collect.run.saved ?? 0}</span>
            : <span className="text-gray-400"> · 아직 실행 안 됨</span>}
        <span className="mx-2 text-gray-300">|</span>
        🏪 상가정보 <span className={storeinfo?.gate ? 'text-green-600 font-semibold' : 'text-gray-400'}>{storeinfo?.gate ? 'ON · 짝수시' : 'OFF'}</span>
        {storeinfo?.run?.diag?.error ? <span className="text-amber-600"> · {storeinfo.run.diag.error}</span>
          : storeinfo?.run?.last_run ? <span> · 최근 {kstShort(storeinfo.run.last_run)} · 저장 {storeinfo.run.saved ?? 0} / 연락처보강 {storeinfo.run.enriched ?? 0}</span>
            : <span className="text-gray-400"> · 아직 실행 안 됨</span>}
        {storeinfo?.run?.diag?.enrich_note && <span className="text-amber-600"> · ⚠️ {storeinfo.run.diag.enrich_note}</span>}
      </div>
    )}

    {/* 📧 대행사 이메일 퍼널 — 미보유를 원인별로 분해(보강 대기 vs 구조적 한계) */}
    {agencyFunnel && agencyFunnel.total > 0 && (
      <div className="mb-3 text-xs rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-gray-500">
        <span className="font-semibold text-gray-700">📧 대행사 이메일 퍼널</span>
        <span> · 전체 {formatNumber(agencyFunnel.total)}</span>
        <span> · <span className="text-indigo-600 font-semibold">이메일 보유 {formatNumber(agencyFunnel.with_email)}</span></span>
        <span title="자체 사이트는 찾았는데 게시된 이메일이 아직 없음. 괄호=크롤 시도 완료분(시도했는데 이메일이 없으면 구조적 한계 — 문의폼·카톡채널만 쓰는 업체)"> · 사이트만 {formatNumber(agencyFunnel.site_no_email)}
          <span className="text-gray-400">(시도 {formatNumber(agencyFunnel.site_tried ?? 0)} / 대기 {formatNumber(Math.max(0, (agencyFunnel.site_no_email || 0) - (agencyFunnel.site_tried || 0)))})</span></span>
        <span title="지도·웹 어디에도 자체 사이트가 안 잡힘 — 공개된 이메일이 존재하지 않아 전화·주소로 접촉(허위 0 원칙)"> · 사이트 미발견 {formatNumber(agencyFunnel.no_site)}</span>
      </div>
    )}

    {/* 🔗 원부 이메일 이식 — 크롤 0회 레인(전수조사: 이메일의 99.8%가 원부 직행분인데 타깃엔 미적용이었음) */}
    {registryMatch?.last_run && (
      <div className="mb-3 text-xs text-gray-500">
        🔗 원부 이메일 이식 <span className="text-gray-400">(크롤 0회)</span>
        <span> · 최근 {kstShort(registryMatch.last_run)} · 대조 {formatNumber(registryMatch.scanned ?? 0)} · <b className="text-indigo-600">이식 {formatNumber(registryMatch.matched ?? 0)}</b> (누적 {formatNumber(registryMatch.total_matched ?? 0)})</span>
        {registryMatch.skip_reason && Object.keys(registryMatch.skip_reason).length > 0 && (
          <span className="text-gray-400" title="확신이 없으면 비워둔다(허위 0) — 건너뛴 사유 분포"> · 보류 {Object.entries(registryMatch.skip_reason).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(' / ')}</span>
        )}
      </div>
    )}

    {/* 📧 이메일 보강 레인 — **가장 중요한 레인인데 화면에 없었음**(2026-07-28: 이메일이 왜 안 느는지
        판별 불가였던 원인). 처리/확보/크롤 적중률로 '시도량 부족' vs '추출력 부족'을 즉시 구분. */}
    <div className="mb-3 text-xs text-gray-500">
      📧 이메일 보강 레인
      {enrichLast?.partial && <span className="ml-1 text-amber-600 font-semibold" title="실행 도중 저장된 스냅샷 — 인보케이션이 끝나기 전 상태(중도 종료 시에도 계측이 남도록 25건마다 저장)">⏳ 진행 중/중단 스냅샷</span>}
      {enrichLast?.last_run
        ? <span> · 최근 {kstShort(enrichLast.last_run)} · 처리 {formatNumber(enrichLast.processed ?? 0)} · <b className="text-indigo-600">확보 {formatNumber(enrichLast.enriched ?? 0)}</b>
            {typeof enrichLast.crawls === 'number' && enrichLast.crawls > 0
              ? <span> · 크롤 {formatNumber(enrichLast.crawls)}(이메일 적중 <b className={(enrichLast.hit_rate ?? 0) >= 15 ? 'text-green-600' : 'text-amber-600'}>{enrichLast.hit_rate ?? 0}%</b>)</span>
              : <span className="text-amber-600"> · 크롤 0회 — 크롤까지 못 감(예산·대상 선정 확인 필요)</span>}
            {typeof enrichLast.remaining === 'number' ? <span className="text-gray-400"> · 보류 잔여 {formatNumber(enrichLast.remaining)}</span> : null}
            {/* 실사용 서브요청 — Workers 호출당 1,000 한도. 근접하면 이후 fetch 가 전부 즉시 throw(network) 로 보인다. */}
            {typeof enrichLast.fetches === 'number' ? <span className="text-gray-400"> · 서브요청 {formatNumber(enrichLast.fetches)}</span> : null}
            {/* 실패 사유 분포 — 적중률이 낮을 때 '사이트에 이메일이 없음(no_contact)' vs '페이지를 못 가져옴
                (fetch_fail)' vs 'robots 차단' 을 구분해 다음 개선을 데이터가 고르게(2026-07-28 적중 0% 진단). */}
            {enrichLast.crawl_reason && Object.keys(enrichLast.crawl_reason).length > 0 && (
              <span className="text-gray-400"> · 사유 {Object.entries(enrichLast.crawl_reason).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${CRAWL_REASON_LABEL[k] || k} ${v}`).join(' / ')}</span>
            )}
          </span>
        : <span className="text-amber-600"> · 아직 실행 기록 없음 — 매시간 자동이 안 돌고 있을 수 있음</span>}
      {/* 🩹 예산 실측 — "왜 조금밖에 못 돌았나"의 답. 한도에 부딪히면 그 뒤 fetch 는 전부 죽으므로
          라운드를 중단하고 상한을 낮춰 학습한다(다음 실행부터 그 아래만 사용). */}
      {typeof enrichLast?.spent === 'number' && (
        <div className="mt-1 text-[11px] text-gray-400">
          예산 {formatNumber(enrichLast.spent)}/{formatNumber(enrichLast.budget_total ?? 0)} 사용
          {/* 🧮 내역 분해(2026-07-28) — D1 도 서브리퀘스트라 예산에서 함께 지불한다. 이 둘을 안 나누면
              '예산 사용'과 '외부요청' 숫자가 어긋나 보여 읽는 사람이 오해한다. 어느 쪽이 예산을 먹는지가
              곧 처방(크롤 축소 vs 대상 수 축소)을 가르므로 화면에 드러낸다. */}
          {typeof enrichLast.d1 === 'number' && (
            <span> (외부요청 {formatNumber(enrichLast.fetches ?? 0)} + DB쓰기 <b className={enrichLast.d1 > (enrichLast.fetches ?? 0) ? 'text-amber-600' : ''}>{formatNumber(enrichLast.d1)}</b>)</span>
          )}
          {enrichLast.limit_hit
            ? <span className="text-amber-600 font-semibold"> · ⛔ 플랫폼 요청한도 도달 → 이번 라운드 중단(실패 도장 미기록) · 다음 실행 상한 {formatNumber(enrichLast.learned_cap ?? 0)}</span>
            : <span> · 한도 여유</span>}
          {/* ⏱️ 벽시계 상한 도달 — 예산이 남아도 시간이 라운드를 끝냈다는 뜻(처방이 다르다: 캡 조정이 아니라
              동시성·타임아웃). ADS_ENRICH_DEADLINE_MS 로 무배포 조정 가능. */}
          {enrichLast.deadline_hit && (
            <span className="text-amber-600 font-semibold"> · ⏱ 시간 상한 도달 → 정상 종료(남은 백로그는 다음 라운드)</span>
          )}
          {typeof enrichLast.elapsed_ms === 'number' && (
            <span> · 소요 {(enrichLast.elapsed_ms / 1000).toFixed(1)}s</span>
          )}
        </div>
      )}
      {/* 실패 URL 샘플 — 호스트 형태/상태코드로 '왜 못 가져왔나'를 눈으로 특정 */}
      {enrichLast?.fail_samples?.length ? (
        <div className="mt-1 text-[11px] text-gray-400 break-all">실패 샘플: {enrichLast.fail_samples.join(' · ')}</div>
      ) : null}
      {/* 🧮 오늘 누적(2026-07-29) — 위 스냅샷은 **라운드마다 덮인다**. 그래서 '⏳ 중단' 한 장으로는
          ⓐ 모든 라운드가 초반에 죽는다 ⓑ 마지막 라운드만 부모 크론 종료에 잘렸다 를 **구분할 수 없었다**
          (처방이 정반대인데). rounds 대비 중단 비율 + 끝난 단계 분포가 그 판정을 대신한다. */}
      {enrichRollup && enrichRollup.rounds > 0 && (
        <div className="mt-1 text-[11px] text-gray-400">
          오늘({enrichRollup.day}) 누적 · 라운드 {formatNumber(enrichRollup.rounds)}회
          {' · '}<span className={enrichRollup.partial >= enrichRollup.rounds ? 'text-amber-600 font-semibold' : ''}>중단 {formatNumber(enrichRollup.partial)}</span>
          {enrichRollup.deadline > 0 && <span> · 시간상한 {formatNumber(enrichRollup.deadline)}</span>}
          {enrichRollup.limit > 0 && <span> · 요청한도 {formatNumber(enrichRollup.limit)}</span>}
          {enrichRollup.crash > 0 && <span className="text-red-500 font-semibold"> · 예외 {formatNumber(enrichRollup.crash)}</span>}
          {' · '}처리 {formatNumber(enrichRollup.processed)} · <b className="text-indigo-600">확보 {formatNumber(enrichRollup.enriched)}</b>
          {' · '}크롤 {formatNumber(enrichRollup.crawls)}
          {Object.keys(enrichRollup.phase || {}).length > 0 && (
            <span title="라운드가 어디서 끝났는지 — p2 에 몰리면 이메일 단계에서 매번 죽는다는 뜻">
              {' · '}종료단계 {Object.entries(enrichRollup.phase || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' / ')}
            </span>
          )}
        </div>
      )}
    </div>

    {/* 🛒 통신판매 수집 진단 — 원본 응답 필드 + 이메일 필드 유무(추측 대신 실제 확인) */}
    {commerce?.run && (
      <div className="mb-3 text-xs rounded-lg border border-gray-200 bg-gray-50 p-2.5">
        <span className="font-semibold text-gray-700">🛒 통신판매</span>
        {commerce.run.diag?.error ? <span className="text-amber-600"> · {commerce.run.diag.error}</span>
          : <span className="text-gray-500"> · 최근 {kstShort(commerce.run.last_run)} · 발굴 {commerce.run.found ?? 0} / 저장 {commerce.run.saved ?? 0}</span>}
        {commerce.probe && (
          <span> · <span className={commerce.probe.hasEmail ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>이메일 필드 {commerce.probe.hasEmail ? `있음 ✅${commerce.probe.emailField ? ` (${commerce.probe.emailField}, 선택입력이라 일부만 채워짐)` : ''}` : '없음 ❌'}</span></span>
        )}
        {commerce.probe?.keys?.length ? (
          <div className="mt-1 text-[11px] text-gray-400 break-all">원본 필드: {commerce.probe.keys.join(', ')}</div>
        ) : null}
      </div>
    )}

    {/* 🏢 공정위 가맹(프랜차이즈) 수집 상태 */}
    {franchise?.run && (
      <div className="mb-3 text-xs text-gray-500">
        🏢 프랜차이즈 <span className={franchise.gate ? 'text-green-600 font-semibold' : 'text-gray-400'}>{franchise.gate ? 'ON · 22시' : 'OFF'}</span>
        {franchise.run.diag?.error ? <span className="text-amber-600"> · {franchise.run.diag.error}</span>
          : <span> · 최근 {kstShort(franchise.run.last_run)} · 발굴 {franchise.run.found ?? 0} / 저장 {franchise.run.saved ?? 0}</span>}
        <span className="text-gray-400"> · 연락처는 보강(홈페이지 검색)으로 채워짐</span>
      </div>
    )}

    {/* 🏛️ 국세청 폐업 스윕 상태 — note 에 활용신청/키 오류가 그대로 표시됨(검증용) */}
    {nts?.run && (
      <div className="mb-3 text-xs text-gray-500">
        🏛 폐업 정리 <span> · 최근 {kstShort(nts.run.last_run)} · 조회 {nts.run.checked ?? 0} / 폐업처리 {nts.run.closed ?? 0} (누적 {nts.run.total_closed ?? 0})</span>
        {nts.run.note && <span className="text-amber-600"> · ⚠️ {nts.run.note}</span>}
      </div>
    )}

    {/* 🧭 소급 정리(재분류) 진행률 — 62K 청소 며칠 걸림, 남은 미분류가 0 에 수렴하는지 관찰 */}
    {reclassifyInfo?.run && (
      <div className="mb-3 text-xs text-gray-500">
        🧭 데이터 정리 <span> · 최근 {kstShort(reclassifyInfo.run.last_run)} · 이번 {reclassifyInfo.run.scanned ?? 0}건(제거 {reclassifyInfo.run.removed ?? 0})</span>
        <span> · <b className="text-gray-700">미분류 잔여 {formatNumber(reclassifyInfo.run.remaining_unclassified ?? 0)}</b></span>
        <span className="text-gray-400"> · 누적 정리 {formatNumber(reclassifyInfo.run.total_removed ?? 0)} 제거 / {formatNumber(reclassifyInfo.run.total_updated ?? 0)} 재분류</span>
      </div>
    )}

    {/* 👥 국민연금 규모 검증 상태 */}
    {npsInfo?.run && (
      <div className="mb-3 text-xs text-gray-500">
        👥 규모 조회(국민연금) <span className={npsInfo.gate ? 'text-green-600 font-semibold' : 'text-gray-400'}>{npsInfo.gate ? 'ON · 01시' : 'OFF'}</span>
        <span> · 최근 {kstShort(npsInfo.run.last_run)} · 조회 {npsInfo.run.checked ?? 0} / 매칭 {npsInfo.run.matched ?? 0} (누적 {npsInfo.run.total_matched ?? 0})</span>
        {npsInfo.run.diag?.error && <span className="text-amber-600"> · ⚠️ {npsInfo.run.diag.error}</span>}
      </div>
    )}
      {/* 🏪 매장 후보(인허가) — 소비자 공개면(/new-openings·상권 리포트)·개업 웰컴 큐의 유일한 데이터원.
          2026-07-28 실측: 이 라인이 없어 "0건"인 걸 아무도 몰랐음(전체 실행 목록에서도 누락돼 있었음). */}
      <div className="mb-3 text-xs text-gray-500">
        🏪 매장 후보(인허가) <span className={localdata?.gate ? 'text-green-600 font-semibold' : 'text-gray-400'}>{localdata?.gate ? 'ON · 05시' : 'OFF'}</span>
        {localdata?.run?.last_run
          ? <span> · 최근 {kstShort(localdata.run.last_run)} · 저장 {localdata.run.saved ?? 0} / 갱신 {localdata.run.updated ?? 0}{typeof localdata.run.closed === 'number' ? ` / 폐업 ${localdata.run.closed}` : ''}</span>
          : <span className="text-amber-600"> · 아직 실행 안 됨 — 개업/상권 리포트 공개면이 빈 상태(전체 실행 1회로 채워짐)</span>}
        {localdata?.run?.diag?.error && <span className="text-amber-600"> · ⚠️ {localdata.run.diag.error}</span>}
      </div>
      {/* 💼 고용24 채용기업 수집 상태 — 첫 실행 diag 로 실응답 검증 */}
      {work24?.run && (
        <div className="mb-3 text-xs text-gray-500">
          💼 채용기업(고용24) <span className={work24.gate ? 'text-green-600 font-semibold' : 'text-gray-400'}>{work24.gate ? 'ON · 00시' : 'OFF'}</span>
          <span> · 최근 {kstShort(work24.run.last_run)} · '{work24.run.keyword}' 발굴 {work24.run.found ?? 0} / 적합 {work24.run.matched ?? 0} / 저장 {work24.run.saved ?? 0} (누적 {work24.run.total_saved ?? 0})</span>
          {work24.run.diag?.error && <span className="text-amber-600"> · ⚠️ {work24.run.diag.error}</span>}
          {/* 발굴 0 진단 — 응답 원문 앞부분(엔드포인트/파라미터/인증 오류가 그대로 보임) */}
          {(work24.run.found ?? 0) === 0 && work24.run.diag?.sample != null && (
            <span className="text-amber-600"> · 응답: {String(typeof work24.run.diag.sample === 'string' ? work24.run.diag.sample : JSON.stringify(work24.run.diag.sample)).slice(0, 200)}</span>
          )}
        </div>
      )}
    </>
  )
}
