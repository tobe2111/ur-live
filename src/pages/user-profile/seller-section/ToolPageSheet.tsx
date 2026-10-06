/**
 * 🪟 **셀러 화면 전부가 마이 시트 안에서 — 라우트 표를 그대로 렌더한다** (2026-09-26)
 *   대표: *"드물게 하는 일도 일단 마이로 하고, 대시보드는 쓸 필요없게끔 하자"*
 *
 * ## 🔴 손으로 적은 지도를 버렸다 — 왜
 * 첫 판은 `주소 → 화면 모듈` 36줄을 손으로 적었다. 두 가지를 못 했다:
 *   ① **파라미터 화면**(`/seller/products/:id/edit`)은 주소를 미리 적을 수 없다. id 를 아는 건 목록뿐이다.
 *   ② 시트 안 목록이 `navigate()` 하면 **마이가 통째로 그 주소로 떠났다** — 시트만 닫히는 게 아니다.
 *      "저장하면 목록으로" 같은 마무리가 있는 화면은 열 때마다 마이 밖으로 나갔다.
 *
 * ⇒ **`MemoryRouter` 안에 실제 라우트 표(`SellerRoutes()`)를 넣는다.** 그러면
 *   · 모든 셀러 주소가 열린다(파라미터 포함) — 지도가 필요 없다. **라우트 표가 지도다.**
 *   · 시트 안 `<Link>`·`navigate()` 가 **시트 안에서** 움직인다(마이는 그대로 있다).
 *   · 화면은 여전히 **대시보드가 쓰는 바로 그 파일**이다. 복제 0.
 *   · 손으로 적은 목록이 없으니 **낡을 수도 없다**(드리프트 0).
 *
 * ## 히스토리를 브라우저에 쌓지 않는다
 * `MemoryRouter` 는 자기 히스토리를 메모리에 갖는다 — 주소창도, 브라우저 뒤로가기도 안 건드린다.
 * **일부러 그렇게 했다**: 시트 안 이동을 브라우저 히스토리에 쌓으면 뒤로가기를 몇 번 눌러야 마이로
 * 나오는지 아무도 예측할 수 없다. 규칙은 하나다 — **뒤로가기 = 시트 닫기**(`Sheet` 가 칸 하나만 쌓는다),
 * **시트 안 되돌아오기 = 머리의 ‹ 버튼**.
 *
 * ## 🚪 셀러 밖으로 나가려 하면 진짜로 나간다
 * 안쪽 화면이 `/`·`/u/me` 처럼 셀러 밖을 가리킬 수 있다. 메모리 라우터엔 그 주소가 없으므로
 * 그대로 두면 **빈 화면**이 된다. `*` 로 받아서 시트를 닫고 바깥 라우터로 보낸다.
 *
 * ## 🏝️ 라이트 섬이 **주석이 아니라 클래스**여야 하는 이유
 * 대시보드 화면은 규칙상 `dark:` 가 금지돼 있다(라이트 고정). 마이는 다크를 지원한다. 그대로 넣으면
 * 전역 `.dark input`(특이도 0,5,1)이 흰 폼 위에 흰 글자를 만든다 — 2026-09-03 지도 검색창이
 * 정확히 그 사고였고 그때도 주석(`light-fixed`)은 달려 있었다.
 *
 * ## ⚠️ 이 시트가 못 하는 것 (정직하게)
 * - **폰용으로 다시 그리지 않았다.** 안에 들어간 것은 PC 폭을 전제로 만든 화면이다. 열리고
 *   동작하지만 손으로 만든 시트만큼 폰에 맞진 않다 — 그게 다음 일(UI 정리)이다.
 * - 안쪽에서 `window.location.assign()` 을 쓰는 화면은 여전히 통째로 이동한다(라우터 밖이다).
 */
import { Suspense, useCallback, useRef, useState } from 'react'
import {
  MemoryRouter, Route, Routes, useLocation, useNavigate,
  UNSAFE_LocationContext, UNSAFE_RouteContext,
} from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import ErrorBoundary from '@/components/ErrorBoundary'
import { SellerEmbedProvider } from '@/shared/seller-embed'
import { SellerRoutes } from '@/routes/seller.routes'
import Sheet from './Sheet'

