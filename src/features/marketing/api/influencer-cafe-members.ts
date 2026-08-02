/**
 * 🏘️ **네이버 카페 회원수 채우기** (2026-07-29 대표 신고 — "카페 회원수는 반영이 안되고 있음(카운팅이 안됨)").
 *
 *   ## 왜 항상 0 이었나
 *   카페는 네이버 검색 오픈API 의 `cafearticle.json`(글 검색)으로 발굴한다. 그 응답에는 카페 이름·주소만
 *   있고 **회원수 필드가 아예 없다.** 그래서 저장 시 `subscriber_count: 0` 을 넣고 끝이었다
 *   (`influencer-discovery.ts` 의 카페 분기). 즉 "카운팅이 안 되는" 게 아니라 **한 번도 세어본 적이 없다.**
 *   화면의 0 은 "회원 0명"이 아니라 "모름"이었고, 그 둘이 구분되지 않던 것이 진짜 문제다.
 *
 *   ## 어디서 가져오나
 *   카페 홈(`cafe.naver.com/{handle}`)의 공개 HTML 에 멤버 수가 노출된다. 표기가 한 가지가 아니라
 *   (`멤버수 12,345` · `멤버 12,345명` · `회원수 12,345`) 여러 형태를 받는다.
 *   ⚠️ 숫자만 있는 곳(글 수·방문자)과 구분해야 하므로 **'멤버/회원' 단어를 반드시 요구**한다 —
 *   느슨하게 잡으면 글 수를 회원수로 적어 넣는다(0 보다 나쁜 실패다).
 *
 *   ## 비용
 *   카페 1곳당 fetch 1. 카페는 3,142개뿐이고 **한 번 채우면 다시 안 잰다**(`subscriber_count > 0` 이면 제외)
 *   — 전수 1회 훑는 성격이라 정기 부담이 아니다.
 *   ⚠️ 회원수는 늘지만 재측정하지 않는다. 발송 판단에 쓰는 값이 아니라 **규모 감**을 보는 값이고,
 *   재측정하면 3,142 fetch 를 매번 되풀이하게 된다(그 비용은 블로거 측정에서 나온다).
 */
import type { D1Database } from '@cloudflare/workers-types'
/**
 * 예산은 **최소 형태**만 받는다 — 발굴 레인의 `FetchBudget` 과 정비 레인의 `OpBudget` 둘 다
 * 이 모양을 만족한다. 한쪽 타입에 묶으면 다른 레인에서 못 쓴다(어댑터를 새로 만들게 된다).
 */
type Spendable = { left: number; deadline?: number }

/** 회원수로 받아들일 수 있는 값인가 — 상한: 네이버 최대 카페도 1천만 미만(넘으면 글 수/조회수 오집). */
const sane = (n: number): number | null => (Number.isFinite(n) && n > 0 && n < 10_000_000 ? n : null)

/** 카페 홈 HTML → 회원수. 못 찾으면 null(0 으로 덮어쓰지 않는다 — '모름'과 '0명'은 다르다). */
export function parseCafeMembers(html: string): number | null {
  if (!html) return null
  // '멤버수 12,345' / '멤버 12,345명' / '회원수 12,345' / '회원 12,345명'
  const m = /(?:멤버|회원)\s*수?\s*[:：]?\s*([0-9][0-9,]{0,12})\s*명?/.exec(html)
  if (!m) return null
  return sane(parseInt(m[1]!.replace(/,/g, ''), 10))
}

/**
 * 🔤 **EUC-KR 바이트에서 직접 회원수 뽑기** — 2026-08-02 라이브 표본이 원인을 확정했다.
 *
 * ```
 *   status 200 · len 200,000 · peek '::�ǻ�::�Ǽ���������ϴ»���� / No.1 ���Ͼ�Ʈ...'
 * ```
 * 차단도 프레임셋도 아니었다. **카페 홈은 EUC-KR 인데 `res.text()` 가 UTF-8 로 디코딩**해서,
 * 한글이 전부 U+FFFD 로 뭉개진다 — `멤버|회원` 정규식은 매치될 수가 없다(18/18 실패의 전부).
 *
 * ⚠️ **왜 TextDecoder 에 기대지 않는가**: Workers 런타임의 `TextDecoder` 가 'euc-kr' 라벨을 지원하는지
 *   이 환경에서 확인할 수 없다(cafe.naver.com·CF 대시보드 모두 프록시 차단). 지원하면 그걸 쓰고,
 *   throw 하면 이 바이트 스캔으로 떨어진다 — **둘 중 뭐가 먹었는지는 `via` 로 라이브에서 보인다.**
 *   바이트 스캔은 디코더가 전혀 필요 없다: 라벨의 EUC-KR 바이트를 찾고, 그 뒤의 **ASCII 숫자**를 읽는다
 *   (모지바케가 되든 말든 숫자 바이트는 훼손되지 않는다).
 */
