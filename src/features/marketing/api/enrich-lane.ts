/**
 * 📇 연락처 보강 레인 — 파트너풀 Phase 1/2/3 폭포수 (2026-07-28 모듈 분리).
 *
 *   왜 별 모듈인가: `company-collect.ts` 는 원래 **수집**(네이버/카카오 발굴) 모듈인데 성격이 다른
 *   **보강**(기존 리드에 연락처 채우기) 레인이 같이 살면서 600줄 한도를 넘겼다. 두 레인은 예산·학습
 *   상한·계측 키가 전부 따로라(`company_enrich` vs `kakao_sweep`) 코드도 나뉘는 것이 맞다.
 *   ⚠️ 이 파일은 company-collect 의 심볼에 의존하지 않는다(단방향) — 순환 import 금지.
 *
 *   호출부 호환: `company-collect.ts` 가 `enrichHeldLeads` 를 그대로 re-export 하므로 기존 import 경로 유지.
 */
import type { Env } from '@/worker/types/env'
import { type FetchBudget } from './influencer-discovery'
import { subreqCapKey, resolveSubreqBudget, nextSubreqCap, isSubrequestLimitError, platformSubreqCap } from './collect-budget'
import { writeEnrichSnapshot, recordEnrichCrash, foldEnrichRollup, ENRICH_SNAPSHOT_KEY, ENRICH_ROLLUP_KEY } from './enrich-telemetry'
import { healSuspectNames } from './enrich-name-heal'
import { ensureCompanySchema } from './company-discovery'

// 서브리퀘스트 예산 헬퍼(influencer-discovery 내부와 동일 — 그쪽은 미export 라 인라인).
const outOfBudget = (b?: FetchBudget) => !!b && (b.left <= 0 || (!!b.deadline && Date.now() >= b.deadline))

/** 📇 연락처 보강 폭포수 — 보류(active=0) 리드에 [카카오 로컬 전화 → 홈페이지 이메일/전화] 순차 시도.
 *   카카오 로컬 API 는 상호+주소로 **전화를 준다**(네이버는 빈값) → 홈페이지 없는 보류도 전화 확보 가능.
 *   전부 업체 공개 데이터만, 출처(contact_source) 기록. 못 찾으면 비워둠(허위 0). tier1 우선. */
export async function enrichHeldLeads(env: Env): Promise<{ processed: number; enriched: number; remaining: number }> {
  // 💥 예외를 증거로 남기고 rethrow — 기록 책임은 enrich-telemetry 가 전담(왜 필요한지는 그 파일 상단 참조).
  try { return await enrichHeldLeadsInner(env) }
  catch (err) { await recordEnrichCrash(env.DB, err); throw err }
}

