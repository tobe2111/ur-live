/**
 * 🎲 OCR 이 같은 사진에 **절반쯤 빈손으로 돌아오는 것** — `worker/utils/ocr-license.ts`.
 *
 * ## 무엇을 재서 이렇게 고쳤나 (2026-09-21, 대표 *"너가 완벽히 처리 후에 자동 승인 게이트 켤게"*)
 * 같은 서류(seller 15)로 라이브 20회:
 * ```
 * 빈 응답             10 / 20  (50%)   ← 순차 재시도 1회를 **이미 쓴 뒤**의 숫자다
 * 읽혔을 때 사업자번호   9 / 9   (100%)
 * 읽혔을 때 개업일      9 / 9   (100%)
 * 읽혔을 때 대표자      9 / 10
 * 읽혔을 때 상호        3 / 9          ← 오독이 잦다 (`클`→`글`)
 * ```
 * ⇒ 문제는 **값 정확도가 아니라 읽히느냐**다. 순차 2회에 50% 가 빈손이면 단발 성공률은 약 29%
 *   (0.71² ≈ 0.5). 순차로 한 자릿수까지 내리려면 8회쯤 걸리는데 그만큼 사장님이 기다린다.
 *   ⇒ **병렬 4회 × 최대 2라운드** + 여러 답의 **필드별 다수결**.
 *
 * ## 이 시험이 지키는 불변식
 * 1. 한 라운드는 **병렬**이다 — 지연이 호출 수만큼 늘어나면 처방이 무의미해진다.
 * 2. 빈손 라운드면 한 번 더, **예외면 더 묻지 않는다**(쿼터·라이선스는 같은 답이 온다).
 * 3. 한 응답의 예외가 **나머지 응답을 버리게 하지 않는다**.
 * 4. 파싱 규칙(자리표시자·이스케이프 JSON·등록번호 칸의 개업일)은 순수 함수로 고정한다.
 * 5. 다수결은 **띄어쓰기만 다른 답을 같은 답으로** 묶는다.
 * 6. 비용 상한이 상수로 고정돼 있다.
 *
 * ## ⚠️ 이 시험이 **못** 막는 것
 * - 모델이 **일관되게** 잘못 읽는 글자(상호 `클`→`글` 이 9회 중 6회). 다수결도 못 이긴다.
 *   그래서 가입 화면은 상호를 **지도에서** 받는다(2026-09-21 안 B).
 * - 라이브 성공률. 여기서는 가짜 모델을 쓴다 ⇒ 판정은 **배포 후 20회 재측정**이다.
 */
import { describe, it, expect } from 'vitest'
import {
  ocrDocument, parseOcrText, mergeOcrResults,
  OCR_PARALLEL_ATTEMPTS, OCR_ROUNDS, type OcrDocResult,
} from '@/worker/utils/ocr-license'

const JSON_OK = '{"biz_name":"[테스트] 클로드분식","address":"전북특별자치도 전주시 덕진구 가리내10길 10","owner_name":"김테스트","biz_number":"999-99-99991","permit_date":"2024-03-02"}'

/** 응답을 **순서대로** 나눠 주는 가짜 모델. 동시에 불려도 하나씩 집어 간다. */
function fakeAi(responses: Array<string | Error>) {
  const calls: number[] = []
  let started = 0
  let maxInFlight = 0
  return {
    calls,
    /** 동시에 몇 개가 떠 있었나 — 병렬인지 순차인지 판정한다. */
    get maxInFlight() { return maxInFlight },
    ai: {
      run: async () => {
        calls.push(1)
        started += 1
        maxInFlight = Math.max(maxInFlight, started)
        const next = responses.shift()
        // 한 틱 양보해 형제 호출이 시작될 틈을 준다(순차라면 이때 in-flight 가 1에 머문다)
        await new Promise((r) => setTimeout(r, 0))
        started -= 1
        if (next instanceof Error) throw next
        return { response: next ?? '' }
      },
    } as unknown as Parameters<typeof ocrDocument>[0],
  }
}

const blanks = (n: number) => Array.from({ length: n }, () => '')