const EUCKR_LABELS: number[][] = [
  [0xb8, 0xe2, 0xb9, 0xf6], // 멤버
  [0xc8, 0xb8, 0xbf, 0xf8], // 회원
]

/** 바이트 창을 ASCII 만 남겨 문자열로 — 한글(≥0x80)은 공백. 숫자·태그·구두점은 그대로 살아남는다. */
export function asciiWindow(buf: Uint8Array, from: number, len: number): string {
  let s = ''
  for (let i = Math.max(0, from), end = Math.min(buf.length, from + len); i < end; i++) {
    const c = buf[i]!
    s += c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : ' '
  }
  return s
}

export function parseCafeMembersFromBytes(buf: Uint8Array): number | null {
  for (const label of EUCKR_LABELS) {
    for (let i = 0; i + label.length < buf.length; i++) {
      let hit = true
      for (let j = 0; j < label.length; j++) if (buf[i + j] !== label[j]) { hit = false; break }
      if (!hit) continue
      // 라벨 뒤 60바이트를 ASCII 로 펴서 첫 숫자 덩어리(쉼표 포함)를 읽는다.
      //   ⚠️ 마크업이 숫자를 쪼개면(`<b>12</b>,345`) 앞 조각만 잡힐 수 있다 — 기존 UTF-8 정규식과 같은
      //     한계이고, `sane()` 이 상한만 막는다. 실제로 그런지는 진단 표본(peek)이 말해 준다.
      const m = /([0-9][0-9,]{0,12})/.exec(asciiWindow(buf, i + label.length, 60))
      if (!m) continue
      const n = sane(parseInt(m[1]!.replace(/,/g, ''), 10))
      if (n != null) return n
    }
  }
  return null
}

/**
 * 🔬 실패 표본 — **왜** 못 뽑았는지 라이브에서 보이게 한다.
 *
 *   2026-08-02 첫 라이브 회차가 `tried 3 · filled 0 · failed 3` 이었다. 자리는 잡혔는데 100% 실패인데,
 *   진단이 없으니 원인이 ⓐ 요청 차단(403/302) ⓑ 프레임셋이라 본문에 숫자가 없음 ⓒ 표기가 달라 정규식 미스
 *   중 무엇인지 **구분할 방법이 없었다.** 셋은 처방이 전혀 다르다(헤더 / 다른 엔드포인트 / 정규식).
 *   ⚠️ 이 환경에서는 `cafe.naver.com` 이 프록시에 막혀(CONNECT 403) 직접 확인이 불가능하다 —
 *     그래서 **워커가 본 것**을 남기는 것이 유일한 관측 경로다.
 *   🔒 HTML 원문을 담지 않는다: 태그를 걷고 120자만, 표본 3건까지(설정값 크기·개인정보 양쪽 고려).
 */
export interface CafeSample { handle: string; via: string; status: number; len: number; peek: string }
export interface CafeMemberDiag {
  tried: number; filled: number; failed: number; selected: number
  samples?: CafeSample[]
  /** 전량 실패라 회차를 접었다 — 뒤 단계(지역·재추출)에 예산을 넘겼다는 뜻. */
  aborted?: true
}

/**
 * 🛑 **연속 실패 조기 중단 임계** — 2026-08-02 회귀의 수리.
 *
 *   #957 이 카페를 단계 맨 앞으로 옮겨 굶주림(3/20 시도)은 풀었는데, **18번이 전부 실패하면서
 *   예산을 다 태우고** 뒤의 지역 백필·재추출을 0 으로 굶겼다(라이브 실측: `region {filled:0}` ·
 *   `reextract {scanned:0}` · 커서 불변). 순서를 고치면서 "안 되면 접는다"를 안 넣은 것이 원인이다.
 *   ⇒ 한 건도 못 채운 채 이만큼 실패하면 **그 회차는 접고 예산을 뒤에 넘긴다.** 카페는 다음 회차가
 *     이어서 잡으므로(채운 행은 제외되니 커서도 필요 없다) 잃는 것이 없다.
 */
export const CAFE_ABORT_AFTER_FAILS = 4

/** 태그를 걷고 '멤버/회원' 주변을 잘라낸다 — 없으면 앞부분 일부(무엇을 받았는지라도 보이게). */
export function peekMembers(html: string): string {
  const text = String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const i = text.search(/멤버|회원/)
  return (i >= 0 ? text.slice(Math.max(0, i - 40), i + 80) : text.slice(0, 120)).trim()
}

/**
 * 회원수 미측정 카페를 골라 채운다. 커서 불필요 — 채워진 행은 `subscriber_count > 0` 이라 다음 회차가
 * 자연히 다음 구간을 잡는다(지역 백필과 같은 방식).
 */