/**
 * 🔌 **바깥 라우터와의 줄을 끊는다** — 이게 없으면 시트는 열리는 순간 터진다 (2026-09-28).
 *
 * ## 무슨 일이 있었나
 * ```
 * Error: You cannot render a <Router> inside another <Router>.
 * ```
 * 앱은 `BrowserRouter` 로 감싸여 있는데(`App.tsx`) 이 시트가 그 **안에** `MemoryRouter` 를 또 넣는다.
 * react-router v6 은 중첩 라우터를 금지한다 — 그래서 `ToolPageSheet` 는 **한 번도 동작한 적이 없었다.**
 * 아무도 몰랐던 이유: 이 경로를 지키던 시험이 전부 텍스트 가드라 "배선이 있는가" 만 봤고,
 * 프로덕션 빌드는 `drop_console: true` + react-router 의 메시지 제거로 화면에 `Error` 만 남았다.
 *
 * ## 왜 컨텍스트를 끊는가 (다른 길을 안 고른 이유)
 * - `<Routes location={…}>` 로 중첩을 피할 수는 있다. 그런데 그러면 안쪽 `navigate()`·`<Link>` 가
 *   **바깥 라우터를 움직인다** — 마이가 통째로 그 주소로 떠난다. 2026-09-26 이 `MemoryRouter` 를
 *   고른 이유가 정확히 그 문제였다. 고치려다 그 문제를 도로 불러오는 셈이다.
 * - 별도 React 루트로 띄우면 격리는 완전하지만 QueryClient·테마·i18n 을 다시 얹어야 하고,
 *   그 이음매가 새 사고 자리가 된다.
 * ⇒ **줄만 끊으면** 안쪽은 자기 라우터를 가진 최상위가 되고, 바깥은 아무것도 모른다.
 *
 * ## 무엇을 끊나 (둘 다 필요하다)
 * - `LocationContext` → `null`: react-router 의 `useInRouterContext()` 가 이 값을 보고
 *   "이미 라우터 안" 을 판정한다. 끊어야 위 invariant 를 지난다.
 * - `RouteContext` → 빈 matches: 안 끊으면 안쪽 절대경로(`/seller/tier`)가 바깥이 매치한
 *   `/user/profile` **아래로 중첩된 것**으로 계산돼 또 터진다.
 *
 * ⚠️ `UNSAFE_` 접두사는 react-router 가 **내부 구조가 바뀔 수 있다**고 경고하는 뜻이다(사설 API 는 아니다).
 *   버전을 올릴 때 깨질 수 있는 자리이므로 **렌더 시험이 이 파일을 지킨다**
 *   (`src/tests/unit/tool-page-sheet-renders-2026-09-28.test.tsx` — 터지면 거기서 빨간불).
 */
function RouterReset({ children }: { children: React.ReactNode }) {
  return (
    <UNSAFE_LocationContext.Provider value={null as never}>
      <UNSAFE_RouteContext.Provider value={{ outlet: null, matches: [], isDataRoute: false }}>
        {children}
      </UNSAFE_RouteContext.Provider>
    </UNSAFE_LocationContext.Provider>
  )
}

/**
 * 안쪽 라우터의 현재 위치를 바깥(시트 머리)에 알려 주고, 되돌아오기 손잡이를 넘긴다.
 * ⚠️ 렌더 중에 부모 상태를 바꾸면 경고가 난다 — `useLocation` 값이 바뀔 때만 올린다.
 */
function InnerBridge({ onDepth, backRef }: {
  onDepth: (deeper: boolean) => void
  backRef: React.MutableRefObject<(() => void) | null>
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const first = useRef(location.pathname)
  backRef.current = () => navigate(-1)
  const deeper = location.pathname !== first.current
  const last = useRef(deeper)
  if (last.current !== deeper) { last.current = deeper; onDepth(deeper) }
  return null
}

/** 셀러 밖 주소를 안쪽에서 열려고 했다 — 시트를 닫고 바깥 라우터로 넘긴다. */
function Escape({ onLeave }: { onLeave: (path: string) => void }) {
  const location = useLocation()
  const fired = useRef(false)
  if (!fired.current) { fired.current = true; onLeave(location.pathname + location.search) }
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
    </div>
  )
}

export default function ToolPageSheet({ path, title, onClose, onLeave }: {
  /** 처음 열 주소. 이 뒤로는 안쪽 라우터가 스스로 움직인다. */
  path: string
  /** 시트 머리 이름 — 나브 색인의 라벨을 그대로 받는다(여기서 다시 짓지 않는다). */
  title: string
  onClose: () => void
  /** 안쪽이 셀러 밖으로 나가려 한다 — 호출부가 시트를 닫고 그 주소로 보낸다. */
  onLeave: (path: string) => void
}) {
  const [deeper, setDeeper] = useState(false)
  const backRef = useRef<(() => void) | null>(null)
  const back = useCallback(() => { backRef.current?.() }, [])

  return (
    <Sheet title={title} onClose={onClose} onBack={deeper ? back : undefined} tall>
      {/* 🏝️ 안쪽은 라이트 고정 — 대시보드 화면을 그대로 쓰기 때문이다(위 머리말). */}
      <div className="light-island ur-embed-sheet bg-white min-h-full">
        {/* 🪟 껍데기(사이드바·상단바·하단 탭)를 벗기는 신호. 페이지는 이걸 몰라도 된다. */}
        <SellerEmbedProvider>
          <RouterReset>
          <MemoryRouter initialEntries={[path]}>
            <InnerBridge onDepth={setDeeper} backRef={backRef} />
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
                </div>
              }
            >
              {/* 🛡️ 안쪽 화면이 throw 하면 **마이가 통째로** 하얘진다(바운더리가 마이 위에 있다).
                  시트 안에 하나 두면 사고가 시트 안에 머문다 — 41개 화면을 한 자리로 막는다. */}
              <ErrorBoundary>
                <Routes>
                  {SellerRoutes()}
                  <Route path="*" element={<Escape onLeave={onLeave} />} />
                </Routes>
              </ErrorBoundary>
            </Suspense>
          </MemoryRouter>
          </RouterReset>
        </SellerEmbedProvider>
      </div>
    </Sheet>
  )
}