describe('ocrDocument — 병렬로 여러 번 묻는다', () => {
  it('① 한 라운드는 병렬이다 (지연이 호출 수만큼 늘어나면 처방이 무의미하다)', async () => {
    const f = fakeAi([...blanks(OCR_PARALLEL_ATTEMPTS - 1), JSON_OK])
    await ocrDocument(f.ai, new Uint8Array([1]), 'business_registration')
    expect(f.maxInFlight, '동시에 하나씩만 떠 있었다 — 순차로 회귀했다').toBe(OCR_PARALLEL_ATTEMPTS)
  })

  it('② 한 라운드에 정확히 OCR_PARALLEL_ATTEMPTS 번 묻는다 (비용 상한)', async () => {
    const f = fakeAi(Array.from({ length: OCR_PARALLEL_ATTEMPTS }, () => JSON_OK))
    await ocrDocument(f.ai, new Uint8Array([1]), 'business_registration')
    expect(f.calls.length).toBe(OCR_PARALLEL_ATTEMPTS)
  })

  it('③ 한 라운드가 통째로 비면 한 번 더 — 그래도 비면 정직하게 unreadable', async () => {
    const f = fakeAi(blanks(OCR_PARALLEL_ATTEMPTS * OCR_ROUNDS))
    const r = await ocrDocument(f.ai, new Uint8Array([1]), 'business_registration')
    expect(f.calls.length).toBe(OCR_PARALLEL_ATTEMPTS * OCR_ROUNDS)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('빈 응답')
    expect(r.message).toContain(`${OCR_PARALLEL_ATTEMPTS * OCR_ROUNDS}회`)
  })

  it('④ 첫 라운드에서 하나라도 읽히면 두 번째 라운드를 안 돈다', async () => {
    const f = fakeAi([...blanks(OCR_PARALLEL_ATTEMPTS - 1), JSON_OK, JSON_OK])
    const r = await ocrDocument(f.ai, new Uint8Array([1]), 'business_registration')
    expect(f.calls.length).toBe(OCR_PARALLEL_ATTEMPTS)
    expect(r.ok).toBe(true)
    expect(r.bizNumber).toBe('9999999991')
  })

  it('④-2 🙅 **못 읽은 답은 라운드를 삼키지 않는다** — 그 한 라운드가 전부다', async () => {
    // 🩸 CI 가 잡은 것: 병렬로 바꾸면서 옛 주입(`isBlank` 약화)이 무의미해졌다 —
    //   `if (r.ok)` 게이트가 산문을 어차피 걸러내기 때문이다. 진짜 방어선은 그 게이트이고,
    //   그게 풀리면 **못 읽은 답이 `parsed` 에 들어가 두 번째 라운드를 건너뛴다**(조용히).
    //   빈 응답이 절반인 모델에서 그 한 라운드가 성패를 가른다.
    const nothing = '{"biz_name":null,"address":null,"owner_name":null,"biz_number":null,"permit_date":null}'
    const prose = '현재 제공할 수 있는 정보는 없습니다.'
    const round1 = [nothing, prose, nothing, prose].slice(0, OCR_PARALLEL_ATTEMPTS)
    const round2 = Array.from({ length: OCR_PARALLEL_ATTEMPTS }, () => JSON_OK)
    const f = fakeAi([...round1, ...round2])
    const r = await ocrDocument(f.ai, new Uint8Array([1]), 'business_registration')
    expect(f.calls.length, '못 읽은 답을 "읽었다" 로 세어 두 번째 라운드를 건너뛰었다')
      .toBe(OCR_PARALLEL_ATTEMPTS * 2)
    expect(r.ok, '두 번째 라운드가 읽었는데 결과가 실패다').toBe(true)
    expect(r.bizNumber).toBe('9999999991')
  })

  it('⑤ 예외(쿼터·5016 라이선스)면 라운드를 더 돌지 않는다 — 같은 답이 오고 비용만 든다', async () => {
    const errs = Array.from({ length: OCR_PARALLEL_ATTEMPTS }, () => new Error('5016: agree first'))
    const f = fakeAi([...errs, JSON_OK])
    const r = await ocrDocument(f.ai, new Uint8Array([1]), 'business_registration')
    expect(f.calls.length).toBe(OCR_PARALLEL_ATTEMPTS)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('읽기 실패')
  })

  it('⑥ 한 응답의 예외가 나머지를 버리게 하지 않는다', async () => {
    const f = fakeAi([new Error('일시 오류'), JSON_OK, '', ''])
    const r = await ocrDocument(f.ai, new Uint8Array([1]), 'business_registration')
    expect(r.ok, '멀쩡히 읽힌 답이 있는데 예외 하나로 통째로 실패했다').toBe(true)
    expect(r.bizNumber).toBe('9999999991')
  })

  it('⑦ 비용 상한이 상수로 고정돼 있다 — 올리면 추론 비용과 서브리퀘스트가 같이 오른다', () => {
    expect(OCR_PARALLEL_ATTEMPTS).toBeLessThanOrEqual(4)
    expect(OCR_ROUNDS).toBeLessThanOrEqual(2)
    expect(OCR_PARALLEL_ATTEMPTS * OCR_ROUNDS, '무료 서브리퀘스트 예산(50)을 넘본다').toBeLessThanOrEqual(8)
  })
})