async function enrichHeldLeadsInner(env: Env): Promise<{ processed: number; enriched: number; remaining: number }> {
  const DB = env.DB
  // 🧾 스키마 DDL 35개 실비를 예산에서 뺀다(2026-07-29) — 안 빼면 콜드 격리에서 우리 계수 60 vs
  //   플랫폼 계수 95 로 갈라져 라운드가 잡을 예외 없이 죽는다(partial:true 조기 사망의 유력한 실체).
  const schemaSpent = await ensureCompanySchema(DB)
  const { kakaoLocalLookup, naverLocalLookup, naverHomepageSearch, crawlContact, CRAWL_RULES_VERSION, realSite } = await import('./contact-enrich')
  const kakaoKey = env.KAKAO_REST_API_KEY || ''
  const nvId = env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID || ''
  const nvSecret = env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET || ''
  // 카카오 조회는 1건당 서브요청 1개(저렴) → 한 번에 많이. 크롤은 3~4개(비쌈) → 잔여 예산에서만.
  //   보강 전용 예산(ADS_ENRICH_BUDGET, 기본 100) — 수집 예산과 분리해 백로그를 시간당 대량 소진(대표 "보류없이 다 진행").
  // 기본 300(대표 "쿼터 최대한" — 네이버 무료 25K/day 대비 한참 여유), env 상한 800.
  //   ⚠️ 이 800 은 "Workers 1,000 한도의 안전마진"이라는 **틀린 전제**로 잡혀 있었다(아래 근본수리 참조).
  // 🩹 2026-07-28 근본수리: env 예산은 **우리가 세는 숫자일 뿐 실제 플랫폼 한도가 아니다**. 실측(크롤 59건 중
  //   HTML 수신 0건 = no_contact 0 · 네트워크가 필요 없는 blocked_host 만 정상)이 가리킨 것은 사이트별 봇차단이
  //   아니라 **한도 초과 후 전 fetch throw**. 인플루언서 레인이 이미 쓰던 관측 학습 상한(collect-budget)을
  //   이 레인에도 적용 — 부딪히면 다음 실행부터 그 아래만 쓰고, 무사히 다 쓰면 조금씩 회복한다.
  const envBudget = Math.min(800, Math.max(20, parseInt(env.ADS_ENRICH_BUDGET || env.ADS_COMPANY_SUBREQUEST_BUDGET || '', 10) || 300))
  // 🧮 부팅 조회 1회로 3개 값을 함께 읽는다(학습 상한 + 직전 스냅샷 + 누적) — 쿼리 수는 그대로 1.
  //   직전 스냅샷을 여기서 읽는 이유: **중도 사망한 라운드는 스스로를 누적할 수 없다**(종료 코드 미도달).
  //   그 라운드가 남긴 마지막 부분 스냅샷을 다음 라운드가 접어야 죽은 라운드까지 세어진다.
  const boot = (await DB.prepare('SELECT key, value FROM platform_settings WHERE key IN (?, ?, ?)')
    .bind(subreqCapKey('company_enrich'), ENRICH_SNAPSHOT_KEY, ENRICH_ROLLUP_KEY)
    .all<{ key: string; value: string }>().catch(() => null))?.results || []
  const bootVal = (k: string) => boot.find(r => r.key === k)?.value || null
  const learnedCap = Math.max(0, parseInt(bootVal(subreqCapKey('company_enrich')) || '', 10) || 0)
  // 🧱 플랫폼 천장 — 학습 상한이 이 값을 넘지 못한다(기본 60, 근거·조정법은 collect-budget 주석).
  const pcap = platformSubreqCap(env.ADS_SUBREQ_PLATFORM_CAP)
  const budgetTotal = resolveSubreqBudget(envBudget, learnedCap, pcap)
  // ⏱️ 벽시계 가드(2026-07-28) — 서브리퀘스트가 남아도 **시간**이 인보케이션을 끝낼 수 있다(느린 사이트 1곳이
  //   8s 타임아웃을 여러 번 먹는 경우). 20s 이후엔 새 fetch 를 시작하지 않고 Phase 3 → 정상 종료로 빠진다:
  //   죽는 대신 깨끗이 넘기면 스냅샷·학습·도장이 전부 정상 작동하고 남은 백로그는 다음 라운드가 이어받는다.
  //   ⏱️ 상한은 env 로 조정 가능(ADS_ENRICH_DEADLINE_MS) — 이 20s 는 **추정치**다. 가드가 너무 일찍 끊으면
  //   (스냅샷 deadline_hit:true 인데 예산이 많이 남음) 올리고, 라운드가 여전히 무증거로 죽으면 내린다. 무배포 재조정.
  const deadlineMs = Math.min(120_000, Math.max(5_000, parseInt(env.ADS_ENRICH_DEADLINE_MS || '', 10) || 20_000))
  const budget: FetchBudget = { left: budgetTotal, deadline: Date.now() + deadlineMs }
  const budgetStart = budget.left // 실사용 서브요청 계측 — 한도 근접 여부를 숫자로 판정(상태줄 '서브요청')
  // 🧮 D1 도 서브리퀘스트다(2026-07-28 근본수리) — 이 레인은 대상 1건당 도장 1회 + 저장 최대 2회 + 주기 스냅샷을
  //   쓰는데, 예산은 **fetch 만** 세고 있었다. 그 결과 한도에 부딪히면 `nextSubreqCap` 이 진짜 원인(D1 트래픽)을
  //   못 보고 fetch 수만으로 상한을 깎아 내렸고, `targetCap` 하한 120 탓에 D1 부하는 그대로여서 **상한을 아무리
  //   낮춰도 압력이 안 줄어드는** 구조였다(학습값이 25~55 대역에서 수렴 못 하고 맴돌던 정체 — 레인별 키 분리
  //   이후에도 남아 있던 잔여 원인). ⇒ D1 도 같은 지갑에서 지불해 분모를 진실로 만든다.
  let d1 = 0
  const spendD1 = (n = 1) => { budget.left -= n; d1 += n }
  budget.left -= schemaSpent // 스키마 DDL 실비(위 주석)
  spendD1(2) // 위 boot SELECT + 아래 targets SELECT(예산 생성 전 실행분 소급 계상)
  // 직전 라운드 접기 — 접을 것이 없으면(같은 run_id·구형 스냅샷) 쓰지 않으므로 비용 0.
  if (await foldEnrichRollup(DB, ENRICH_ROLLUP_KEY, bootVal(ENRICH_SNAPSHOT_KEY), bootVal(ENRICH_ROLLUP_KEY))) spendD1()
  // 🆔 라운드 식별자 — 누적이 같은 라운드를 두 번 세지 않게 하는 유일한 수단(멱등 키).
  const runId = (globalThis.crypto?.randomUUID?.() || `t${Date.now()}`).slice(0, 8)
  // 대상 = 보류(연락처 없음) + 이메일 없는 기존 리드(전화만 있어도 이메일 소급).
  //   정렬 = **홈페이지 보유 우선**(크롤 즉시 가능 = 이메일 수율 최고 — 대표 "이메일이 전화보다 중요") → 보류 → tier1.
  //   🔁 재시도 쿨다운(2026-07-27 최종 점검): enrich_checked_at 없던 시절엔 같은 상위 200행을 매시간
  //   재크롤(실패해도 email NULL 이라 또 선두) → 예산이 앞줄에서 공회전하고 **뒷줄(대행사 포함)은 영영 미도달**.
  //   → 시도 즉시 스탬프 + 7일 쿨다운 → 예산이 백로그 전체를 흐르며 순회(이메일 보유 대행사 13개의 한 원인).
  // 🚰 대상 상한 = 예산 비례(2026-07-27 대표 "언제 완전해지나" — 예산 800 인데 상한 200 고정이라 병목).
  //   실소비는 루프의 budget break 가 통제 — 상한은 "예산이 허락하면 몇 행까지 볼 수 있나"만 정함.
  const targetCap = Math.min(400, Math.max(120, Math.floor(budget.left / 2)))
  const targets = (await DB.prepare(`SELECT id, company_name, category, region, address, website, phone, email, source, source_keyword, status FROM ad_company_leads
      WHERE (active = 0 OR email IS NULL OR email = '')
        AND merged_into IS NULL
        AND (enrich_checked_at IS NULL OR enrich_checked_at < datetime('now', '-7 days') OR COALESCE(enrich_v, 0) < ${CRAWL_RULES_VERSION})
      ORDER BY (CASE WHEN website IS NOT NULL AND website != '' THEN 0 ELSE 1 END), (CASE WHEN tier = 1 THEN 0 ELSE 1 END), active ASC, id DESC LIMIT ${targetCap}`)
    .all<{ id: number; company_name: string; category: string | null; region: string | null; address: string | null; website: string | null; phone: string | null; email: string | null; source: string; source_keyword: string | null; status: string }>().catch(() => null))?.results || []
  // 시도 도장 — 크롤러 버전도 함께 기록(버전 bump = 이전 실패분 전량 즉시 재시도 대상).
  //   ⚠️ 2026-07-28: D1 쿼리도 **서브리퀘스트를 소모**한다. 도장은 대상 1건당 1회라 라운드당 수백 건이 되는데,
  //   한도 초과 시 `.catch(() => null)` 가 그 오류를 삼켜 **budget.limitHit 이 영영 false** 로 남았다
  //   (스냅샷이 limit_hit:false 인데도 학습 상한은 계속 내려가던 모순의 정체). 여기서 신호를 살린다.
  //   🧺 2026-07-28 배치화: 무료 플랜은 **인보케이션당 서브리퀘스트 50**(D1 포함)이라 도장 1건이 라운드의 2% 다.
  //   건건이 쓰면 대상 10건에 도장만 10 = 예산 20% 를 크롤이 아닌 부기(簿記)에 쓴다. 모아서 한 번에 쓰면 1 이다.
  //   ⚠️ 지연 flush 의 실패 모드는 **안전한 쪽**이다 — 라운드가 flush 전에 죽으면 도장이 안 남아 그 리드를 다음
  //   라운드가 다시 집는다(= 원하는 동작). 반대(안 해보고 도장)가 백로그를 막던 실제 사고였다.
  const pendingStamps: number[] = []
  const stamp = async (id: number) => { pendingStamps.push(id) } // 즉시 쓰지 않고 모은다(flushStamps 가 1회로 반영)
  const flushStamps = async () => {
    if (!pendingStamps.length) return
    const ids = pendingStamps.splice(0).join(',') // 숫자 id 만 — 문자열 보간 안전(바인딩 개수 가변 회피)
    spendD1()
    try {
      await DB.prepare(`UPDATE ad_company_leads SET enrich_checked_at = datetime('now'), enrich_v = ${CRAWL_RULES_VERSION} WHERE id IN (${ids})`).run()
    } catch (err) {
      if (isSubrequestLimitError((err as { message?: string } | null)?.message)) budget.limitHit = true
    }
  }
  let enriched = 0, processed = 0
  const crawlReason: Record<string, number> = {} // 크롤 결과 사유 집계(ok/no_contact/http_403/network…) — 적중률 계측
  const failSamples: string[] = []                // 실패 URL 샘플 — 원인 특정용(호스트 형태·상태코드)
  // 카카오 place_url(지도페이지)은 홈페이지가 아니라 크롤 대상 아님 — 실제 홈페이지만 크롤.
  // 🩹 2026-07-28 실측 수리: 크롤 133건 중 `blocked_host` 가 **59건(44%)** — 저장된 website 가 블로그·SNS 같은
  //   **제3자 도메인**이라 크롤이 무조건 거부되는데도 대상 슬롯을 먹고 7일 쿨다운 도장까지 받아 왔다.
  //   → 여기서 미리 걸러 `site=null` 로 만들면 아래 네이버 지역검색/웹문서 **발견 경로로 넘어가** 진짜 홈페이지를
  //   찾을 기회를 얻는다(슬롯 회수 + 수율 상승). website 컬럼 자체는 보존 — 사람이 수동 접촉할 땐 유용하다.
  // realSite 는 contact-enrich SSOT (수집 레인과 같은 판정을 쓰기 위해 2026-07-28 승격).
  // 통합 저장 — 전화/이메일 생기면 active=1 승격(기존값 보존 COALESCE). 허위 0(값 있을 때만 호출).
  const save = async (id: number, phone: string | null, email: string | null, website: string | null, source: string) => {
    if (!phone && !email && !website) return
    // 📵 반송 억제 — 반송 확인된 이메일은 재크롤로 되살리지 않음(수동 발송 체계의 품질 루프).
    if (email) {
      spendD1()
      const sup = await DB.prepare('SELECT 1 AS x FROM ad_email_suppress WHERE email = ?').bind(email.toLowerCase()).first<{ x: number }>().catch(() => null)
      if (sup) email = null
      if (!phone && !email && !website) return
    }
    spendD1()
    const r = await DB.prepare(
      `UPDATE ad_company_leads SET phone = COALESCE(phone, ?), email = COALESCE(email, ?), website = COALESCE(website, ?),
         contact_source = COALESCE(contact_source, ?),
         active = CASE WHEN COALESCE(phone, ?) IS NOT NULL OR COALESCE(email, ?) IS NOT NULL THEN 1 ELSE active END
       WHERE id = ?`
    ).bind(phone, email, website, source || null, phone, email, id).run().catch(() => null)
    if (((r as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0) > 0 && (phone || email)) enriched++
  }

  // 📝 진행 스냅샷 저장(2026-07-28 계측 공백 수리) — 결과를 **맨 끝에서 한 번만** 쓰면, 인보케이션이
  //   중도 종료(CPU/wall/서브리퀘스트 한도)될 때 그 실행은 **영원히 계측되지 않는다**. 실측에서 실제로
  //   이메일은 붙었는데 `ads_enrich_last` 가 갱신되지 않는 상태가 관측됐다(원인 규명이 늦어진 한 원인).
  //   → 한도 감지 즉시 + 주기적으로 부분 저장하고, 정상 종료 때 최종본으로 덮는다. `partial` 로 구분.
  //   비용: 저장 1회 = D1 1쿼리. Phase 2 첫 3바퀴 + 이후 10건마다이므로 예산 대비 무시 가능.
  let capForStamp = learnedCap // 최종 저장 직전에 새 학습값으로 갱신 — 상태줄의 '다음 실행 상한'
  // 📍 어디까지 갔나 — `partial:true` 만으로는 "Phase 1 직후 죽었다"와 "Phase 2 중 죽었다"를 구분할 수 없어
  //   2026-07-28 원인 규명이 정적 추론에서 막혔다. 단계 표식 + Phase 2 스킵 사유 계수를 남긴다(비용: 문자열 1개).
  let phase = 'start'; let at = ''; const t0 = Date.now() // at=마지막으로 손댄 지점 · t0=경과(무증거 종료가 시간 한도인지 판별)
  const p2: Record<string, number> = {} // examined/skip_email/no_site/naver_try/crawl_try/stamped
  const bump = (k: string) => { p2[k] = (p2[k] || 0) + 1 }
  const snapshot = async (partial: boolean, remaining?: number) => {
    const crawls = Object.values(crawlReason).reduce((a, n) => a + n, 0)
    // 적중률 분모는 **실제로 fetch 를 시도한 크롤**만 — blocked_host/bad_url 은 네트워크에 안 나간다.
    const attempted = crawls - (crawlReason.blocked_host || 0) - (crawlReason.bad_url || 0)
    spendD1() // 이 스냅샷 쓰기 자신도 서브리퀘스트다 — 계상해야 분모가 진실이다
    await writeEnrichSnapshot(DB, {
      processed, enriched, crawls, hit_rate: attempted > 0 ? Math.round(((crawlReason.ok || 0) / attempted) * 100) : 0,
      ...(typeof remaining === 'number' ? { remaining } : {}),
      crawl_reason: crawlReason, fail_samples: failSamples,
      // fetches=순수 외부 fetch · d1=DB 쿼리 · spent=둘의 합(학습 상한이 보는 진짜 소비량)
      fetches: budgetStart - budget.left - d1, d1, budget_total: budgetTotal, spent: budgetTotal - budget.left,
      platform_cap: pcap, // 🧱 이 라운드가 절대 넘을 수 없는 천장(학습 상한과 별개) — 보는 사람이 다시 유추하지 않게
      limit_hit: !!budget.limitHit, learned_cap: capForStamp, partial,
      run_id: runId, // 누적(ads_enrich_rollup)의 멱등 키 — 다음 라운드가 이 스냅샷을 접을 때 쓴다
      phase, p2, at, elapsed_ms: Date.now() - t0, deadline_hit: outOfBudget(budget) && budget.left > 0, targets: targets.length,
      diag: { kakao: !!kakaoKey, naver: !!(nvId && nvSecret) },
    })
  }

  // ── Phase 1: 카카오 전화(1건 1요청, 저렴·광범위) — 전화 없는 리드만. place_url 무시 ──
  //   ⚠️ 예산 분할: Phase1 이 전체 예산을 독식하면 Phase2(이메일 — 대표 최우선)가 0건 처리되므로
  //     전화 조회는 예산의 절반까지만. ⚠️ 주소 없는 리드(프랜차이즈 본사 등)는 카카오 스킵 —
  //     상호만으로는 동명 지점/타업체 전화 오귀속 위험(허위 방지). 그런 리드는 홈페이지 크롤이 담당.
  // 전화는 예산 1/6 로 축소(2026-07-27 대표 "전화보단 이메일 우선" 재확인) — 전화 백필은 카카오 전용
  //   스윕 레인(runKakaoPhoneSweep, 시간당 600건)이 전담하게 되어 여기선 이메일(크롤/발견)에 5/6 집중.
  // 🚫 2026-07-28 — 예산이 빠듯하면 Phase 1 을 **아예 건너뛴다**. 전화는 같은 크론에서 도는 전용 스윕
  //   (`sweep-kakao-phone`, 시간당 600건)이 이미 전담하므로 여기서의 전화 조회는 **중복**이다. 무료 플랜의
  //   인보케이션당 50 서브리퀘스트에서 1/6(≈8)을 중복 작업에 쓰면 크롤 2사이트를 통째로 잃는다
  //   (이 레인의 존재 이유는 이메일이다). 예산이 넉넉할 때만 보조로 수행.
  // 🩹 2026-07-28 라이브 실측 수리 — **예산이 커지자 이 게이트가 거꾸로 작동했다.**
  //   학습 상한이 회복해 `budget.left` 가 267 이 되자 위 조건이 열려 `left/6 = 44` 건의 전화 조회를 했고,
  //   그 사이 **벽시계 20s 가 소진돼 Phase 2(이메일)는 단 1건**만 봤다. 실측 스냅샷:
  //     `processed:1 · fetches:48 · spent:57/269 · deadline_hit:true · elapsed 21.3s`
  //   즉 **진짜 병목은 서브리퀘스트가 아니라 시간**인데, 비율 게이트는 예산만 보고 시간을 안 봤다.
  //   전화는 같은 크론의 전용 스윕(`runKakaoPhoneSweep`, 2026-07-28 부터 tier 우선순위)이 전담한다 —
  //   여기서의 전화 조회는 **중복**이고, 그 중복이 이 레인의 존재 이유(이메일)를 굶겼다.
  //   ⇒ 기본 0. 되살리려면 `ADS_ENRICH_PHONE_CAP` 에 **절대 건수**를 준다(비율 금지 — 그게 이 사고의 원인).
  const phoneCap = Math.max(0, Math.min(20, parseInt((env as unknown as { ADS_ENRICH_PHONE_CAP?: string }).ADS_ENRICH_PHONE_CAP || '', 10) || 0))
  let phoneSpent = 0
  for (const t of targets) {
    if (outOfBudget(budget) || budget.limitHit || phoneSpent >= phoneCap) break
    if (t.phone || !kakaoKey || !t.address) continue
    phoneSpent++
    const k = await kakaoLocalLookup(kakaoKey, t.company_name, t.region, t.address, budget)
    if (k.phone) { await save(t.id, k.phone, null, null, 'kakao'); t.phone = k.phone }
  }
  phase = 'p1_done'
  // Phase 1 이 아무것도 안 했으면 스냅샷도 생략 — 빠듯한 예산에서 부기 1회가 크롤 기회 하나다.
  if (phoneSpent > 0) await snapshot(true) // 여기서 죽어도 전화 확보분은 계측에 남는다
  phase = 'p2'
  // ── Phase 2: 이메일(비쌈, 좁게) — 실홈페이지 크롤 / 없으면 네이버로 홈페이지 발견 후 크롤 ──
  //   홈페이지 없는 보류 리드(상가정보 B2B 사무실 등)를 네이버 link/웹검색 발견으로 구제 → 이메일/전화 확보.
  let sinceSnapshot = 0
  for (const t of targets) {
    if (budget.left <= 2 || budget.limitHit || outOfBudget(budget)) break // 예산·한도·시간 중 하나라도 소진
    // 📊 `처리` = **이메일을 위해 실제로 들여다본 리드 수**(2026-07-28 정정). 예전엔 Phase 1 의 순회 횟수를
    //   세어, 전화가 이미 있는 리드를 건너뛰어도 숫자가 올라가 실제 작업량과 무관했다(전화 스킵 시 0 이 되는 문제도 함께 해소).
    processed++
    bump('examined'); at = `#${p2.examined} ${(t.company_name || '').slice(0, 24)}`
    if (t.email) { bump('skip_email'); continue } // 이미 이메일 있음
    let site = realSite(t.website)
    if (!site) bump('no_site')
    let discovered = false // 검색으로 발견한 사이트(등록 링크 아님) → 상호 존재 가드 필요
    if (!site && nvId && nvSecret && budget.left > 3) {
      bump('naver_try'); at = `nv:${(t.company_name || '').slice(0, 24)}`
      const nv = await naverLocalLookup(nvId, nvSecret, t.company_name, t.region, t.address || '', budget)
      if (nv.website) site = nv.website // 지역검색 등록 링크(업체가 등록) — 신뢰
      if (!t.phone && nv.phone && t.address) { await save(t.id, nv.phone, null, nv.website, 'naver'); t.phone = nv.phone }
      // 지역검색에 홈페이지 없으면 웹문서 검색으로 발견(크롤 관문 확장 → 이메일↑). 제3자 도메인 제외 + 상호가드.
      if (!site && budget.left > 3) { site = await naverHomepageSearch(nvId, nvSecret, t.company_name, t.region, budget); discovered = !!site }
    }
    if (site && budget.left > 2) {
      bump('crawl_try'); at = `cr:${site.slice(0, 60)}`
      const c = await crawlContact(site, budget, discovered ? t.company_name : undefined, t.category === '미디어')
      crawlReason[c.reason] = (crawlReason[c.reason] || 0) + 1 // 적중률 계측(사이트 방문 대비 결과 사유)
      // 실패 URL 샘플(최대 4) — '왜 못 가져왔나'를 실제 주소로 특정(2026-07-28 fetch 실패 45/45 진단).
      if (c.reason !== 'ok' && c.failUrl && failSamples.length < 4) failSamples.push(`${c.failUrl} (${c.reason}${c.failErr ? ` | ${c.failErr}` : ''})`)
      if (c.email || (c.phone && !t.phone)) await save(t.id, t.phone ? null : c.phone, c.email, site, 'homepage')
      // 🏷️ webkr 상호 치유(대표 신고 "회사명으로 수집 안 된 것들") — 페이지 제목을 상호로 삼은 행을
      //   사이트 **자기 이름**(og:site_name/title)으로 교정. 어차피 연 사이트라 추가 비용 0.
      //   미큐레이션(status=new)만 + 이름이 수상할 때만(정상 상호는 무접촉).
      if (t.source === 'webkr' && c.siteName && t.status === 'new') {
        const { suspectCompanyName } = await import('./company-classify')
        if (suspectCompanyName(t.company_name, t.source_keyword)) {
          spendD1()
          await DB.prepare("UPDATE ad_company_leads SET company_name = ? WHERE id = ? AND status = 'new'").bind(c.siteName.slice(0, 120), t.id).run().catch(() => null)
        }
      }
    }
    // ⛔ 한도 도달이면 **도장 없이** 중단 — 이 행은 '시도된 적 없음'으로 남겨야 다음 실행이 다시 집는다.
    //   (2026-07-28 정체의 진짜 원인: 한도 뒤 무의미하게 실패한 수백 행이 매 라운드 7일 쿨다운을 받아
    //    재시도 풀에서 이탈 → 백로그가 흐르지 않고 이메일 수확이 0 에 고착.)
    //   ⚠️ 중단 **전에** 스냅샷을 남긴다 — 이 신호를 못 남기면 다음 세션이 또 원인부터 찾아야 한다.
    if (budget.limitHit) { await snapshot(true); break }
    await stamp(t.id) // 성공/실패 무관 시도 기록(모았다가 flushStamps 가 1회로) — 다음 시간엔 다음 백로그로
    bump('stamped')
    // 중도 종료돼도 여기까지는 남는다. ⚠️ 첫 3바퀴는 **매번** — 10건 주기만 두면 Phase 2 초반 사망이 영구 미계측이
    //   된다(2026-07-28 실측: `phase:'p1_done'` · `p2:{}` 고정 = 1~9건 구간에서 죽었는데 신호가 0).
    if (++sinceSnapshot <= 3 || sinceSnapshot % 10 === 0) await snapshot(true)
  }
  // 실제로 시도한 리드의 도장을 한 번에 반영 — 한도로 끊겼어도 '해본 것'은 기록해야 다음 라운드가 앞으로 나간다.
  await flushStamps()

  // ── Phase 3: 이름 치유 소급 — 별 모듈(enrich-name-heal)로 분리(2026-07-28). 왜 필요한지는 그 파일 상단 참조.
  if (budget.left > 4 && !budget.limitHit) {
    await healSuspectNames({ DB, budget, stamp, crawlContact, spendD1 })
    await flushStamps()
  }

  phase = 'p3_done'
  spendD1()
  const rem = await DB.prepare("SELECT COUNT(*) AS n FROM ad_company_leads WHERE active = 0 AND merged_into IS NULL").first<{ n: number }>().catch(() => null)
  const crawls = Object.values(crawlReason).reduce((s, n) => s + n, 0)
  const attempted = crawls - (crawlReason.blocked_host || 0) - (crawlReason.bad_url || 0)
  const result = { processed, enriched, remaining: Number(rem?.n) || 0, crawls, hit_rate: attempted > 0 ? Math.round(((crawlReason.ok || 0) / attempted) * 100) : 0 }
  // 🩹 서브리퀘스트 한도 자가 교정 — 부딪혔으면 쓴 양보다 낮게, 다 쓰고도 무사하면 조금 올린다(인플루언서 레인과 동일).
  const nextCap = nextSubreqCap(budgetTotal - budget.left, !!budget.limitHit, learnedCap, envBudget, pcap)
  if (nextCap != null) {
    spendD1()
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(subreqCapKey('company_enrich'), String(nextCap)).run().catch(() => null)
    capForStamp = nextCap // 상태줄이 '다음 실행 상한'을 새 값으로 보여주도록
  }
  await snapshot(false, Number(rem?.n) || 0) // 정상 종료 — 부분 스냅샷을 최종본으로 덮는다(partial:false)
  return result
}

