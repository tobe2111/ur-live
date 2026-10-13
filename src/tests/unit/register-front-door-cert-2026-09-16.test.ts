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
 * 🪦 2026-10-12 2차 축소: 서버 가입 라우트 둘(`/register-from-user` · `/register`)도 부르는 화면이 0 이라
 *   지웠다. 그 INSERT 에 걸려 있던 저장·검증 단언 둘도 지킬 코드가 사라져 뺐다. 남은 것은 **상태 응답이
 *   사본 도착 여부를 boolean 으로만 알려 준다** 하나다(그 응답은 지금 매장 등록 문 매장도 읽는다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const SESSION = 'src/features/seller/api/seller-registration/session-routes.ts'

describe('🪪 가입 앞문 — 등록증 사본', () => {
  it('사본이 아직 없다는 사실을 화면이 알 수 있다 (배너가 읽는 신호)', () => {
    // 🔁 2026-09-16 분해: `/my-seller-status` 는 `seller-registration/session-routes.ts` 로 옮겨졌다.
    const r = stripComments(readFileSync(SESSION, 'utf-8'))
    expect(r, '상태 응답에 도착 여부가 없으면 배너가 무엇을 말할지 정할 수 없다')
      .toContain('has_business_cert')
    expect(r, '등록증 **URL 을 내보내면** 남의 서류 주소가 응답에 실린다 — boolean 이면 충분하다')
      .toMatch(/has_business_cert:\s*!!/)
  })
})