export async function fillCafeMemberCounts(DB: D1Database, poolId: number, budget: Spendable, max = 20): Promise<CafeMemberDiag> {
  const diag: CafeMemberDiag = { tried: 0, filled: 0, failed: 0, selected: 0 }
  if (max <= 0) return diag
  const rows = (await DB.prepare(`SELECT id, handle, url FROM ad_influencer_leads
      WHERE account_id = ? AND platform = 'naver_cafe' AND COALESCE(subscriber_count, 0) = 0
      ORDER BY id ASC LIMIT ?`).bind(poolId, Math.min(max, 30))
    .all<{ id: number; handle: string | null; url: string | null }>().catch(() => null))?.results || []
  diag.selected = rows.length
  if (!rows.length) return diag

  const ups: ReturnType<D1Database['prepare']>[] = []
  for (const r of rows) {
    if (budget.left <= 0 || (budget.deadline && Date.now() >= budget.deadline)) break
    const handle = (r.handle || '').trim() || (r.url || '').replace(/^https?:\/\/(?:m\.)?cafe\.naver\.com\//i, '').replace(/[/?#].*$/, '')
    if (!handle) continue
    budget.left -= 1
    diag.tried++
    let n: number | null = null
    const vias: string[] = []
    let last: { status: number; len: number; peek: string } | undefined
    /**
     * 🚪 **게이트 JSON 우선, 홈 HTML 폴백.**
     *   `cafe.naver.com/{handle}` 는 프레임셋을 돌려줄 수 있어 본문에 숫자가 없을 수 있다(가설).
     *   카페 게이트 정보 JSON 에는 회원수가 들어 있다. 어느 쪽이 되는지는 **표본이 말해 준다** —
     *   `via` 로 어떤 경로가 성공/실패했는지 남긴다. 둘 다 실패해도 기존과 같은 결과(0 덮어쓰기 없음)라
     *   추가로 나빠지지 않는다.
     *   ⚠️ 비용: 게이트가 성공하면 fetch 1(기존과 동일). 실패해야 폴백이 붙어 2가 된다.
     */
    const attempts: { via: string; url: string }[] = [
      { via: 'gate', url: `https://apis.naver.com/cafe-web/cafe2/CafeGateInfo.json?cluburl=${encodeURIComponent(handle)}` },
      { via: 'home', url: `https://cafe.naver.com/${encodeURIComponent(handle)}` },
    ]
    for (const a of attempts) {
      try {
        const res = await fetch(a.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            Referer: 'https://cafe.naver.com/',
          },
          signal: AbortSignal.timeout(8000),
        })
        // 📦 **바이트로 받는다** — 인코딩 판단을 우리가 한다(`res.text()` 는 무조건 UTF-8 이라
        //   EUC-KR 인 카페 홈을 통째로 뭉갠다. 그게 18/18 실패의 원인이었다).
        const raw = res.ok ? new Uint8Array((await res.arrayBuffer()).slice(0, 300_000)) : new Uint8Array(0)
        let how = a.via
        if (res.ok) {
          const utf8 = new TextDecoder().decode(raw) // 게이트 JSON·UTF-8 페이지는 여기서 끝난다
          n = parseCafeMembers(utf8)
          if (n == null) {
            try { // 런타임이 euc-kr 라벨을 지원하면 그게 가장 정확하다
              n = parseCafeMembers(new TextDecoder('euc-kr').decode(raw))
              if (n != null) how = `${a.via}:euckr`
            } catch { /* 미지원 런타임 — 아래 바이트 스캔으로 */ }
          }
          if (n == null) {
            n = parseCafeMembersFromBytes(raw)
            if (n != null) how = `${a.via}:bytes`
          }
          // 실패 표본은 **ASCII 로 편 창**을 남긴다 — U+FFFD 뭉갬은 원인을 못 보여준다(이미 겪었다).
          if (n == null) last = { status: res.status, len: raw.length, peek: asciiWindow(raw, 0, 160).replace(/\s+/g, ' ').trim() }
        } else {
          last = { status: res.status, len: 0, peek: '' }
        }
        vias.push(how)
      } catch { /* 실패는 다음 회차가 재시도(멱등) */ }
      if (n != null) break
      if (budget.left <= 0) break
      budget.left -= 1 // 폴백도 한 번의 fetch 다 — 예산에 정직하게 반영
    }
    if (n == null) {
      diag.failed++
      if (last && (diag.samples ||= []).length < 3) diag.samples.push({ handle, via: vias.join('+'), ...last })
      // 🛑 한 건도 못 채운 채 연속 실패면 접는다 — 뒤 단계(지역·재추출)를 굶기지 않기 위해서다.
      if (diag.filled === 0 && diag.failed >= CAFE_ABORT_AFTER_FAILS) { diag.aborted = true; break }
      continue
    }
    ups.push(DB.prepare('UPDATE ad_influencer_leads SET subscriber_count = ? WHERE id = ? AND account_id = ?').bind(n, r.id, poolId))
    diag.filled++
  }
  for (let i = 0; i < ups.length; i += 50) await DB.batch(ups.slice(i, i + 50)).catch(() => null)
  return diag
}
