/**
 * 🎟️ 이용권 등록 — 마이 안에서 (2026-09-26, 설계 §21)
 *   대표: *"이용권 등록, 숙소까지 해줘"*
 *
 * ## 🔴 폼을 다시 만들지 않는다 — **같은 파일을 연다**
 * 등록 위저드는 3단계(매장·이용권·판매 설정)에 카카오맵 검색 · 사진 업로드 · 실수령가 계산 ·
 * 임시저장(로컬+서버 드래프트)까지 얹힌 495줄짜리 화면이다. 시트용으로 다시 만들면 **반드시
 * 한쪽만 고쳐지고**, 그때부터 두 화면이 서로 다른 상품을 만든다(이 레포가 반복해 당한 클래스).
 * ⇒ `SellerMealVoucherNewPage` 를 `embedded` 로 그대로 연다. 껍데기(`SellerLayout bare`)만 벗고
 *   폼·검증·제출 payload·임시저장은 **한 글자도 안 바뀐다.**
 *
 * ## 🏝️ 라이트 섬
 * 이 페이지와 그 스텝 부품들은 **대시보드 규칙상 `dark:` 가 금지**돼 있다(라이트 고정).
 * 마이는 다크를 지원하므로 그대로 넣으면 다크에서 흰 폼 위에 흰 글자가 난다.
 * ⇒ `light-island` 로 감싼다 — 안쪽 `dark:` 를 끄고 전역 라이트 입력 규칙을 켜는 그 클래스다.
 * ⚠️ **주석(`light-fixed`)이 아니라 클래스여야 한다** — 주석은 런타임에 아무 일도 안 한다
 *   (2026-09-03 지도 검색창이 정확히 그 사고였다).
 *
 * ## ⏳ 열 때 받는다
 * 위저드는 무겁다(지도 SDK·업로드). `lazy` 로 갈라서 **누를 때** 받는다 — 안 그러면 마이 청크가
 * 그만큼 커지고, 등록을 한 번도 안 하는 사람도 그 값을 치른다.
 */
import { Suspense, lazy } from 'react'
import { Loader2 } from 'lucide-react'
import Sheet from './Sheet'

const VoucherWizard = lazy(() => import('@/pages/SellerMealVoucherNewPage'))

export default function VoucherNewSheet({ onClose, onCreated }: {
  onClose: () => void
  /** 등록이 끝났다 — 호출부가 목록을 새로 고치고 시트를 닫는다. */
  onCreated: () => void
}) {
  return (
    <Sheet title="이용권 등록" onClose={onClose} tall>
      {/* 🏝️ 안쪽은 라이트 고정 — 대시보드 폼을 그대로 쓰기 때문이다(위 머리말). */}
      {/* 여백은 `SellerLayout` 의 bare 분기가 준다(2026-09-26) — 여기서 또 주면 두 겹이 된다. */}
      <div className="light-island bg-white min-h-full">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
            </div>
          }
        >
          <VoucherWizard embedded onClose={onClose} onCreated={onCreated} />
        </Suspense>
      </div>
    </Sheet>
  )
}
