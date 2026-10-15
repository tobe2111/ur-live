/**
 * 🧊 이용권 상세(`/pass/:id`) **서버 렌더 진입점** — 워커가 부른다(2026-10-15 서버 렌더 3단계).
 *
 * **앱 전체를 그대로** 문자열로 그린다(상단 머리·하단 탭·페이지). 브라우저는 그 화면을 버리지 않고
 * `hydrateRoot` 로 **이어받는다**(`main.tsx`) — 다시 그리지 않으므로 누를 수 있는 시점이 늦어지지 않는다.
 *
 * 이어받기가 성립하려면 서버와 브라우저의 **첫 렌더가 글자 하나까지 같아야** 한다. 그래서 여기서는
 * 사본을 만들지 않고 브라우저와 **같은 모듈**을 쓴다:
 *   - 앱: `App` + `ThemeProvider`(main.tsx 와 같은 트리) — 라우터만 StaticRouter, QueryClient 만 요청마다 새것
 *   - 문구: `@/i18n` 그대로 — `i18nReady` 가 풀린 뒤(critical + 한국어 core) 그린다. 브라우저도 같은 약속을 기다린 뒤 이어받는다
 *   - 페이지 모듈: `preloadBootPage('gbDetail')` — 브라우저 부팅과 같은 함수로 미리 준비해 lazy 가 서버에서도 즉시 그려진다
 *   - 데이터: 상품 시드를 요청 QueryClient 에 넣는다. 브라우저는 같은 시드를 `__SSR_INITIAL_DETAIL__` 에서 읽는다
 * 사람마다 다른 값(로그인·잔액·위치·화면 폭)은 서버 스냅샷(비어 있음)으로 그려지고, 이어받은 **뒤에** 브라우저가 채운다.
 *
 * 빌드: `vite build -c vite.ssr-pass.config.ts` → `dist/ssr-pass/pass-detail-entry.js`(워커용 한 파일) →
 *   워커 esbuild 가 `virtual:pass-ssr` 로 묶는다(없으면 스텁 — 종전 손그림 첫 화면).
 */
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { QueryClient } from '@tanstack/react-query'
import { i18nReady } from '@/i18n'
import App, { type RouterLike } from '@/App'
import ThemeProvider from '@/components/ThemeProvider'
import { preloadBootPage } from '@/lib/boot-page'
import { queryKeys } from '@/hooks/queries/queryKeys'

/** 브라우저 `App` 의 기본 라우터 옵션과 같아야 한다(상대 경로 링크 해석이 갈리면 href 가 갈린다). */
const ROUTER_FUTURE = { v7_startTransition: false, v7_relativeSplatPath: true }

let ready: Promise<unknown> | null = null
/** 첫 요청에서 한 번만 — 문구와 페이지 모듈. 실패해도 다음 요청이 다시 시도한다. */
function ensureReady(): Promise<unknown> {
  if (!ready) ready = Promise.all([i18nReady, preloadBootPage('gbDetail')]).catch((e) => { ready = null; throw e })
  return ready
}

/**
 * 상품 시드(`/api/group-buy/products/:id` 의 data)로 앱 전체를 그린다. `url` 은 경로 + 쿼리(브라우저 주소와 같아야 한다).
 * 실패하면 던진다 — 호출부가 종전 첫 화면으로 폴백.
 */
export async function renderPassApp(product: { id: number } & Record<string, unknown>, url: string): Promise<string> {
  await ensureReady()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } })
  qc.setQueryData(queryKeys.groupBuyProduct(product.id), product)
  try {
    return renderToString(
      <ThemeProvider>
        <App
          Router={StaticRouter as unknown as RouterLike}
          routerProps={{ location: url, future: ROUTER_FUTURE }}
          queryClient={qc}
        />
      </ThemeProvider>,
    )
  } finally {
    qc.clear()
  }
}