describe('parseOcrText — 응답 한 개 (순수 함수, 라이브 실측 픽스처)', () => {
  const parse = (t: string) => parseOcrText(t, 'business_registration')

  it('⑧ 🧵 JSON 을 문자열로 한 번 더 감싼 응답도 읽는다', () => {
    const wrapped = JSON.stringify('{\n "biz_name": "[테스트] 클로드분식",\n "address": "전북특별자치도 전주시 덕진구 가리내 10길 10",\n "owner_name": "김테스트",\n "biz_number": "999-99-99991",\n "permit_date": "2024년 03월 02일"\n}')
    const r = parse(wrapped)
    expect(r.ok).toBe(true)
    expect(r.bizNumber).toBe('9999999991')
    expect(r.fill).toBe(1)
  })

  it('⑨ 🔀 등록번호 칸에 개업일이 들어오면 제자리로 옮긴다', () => {
    const r = parse('{"biz_name":"[테스트] 클로드분식","address":"전북특별자치도 전주시 덕진구 가리내10길 10","owner_name":"김테스트","biz_number":"2024년 03월 02일","permit_date":null}')
    expect(r.bizNumber).toBeNull()
    expect(r.permitDate).toBe('20240302')
    // 진짜 등록번호는 그대로 — 휴리스틱이 정상 값을 건드리지 않는다
    const q = parse(JSON_OK)
    expect(q.bizNumber).toBe('9999999991')
    expect(q.permitDate).toBe('20240302')
  })

  it('⑩ 🪞 프롬프트 자리표시자를 베낀 값("상호(법인명)")은 읽은 것이 아니다', () => {
    const r = parse('{"biz_name":"상호(법인명)","address":"전북특별자치도 전주시 덕진구 가리내10길 10","owner_name":"대표자 성명","biz_number":"999-99-99991","permit_date":"2024-03-02"}')
    expect(r.bizName).toBeNull()
    expect(r.ownerName).toBeNull()
    expect(r.address).toBe('전북특별자치도 전주시 덕진구 가리내10길 10')
    expect(r.fill).toBe(0.5)
  })

  it('⑪ 🪞 모델이 **영문 필드 이름**을 값 자리에 적은 것도 읽은 게 아니다 (20회 중 1회 실측)', () => {
    const r = parse('{"biz_name":null,"address":"business_location","owner_name":"representative_name","biz_number":"999-99-99991","permit_date":"2024-03-02"}')
    expect(r.address, 'business_location 이 주소로 통과했다').toBeNull()
    expect(r.ownerName, 'representative_name 이 대표자로 통과했다').toBeNull()
    expect(r.bizNumber).toBe('9999999991')
  })

  it('⑫ 영문 상호는 **살린다** — 필드 이름 필터가 진짜 값을 먹으면 안 된다', () => {
    const r = parse('{"biz_name":"GS25 전주덕진점","address":"전북특별자치도 전주시 덕진구 가리내10길 10","owner_name":"김테스트","biz_number":"999-99-99991","permit_date":"2024-03-02"}')
    expect(r.bizName).toBe('GS25 전주덕진점')
  })
})

