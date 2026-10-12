/**
 * ⏱️ 부팅 비용 — 대표 *"메인에서 유어쇼츠가 늦게 로딩되네? 그리고 각 페이지마다도 로딩속도 개선이
 * 필요해. 로딩 화면이 뜨는게 마냥 좋은 건 아니잖아. 빠른게 좋은거지"* (2026-10-12).
 *
 * ## 실측으로 드러난 것 넷 (라이브 `urdeal.kr`, iPhone 13 에뮬)
 * ① 유어쇼츠 썸네일이 `/api/image/resize`(워커 프록시)로 가고 있었다 — 그 경로는 **리사이즈를 못 한다**
 *    (2026-06-11 실측). 125×222 카드에 `hqdefault.jpg` **30,801B** × 10장. cdn-cgi 로 w=250 을 요청하면
 *    `cf-resized: internal=ok` · **7,361B**(4.2× 작다).
 * ② `/api/urshorts` 가 예열 밖이라 콜드 콜로에서 **478ms**(따뜻하면 99ms). 레일은 React 마운트 뒤에야
 *    부르므로 그 지연이 통째로 사람이 기다리는 시간이다.
 * ③ `/api/side-banners` 가 **캐시 헤더가 없다** — 소비자 페이지마다 콜드 D1 **388ms** +
 *    요청마다 `CREATE TABLE IF NOT EXISTS`(왕복 2회).
 * ④ **`requestIdleCallback` 은 "콘텐츠가 뜬 뒤" 가 아니다.** 부팅 중엔 네트워크 대기로 한가한 구간이
 *    계속 생겨서, 5초 timeout 을 줬는데도 센트리가 **페이지 데이터보다 먼저** 떴다
 *    (`/vouchers` envelope POST 1,004ms vs 본문 1,151ms). 4× CPU 스로틀에서 longtask 합계
 *    1,741ms → 389ms 차이. 일을 줄이는 게 아니라 **기다리는 창 밖으로 옮긴다**.
 *
 * ## 이 시험이 못 보는 것
 * - 실제로 몇 ms 빨라지는지(네트워크 노이즈가 ±600ms — 배포 뒤 라이브에서 잰다)
 * - 예열이 **효과가 있는지**(콜로마다 다르다 — 헤더가 붙어 있는지까지만 본다)
 * - cdn-cgi 가 앞으로도 유튜브 원본을 받아 줄지(`onerror=redirect` 안전판이 그 실패를 원본 302 로 흡수)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => readFileSync(p, 'utf-8')
const code = (p: string) => stripComments(read(p))

const CF = 'src/utils/cf-image.ts'
const WORKER = 'src/worker/index.ts'
const PREWARM = 'src/worker/cron/cache-prewarm.ts'
const MAIN = 'src/main.tsx'

describe('① 유어쇼츠 썸네일 — 리사이즈되는 경로로 간다', () => {
  /**
   * 🩸 2026-10-12: 처음에 **엉뚱한 목록**에 넣었다. 이 파일엔 비슷한 이름이 둘이다 —
   *   모듈 스코프 `EXTERNAL_PROXY_HOSTS`(변환 대상인가) 와 **함수 안의 `CDN_CGI_VERIFIED` 배열**
   *   (cdn-cgi 로 직접 보낼 것인가). 실제 경로를 정하는 것은 **뒤쪽**이고, 앞쪽에만 넣으면
   *   여전히 워커 프록시로 간다(빌드도 테스트도 초록인 채). 그래서 **둘 다** 검사한다.
   */
  it('유튜브 썸네일 호스트 둘이 cdn-cgi **판정 배열**에 있다', () => {
    const src = code(CF)
    const m = src.match(/const CDN_CGI_VERIFIED = \[([^\]]*)\]/)
    expect(m, 'cdn-cgi 판정 배열을 못 찾았다 — 이 검사가 헛돈다').toBeTruthy()
    expect(m![1], 'img.youtube.com 이 판정 배열에 없다 — 워커 프록시로 가서 원본 30KB 가 그대로 간다')
      .toContain("'img.youtube.com'")
    expect(m![1], 'i.ytimg.com 이 빠졌다 — 유튜브가 같은 썸네일을 이 호스트로도 준다')
      .toContain("'i.ytimg.com'")
    // 그 배열은 `host === h || host.endsWith('.'+h)` 로 쓰여야 의미가 있다(배선 확인).
    expect(src).toMatch(/CDN_CGI_VERIFIED\.some\(h => host === h \|\| host\.endsWith\('\.' \+ h\)\)/)
  })

  it('두 호스트가 외부 변환 대상으로도 등재돼 있다 (한쪽만이면 원본으로 샌다)', () => {
    const src = code(CF)
    const ext = src.slice(src.indexOf('EXTERNAL_PROXY_HOSTS'))
    const upTo = ext.slice(0, ext.indexOf('])'))
    expect(upTo).toContain("'img.youtube.com'")
    expect(upTo).toContain("'i.ytimg.com'")
  })

  it('워커 프록시 허용 목록에도 있다 (cdn-cgi 가 막히면 여기로 떨어진다)', () => {
    const src = code(WORKER)
    const m = src.match(/const ALLOWED_HOSTS = \[([\s\S]{0,900}?)\]/)
    expect(m, 'ALLOWED_HOSTS 를 못 찾았다 — 이 검사가 헛돈다').toBeTruthy()
    expect(m![1]).toContain("'i.ytimg.com'")
  })
})

