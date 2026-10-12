/**
 * 🧭 형식이 틀린 유어샵 핸들도 404 다 — soft-404 수리 (2026-10-12, 대표 *"나머진 다 해줘"*)
 *
 * ## 실측 (Googlebot UA 로 라이브)
 *
 *     /u/zzzdoesnotexist9999      → 404 · noindex, follow   · CURATOR:self-fetch-404  ← 멀쩡했다
 *     /u/zzz-does-not-exist-9999  → **200 · index, follow** · CURATOR:self-fetch-400  ← 결함
 *     /u/jiwon1228                → 200 · index, follow     · CURATOR:self-fetch-hit
 *
 * 🩸 **처음 진단을 반쪽 틀렸다.** "없는 유어샵이 soft-404" 라고 적었는데, 재 보니 *없는* 핸들은
 * 이미 404 + noindex 였고 문제는 **형식이 틀린** 핸들(하이픈 등)뿐이었다. 테스트 입력이 하필
 * `zzz-does-not-exist-9999` 라서 두 경우가 겹쳐 보였다 — **측정 입력부터 의심할 것.**
 *
 * ## 처방의 모양
 *
 * `shouldNoindexMissingEntity` 는 `self-fetch-404` 에만 걸린다. 술어에 400 을 더하는 쪽이 아니라
 * **API 가 404 를 주게** 고쳤다 — 그러면 술어가 한 글자도 안 바뀐 채 잡고, "살아 있는 엔티티가
 * 일시적 400 을 받는 날 색인에서 빠지는" 위험도 안 생긴다(타임아웃을 일부러 제외한 것과 같은 이유).
 *
 * ## 양방향
 *
 * 읽기는 404, **쓰기 검증은 400 그대로**. 거기까지 404 로 바꾸면 "저장 실패" 를 "없는 리소스" 라고
 * 말하게 된다 — 한쪽만 잠그면 다음 세션이 "일관성" 을 이유로 전부 한쪽으로 몰 수 있다.
 *
 * ## 못 보는 것
 *
 * 워커가 그 404 를 실제로 noindex 로 바꾸는지(HTMLRewriter 는 워커 전용 API 라 유닛 밖) —
 * 배포 후 `curl` 로 `/u/my-shop` 이 404 + noindex 인지 재야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { shouldNoindexMissingEntity } from '@/worker/utils/surface-ssr-meta'
import { isValidHandleFormat } from '@/worker/utils/handle-generator'

const curator = readCode('src/worker/routes/curator.routes.ts')

/** `GET /:handle` 핸들러의 머리 — 형식 검사가 사는 자리. */
const readHandler = curator.slice(
  curator.indexOf("curatorRoutes.get('/:handle', optionalAuth()"),
  curator.indexOf("curatorRoutes.get('/:handle/p/"),
)

describe('① 읽기 경로는 형식 위반에도 404 를 준다', () => {
  it('형식 검사 바로 뒤 응답이 404 다', () => {
    expect(readHandler.length, '핸들러를 못 잘랐다 — 앵커가 낡았다').toBeGreaterThan(200)
    const m = /if \(!handle \|\| !isValidHandleFormat\(handle\)\) \{\s*return c\.json\(\{[^}]*\}, (\d{3})\)/.exec(readHandler)
    expect(m, '형식 검사 직후 응답을 못 찾았다').not.toBeNull()
    expect(m![1], 'soft-404 로 되돌아갔다 — 400 이면 noindex 그물을 빠져나간다').toBe('404')
  })

  it('그 핸들러 안에 400 응답이 하나도 없다', () => {
    expect(/, 400\)/.test(readHandler), '읽기 경로에 400 이 남았다').toBe(false)
  })
})

describe('② 쓰기·조회는 각자의 코드를 지킨다 (반대 방향)', () => {
  it('핸들 변경(PATCH)은 형식 위반을 400 + INVALID_FORMAT 으로 거절한다', () => {
    const m = /code: 'INVALID_FORMAT',\s*\}, (\d{3})\)/.exec(curator)
    expect(m, '핸들 변경의 형식 거절을 못 찾았다 — 앵커가 낡았다').not.toBeNull()
    expect(m![1], '쓰기까지 404 로 바꾸면 "저장 실패" 를 "없는 리소스" 라고 말한다').toBe('400')
  })

  it('핸들 가용성 조회는 오류가 아니라 available:false 로 답한다', () => {
    // 🔎 여기만 성격이 다르다 — "이 핸들 쓸 수 있나" 에 형식 위반은 **정상 답변**이다.
    //   한 패턴으로 세 자리를 묶으려다 이 차이를 놓쳤다(첫 판이 거짓 빨간불을 냈다).
    const m = /reason: 'invalid_format',[\s\S]{0,200}?\}\)/.exec(curator)
    expect(m, '가용성 조회의 형식 응답을 못 찾았다').not.toBeNull()
    expect(/\}, \d{3}\)/.test(m![0]), '가용성 조회가 오류 코드를 내면 입력 중 화면이 빨개진다').toBe(false)
  })
})

describe('③ noindex 술어를 넓히지 않았다', () => {
  it('404 만 "없음" 으로 본다 — 400·timeout 은 아니다', () => {
    expect(shouldNoindexMissingEntity('CURATOR', 'self-fetch-404')).toBe(true)
    expect(shouldNoindexMissingEntity('CURATOR', 'self-fetch-400'),
      '400 을 술어에 넣으면 살아 있는 가게가 일시 검증 버그로 색인에서 빠진다').toBe(false)
    expect(shouldNoindexMissingEntity('CURATOR', 'self-fetch-timeout'),
      '"느리다" 는 "없다" 가 아니다 — 콜드 콜로에서 흔하다').toBe(false)
    expect(shouldNoindexMissingEntity('MAIN', 'self-fetch-404'),
      '목록 슬롯은 API 가 404 여도 페이지 자체는 유효하다').toBe(false)
  })
})

describe('④ 형식 판정 자체는 그대로', () => {
  it('하이픈은 유효하지 않고 밑줄·숫자는 유효하다', () => {
    expect(isValidHandleFormat('my-shop'), '이 전제가 깨지면 처방의 근거가 사라진다').toBe(false)
    expect(isValidHandleFormat('jiwon1228')).toBe(true)
    expect(isValidHandleFormat('my_shop')).toBe(true)
    expect(isValidHandleFormat('ab'), '3자 미만').toBe(false)
  })
})