describe('mergeOcrResults — 필드별 다수결 (순수 함수, 20회 실측 그대로)', () => {
  /** 2026-09-21 라이브 20회에서 **실제로 돌아온** 답들. */
  const LIVE = [
    '{"biz_name":"클로드분식","address":"전북 특별자치도 전주시 덕진구 가리내10길 10","owner_name":"김테스트","biz_number":"999-99-99991","permit_date":"2024-03-02"}',
    '{"biz_name":null,"address":"business_location","owner_name":"representative_name","biz_number":null,"permit_date":null}',
    '{"biz_name":"[테스트] 글로드분식","address":"전북특별자치도 전주시 덕진구 가리내10길 10","owner_name":"김테스트","biz_number":"999-99-99991","permit_date":"2024-03-02"}',
    '{"biz_name":"[테스트] 글로드분식","address":"전북특벨자치도 전주시 덕진구 가리내10길 10","owner_name":"김테스트","biz_number":"999-99-99991","permit_date":"2024-03-02"}',
  ].map((t) => parseOcrText(t, 'business_registration'))

  it('⑬ 가입 폼이 채우는 세 칸은 다수결로 정확히 나온다', () => {
    const m = mergeOcrResults(LIVE, 'business_registration')
    expect(m.bizNumber).toBe('9999999991')
    expect(m.permitDate).toBe('20240302')
    expect(m.ownerName).toBe('김테스트')
  })

  it('⑭ 띄어쓰기만 다른 답은 **같은 답**으로 묶인다 (`전북 특별자치도` ↔ `전북특별자치도`)', () => {
    const m = mergeOcrResults(LIVE, 'business_registration')
    expect(m.address?.replace(/\s/g, '')).toBe('전북특별자치도전주시덕진구가리내10길10')
  })

  it('⑭-2 🩸 **오독이 먼저 와도** 다수결이 이긴다 — 응답 순서는 보장되지 않는다(병렬이다)', () => {
    // 🩸 첫 판의 픽스처는 우연히 **첫 답이 정답**이라, 그룹핑을 통째로 꺼도 초록이었다
    //   (주입 `🗳️ 다수결이 그냥 첫 답을 고른다` 가 잡았다). 순서에 기대면 안 된다 —
    //   병렬 호출이라 어느 답이 먼저 올지 우리가 모른다.
    const wrong = parseOcrText('{"biz_name":null,"address":"전북특벨자치도 전주시 덕진구 가리내10길 10","owner_name":"김테스트","biz_number":"999-99-99991","permit_date":"2024-03-02"}', 'business_registration')
    const spaced = parseOcrText('{"biz_name":null,"address":"전북 특별자치도 전주시 덕진구 가리내10길 10","owner_name":"김테스트","biz_number":"999-99-99991","permit_date":"2024-03-02"}', 'business_registration')
    const tight = parseOcrText('{"biz_name":null,"address":"전북특별자치도 전주시 덕진구 가리내10길 10","owner_name":"김테스트","biz_number":"999-99-99991","permit_date":"2024-03-02"}', 'business_registration')
    // 오독 1 vs (띄어쓰기만 다른) 정답 2 — 묶어야만 정답이 이긴다
    const m = mergeOcrResults([wrong, spaced, tight], 'business_registration')
    expect(m.address, '오독이 첫 답이라는 이유로 이겼다 — 공백 정규화가 죽었다').not.toContain('특벨')
  })

  it('⑮ 하나도 안 읽혔으면 정직하게 실패한다 (빈 값을 지어내지 않는다)', () => {
    const none = [parseOcrText('{"biz_name":null,"address":null,"owner_name":null,"biz_number":null,"permit_date":null}', 'business_registration')]
    const m = mergeOcrResults(none, 'business_registration')
    expect(m.ok).toBe(false)
    expect(m.bizNumber).toBeNull()
  })

  it('⑯ 몇 번 중 몇 번 읽혔는지 말한다 — 어드민이 판정의 단단함을 알아야 한다', () => {
    const padded: OcrDocResult[] = [...LIVE, parseOcrText('', 'business_registration')]
    const m = mergeOcrResults(padded, 'business_registration')
    expect(m.message).toMatch(/\d+\/\d+회 읽음/)
  })
})
