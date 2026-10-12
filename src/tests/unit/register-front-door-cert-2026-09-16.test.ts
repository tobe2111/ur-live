/**
 * 🪪 **앞문에도 등록증 사본을 받는다** (2026-09-16 대표 *"그게 가장 이상적이면 그렇게 해줘"*)
 *
 * ## 왜 — 앞뒤가 뒤집혀 있었다
 * | | 등록증 사본 | 심사 |
 * |---|---|---|
 * | 뒷문 `/store/find`(남의 가게를 내 것이라 주장) | **필수** | 어드민 |
 * | 앞문 `/seller/register/supplier`(새 가게를 만듦) | **없음** | 어드민(대조할 근거 없이) |
 *
 * 가짜 매장은 **앞문으로** 들어온다: 사기꾼이 **자기 진짜 등록증**의 번호·대표자·개업일로
 * 국세청을 통과한 뒤 상호와 주소만 남의 가게로 적으면 된다.
 *
 * ## 🔴 기계로는 못 잡는다 (실측)
 * 국세청 API 는 `b_no`·`start_dt`·`p_nm` 셋만 받고 `valid`·`b_stt` 둘만 준다 —
 * **상호도 주소도 오가지 않는다.** 그래서 어드민이 *타이핑한 상호·주소* vs *등록증 사진* 을
 * 눈으로 대조할 수 있어야 하고, 그러려면 사진이 **도착해 있어야** 한다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - 사진이 **진짜 그 가게의 등록증인지** — 사람이 본다(이 가드는 "도착하는가"까지).
 * - 어드민이 실제로 대조하는지 — 운영이다.
 * - 업로드 컴포넌트 내부 동작(파일 형식·용량) — 그쪽 짝 시험 소관.
 *
 * 🪦 2026-10-12 축소: 옛 가입 폼(`SellerRegisterSupplierPage`)을 지웠다 — 가입 문은 2026-10-10 부터
 *   `/store/new` 하나이고 그 폼은 import 하는 곳이 0 이었다. 폼 화면을 대상으로 하던 단언 넷은
 *   지킬 대상이 사라져 함께 뺐다. 남은 것은 **서버 계약**(`/register-from-user` 의 저장·검증 ·
 *   상태 응답의 도착 여부)이다 — 그 라우트는 아직 마운트돼 있다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { BIZ_CERT_PATH } from '@/worker/utils/store-ownership-claims'

const ROUTE = 'src/features/seller/api/seller-registration.routes.ts'
const SESSION = 'src/features/seller/api/seller-registration/session-routes.ts'
const route = () => stripComments(readFileSync(ROUTE, 'utf-8'))

describe('🪪 가입 앞문 — 등록증 사본', () => {
  it('사본이 아직 없다는 사실을 화면이 알 수 있다 (배너가 읽는 신호)', () => {
    // 🔁 2026-09-16 분해: `/my-seller-status` 는 `seller-registration/session-routes.ts` 로 옮겨졌다.
    const r = stripComments(readFileSync(SESSION, 'utf-8'))
    expect(r, '상태 응답에 도착 여부가 없으면 배너가 무엇을 말할지 정할 수 없다')
      .toContain('has_business_cert')
    expect(r, '등록증 **URL 을 내보내면** 남의 서류 주소가 응답에 실린다 — boolean 이면 충분하다')
      .toMatch(/has_business_cert:\s*!!/)
  })

  /**
   * 🩸 첫 판은 파일 전체에서 `BIZ_CERT_PATH` · `'pending'` 을 찾았는데 **둘 다 그 파일 다른 곳에
   *   이미 있었다**(import · 다른 상태값) — 주입이 저장 줄을 통째로 망가뜨려도 초록이었다.
   *   ⇒ **INSERT 가 실제로 바인딩하는 구간**만 잘라서 본다.
   */
  const insertBinds = () => {
    const r = route()
    const i = r.indexOf('INSERT INTO sellers')
    expect(i, 'sellers INSERT 를 못 찾았다 — 구조가 바뀌었다(통과 아님)').toBeGreaterThan(-1)
    const end = r.indexOf('.run()', i)
    expect(end, 'bind 체인의 끝을 못 찾았다').toBeGreaterThan(i)
    return r.slice(i, end)
  }

  it('서버가 받아서 sellers 에 저장한다 — 어드민 화면이 읽는 그 컬럼', () => {
    expect(route()).toContain('business_cert_url')
    const b = insertBinds()
    expect(b, '어드민 승인 화면이 보는 컬럼이 아니면 대조할 수 없다').toContain('business_registration_image_url')
    expect(b, "사본이 있으면 '검수 대기'여야 어드민이 승인/반려를 누를 수 있다").toContain("'pending'")
  })

  it('🔒 임의 URL 을 저장하지 않는다 — 우리 업로드 자리만', () => {
    // 🩸 두 번 헛돌았다: ① 파일 전체에서 `BIZ_CERT_PATH` 를 찾았더니 **import 줄**에 이미 있어
    //   통과 ② bind 구간으로 좁혔더니 **다음 줄**에도 같은 이름이 있어 또 통과.
    //   ⇒ 가드를 통과한 값(`certStored`)만 bind 에 들어가는지, 날 입력은 안 새는지 본다.
    const r = route()
    expect(r, '검증을 거친 값이 없으면 임의 URL 이 그대로 저장된다')
      .toMatch(/const\s+certStored\s*=\s*BIZ_CERT_PATH\.test\(certUrl\)\s*\?\s*certUrl\s*:\s*null/)
    const b = insertBinds()
    expect(b, 'bind 가 검증된 값을 안 쓰면 위 const 는 장식이다').toContain('certStored')
    expect(b, '검증을 안 거친 날 입력이 bind 에 섞여 있다').not.toMatch(/\bbusiness_cert_url\b/)
  })
})
