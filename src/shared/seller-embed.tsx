/**
 * 🪟 **대시보드 화면이 마이 시트 안에서 열린다 — 그 신호 하나** (2026-09-26)
 *   대표: *"모두 다 마이로 가능하게끔 하고"*
 *
 * ## 왜 prop 이 아니라 context 인가
 * `SellerLayout` 은 이미 `bare` prop 을 갖고 있고, 이용권 등록 위저드가 그걸로 마이 시트 안에서
 * 돈다. 그런데 그 길은 **페이지마다 `embedded` prop 을 손으로 뚫어야** 한다 — 셀러 화면은 41개이고,
 * 41번 뚫으면 그중 몇 개는 반드시 빠진다. 하필 빠진 화면이 시트에서 열리면 **시트 안에 사이드바와
 * 하단 탭이 통째로 들어간다.**
 *
 * context 면 페이지는 **한 글자도 안 바뀐다.** 시트가 감싸고, `SellerLayout` 이 읽는다.
 * 41개가 한 번에 따라오고, 새로 생기는 화면도 자동으로 따라온다.
 *
 * ## 이 값이 정하지 않는 것
 * **권한·좌석·대상은 여기서 정하지 않는다.** 토큰이 정한다(§15-3). 이건 순전히 *껍데기를 그릴까*
 * 하는 표시이고, 서버는 이 값을 보지도 못한다. 시트가 열렸다는 사실만으로 할 수 있는 일이
 * 늘어나면 안 된다 — 늘어나는 순간 "시트로 열면 통과되는 문" 이 생긴다.
 *
 * ## 기본값이 false 인 이유
 * 대시보드로 직접 들어온 사람(북마크·검색·카톡 링크)은 껍데기가 **있어야** 한다. 그쪽이 절대
 * 다수이므로 기본값은 종전 그대로이고, 시트만 예외를 켠다.
 */
import { createContext, useContext, type ReactNode } from 'react'

const SellerEmbedContext = createContext(false)

/** 이 안에서 렌더되는 셀러 화면은 껍데기를 벗는다. 시트가 감싼다. */
export function SellerEmbedProvider({ children }: { children: ReactNode }) {
  return <SellerEmbedContext.Provider value={true}>{children}</SellerEmbedContext.Provider>
}

/** 지금 이 화면이 마이 시트 안인가. `SellerLayout` 만 읽으면 된다(페이지는 몰라도 된다). */
export function useSellerEmbedded(): boolean {
  return useContext(SellerEmbedContext)
}
