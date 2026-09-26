/**
 * 🪟 **아무 셀러 화면이나 마이 시트 안에서** (2026-09-26)
 *   대표: *"모두 다 마이로 가능하게끔 하고"*
 *
 * ## 이 파일이 하는 일은 딱 하나다 — 감싸기
 * 화면은 **대시보드가 쓰는 바로 그 파일**이고(`tool-pages.ts`), 여기서는 시트 안에 놓고
 * 껍데기를 벗기고 라이트로 고정할 뿐이다. 로직·API·검증은 한 글자도 안 지난다.
 *
 * ## 🏝️ 라이트 섬이 **주석이 아니라 클래스**여야 하는 이유
 * 대시보드 화면은 규칙상 `dark:` 가 금지돼 있다(라이트 고정). 마이는 다크를 지원한다.
 * 그대로 넣으면 전역 `.dark input`(특이도 0,5,1)이 흰 폼 위에 흰 글자를 만든다 —
 * 2026-09-03 지도 검색창이 정확히 그 사고였고, 그때도 주석(`light-fixed`)은 달려 있었다.
 * `light-island` 는 **런타임에 실제로 일하는** 클래스다(안쪽 `dark:` 차단 + 라이트 입력 규칙).
 *
 * ## ⏳ `lazy` 는 렌더 중에 만들면 안 된다
 * `lazy()` 를 렌더 본문에서 부르면 **매 렌더마다 새 컴포넌트 타입**이 나와 React 가 트리를
 * 통째로 다시 마운트한다 — 입력하던 글자가 사라지고 스크롤이 튄다. `useMemo` 로 주소당 한 번만.
 *
 * ## ⚠️ 이 시트가 **못** 막는 것 (정직하게)
 * 안에서 열린 화면이 스스로 `navigate()` 하면(저장 후 목록으로 가는 화면들) 마이가 통째로
 * 그 주소로 이동한다 — 시트만 닫히는 게 아니다. 그때 도착 화면 맨 위에는 "마이로 돌아가기"
 * 띠가 뜨므로 **길을 잃지는 않지만**, 시트가 닫히며 마이로 돌아오는 것과는 다르다.
 * 종전(전체화면으로 보내던 때)과 같은 동작이라 회귀는 아니고, 개선 여지로 남는다.
 */
import { Suspense, lazy, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { SellerEmbedProvider } from '@/shared/seller-embed'
import { TOOL_PAGES } from './tool-pages'
import Sheet from './Sheet'

export default function ToolPageSheet({ path, title, onClose }: {
  /** 열 화면의 주소. `TOOL_PAGES` 에 없으면 호출부가 애초에 이 시트를 안 연다. */
  path: string
  /** 시트 머리 이름 — 나브 색인의 라벨을 그대로 받는다(여기서 다시 짓지 않는다). */
  title: string
  onClose: () => void
}) {
  const Page = useMemo(() => {
    const load = TOOL_PAGES[path]
    return load ? lazy(load) : null
  }, [path])

  return (
    <Sheet title={title} onClose={onClose} tall>
      {/* 🏝️ 안쪽은 라이트 고정 — 대시보드 화면을 그대로 쓰기 때문이다(위 머리말). */}
      <div className="light-island bg-white min-h-full">
        {Page ? (
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
              </div>
            }
          >
            {/* 🪟 껍데기(사이드바·상단바·하단 탭)를 벗기는 신호. 페이지는 이걸 몰라도 된다. */}
            <SellerEmbedProvider>
              <Page />
            </SellerEmbedProvider>
          </Suspense>
        ) : (
          <p className="px-4 py-12 text-center text-[13.5px] text-gray-500">
            이 화면은 전체 화면에서 열려요.
          </p>
        )}
      </div>
    </Sheet>
  )
}