describe('② ③ 예열 — 사람이 기다리는 주소를 미리 데운다', () => {
  const hot = () => {
    const m = code(PREWARM).match(/const HOT_PATHS[^=]*=\s*\[([\s\S]*?)\n\] as const/)
    expect(m, 'HOT_PATHS 를 못 찾았다 — 이 검사가 헛돈다').toBeTruthy()
    return [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  }

  it('유어쇼츠·사이드배너·소비자설정이 예열 목록에 있다', () => {
    const h = hot()
    for (const p of ['/api/urshorts', '/api/side-banners', '/api/consumer-settings']) {
      expect(h, `${p} 가 예열 밖이다 — 콜드 콜로에서 그 지연이 그대로 사람 대기 시간이 된다`).toContain(p)
    }
  })

  it('예열 목록이 서브리퀘스트 예산 안이다 (무료 50/인보케이션 — KV·D1 포함)', () => {
    const h = hot()
    // HOT + 동적 12 + D1 3 + KV 4 ≤ 50 → HOT 은 31 이 상한이다. 지금은 25.
    expect(h.length, '예열 목록이 예산을 넘었다 — 뒤쪽 경로가 매번 조용히 실패한다').toBeLessThanOrEqual(31)
    expect(h.length, '예열 목록이 비었다 — 이 검사가 헛돈다').toBeGreaterThan(15)
    expect(new Set(h).size, '같은 주소가 두 번 있다 — 예열 결과는 같고 서브리퀘스트만 한 칸 더 쓴다').toBe(h.length)
  })

  it('사이드 배너에 엣지 캐시가 붙어 있다 (요청마다 DDL+SELECT 를 돌던 자리)', () => {
    expect(code(WORKER), '`/api/side-banners` 가 다시 무캐시가 됐다 — 페이지마다 콜드 D1 388ms')
      .toMatch(/app\.get\('\/api\/side-banners',\s*edgeCache\(\d+\)/)
  })
})

describe('④ 센트리는 콘텐츠가 뜬 **뒤**에 켠다', () => {
  it('load 이벤트 뒤에 예약한다 (requestIdleCallback 단독 금지)', () => {
    const src = code(MAIN)
    const blk = src.slice(src.indexOf('initSentryDeferred'), src.indexOf('initSentryDeferred') + 1200)
    expect(blk, 'load 게이트가 없다 — idle 은 "한가한 순간" 이라 부팅 중에 바로 떠서 페이지 데이터보다 앞선다')
      .toMatch(/addEventListener\('load'/)
    expect(blk, 'afterPaint 배선이 빠졌다').toMatch(/readyState === 'complete'/)
  })

  it('백스톱이 있다 (load 가 안 와도 센트리가 켜진다)', () => {
    const src = code(MAIN)
    const blk = src.slice(src.indexOf('initSentryDeferred'), src.indexOf('initSentryDeferred') + 1200)
    /**
     * 🩸 첫 판이 헛돌았다 — `\d{4,}` 로 썼더니 **`afterPaint` 의 폴백 `setTimeout(startSentry, 2000)`**
     *   에 걸려, 백스톱을 통째로 지워도 초록이었다(주입이 잡았다). 백스톱은 "길다" 가 핵심이므로
     *   **모든 예약값을 모아 가장 긴 것**을 본다.
     */
    const waits = [...blk.matchAll(/setTimeout\(startSentry,\s*(\d+)\)/g)].map((m) => Number(m[1]))
    expect(waits.length, 'startSentry 예약이 하나도 없다 — 이 검사가 헛돈다').toBeGreaterThan(0)
    expect(Math.max(...waits), '백스톱이 없다(또는 너무 짧다) — 장기 연결·숨은 탭에서 센트리가 통째로 안 켜진다')
      .toBeGreaterThanOrEqual(10000)
    expect(blk, '한 번만 켜지는 가드가 없다 — load 와 백스톱이 둘 다 불러 두 번 초기화된다')
      .toMatch(/sentryStarted/)
  })

  it('이른 에러는 센트리와 무관하게 이미 잡힌다 (이 변경의 전제)', () => {
    const src = code(MAIN)
    expect(src, 'installErrorTelemetry 가 사라졌다 — 그러면 센트리를 미루는 순간 초기 에러가 통째로 사라진다')
      .toContain('installErrorTelemetry()')
    // 센트리보다 **먼저** 설치돼야 의미가 있다.
    expect(src.indexOf('installErrorTelemetry()')).toBeLessThan(src.indexOf('initSentryDeferred'))
  })

  it('🔒 잠긴 항목 불변 — env-validator 는 여전히 동적 import 다', () => {
    expect(code(MAIN), 'zod(52KB)가 첫 페인트 청크로 돌아온다')
      .toMatch(/import\('@\/shared\/config\/env-validator'\)/)
  })
})
