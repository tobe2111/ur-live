/**
 * 🧊 이용권 상세(`/pass/:id`) **서버 렌더 진입점** — 워커가 부른다(2026-10-15 서버 렌더 3단계).
 *
 * 페이지 컴포넌트(`GroupBuyDetailPage`) **그대로**를 문자열로 그린다. 손으로 옮긴 사본이 아니라 같은 코드라
 * 브라우저가 마운트해 다시 그린 결과와 글자·박스가 같다(사람마다 다른 자리 — 로그인·잔액·거리 — 는 비운 채).
 *
 * 빌드: `vite build -c vite.ssr-pass.config.ts` → `dist/ssr-pass/pass-detail-entry.js`(워커용 한 파일) →
 *   워커 esbuild 가 `virtual:pass-ssr` 로 묶는다(없으면 스텁 — 종전 손그림 첫 화면).
 */
import { createElement as h } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import i18n from '@/lib/i18n-lite'
import ko from '../../public/locales/ko/translation.json?i18n-core'
import GroupBuyDetailPage from '@/pages/GroupBuyDetailPage'
import { queryKeys } from '@/hooks/queries/queryKeys'

let i18nReady = false
function ensureI18n() {
  if (i18nReady) return
  i18n.init({ lng: 'ko', fallbackLng: 'ko', resources: { ko: { translation: ko as Record<string, unknown> } } } as never)
  i18nReady = true
}

/** 상품 시드(`/api/group-buy/products/:id` 의 data)로 상세를 그린다. 실패하면 던진다 — 호출부가 종전 첫 화면으로 폴백. */
export function renderPassDetail(product: { id: number } & Record<string, unknown>, path: string): string {
  ensureI18n()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } })
  qc.setQueryData(queryKeys.groupBuyProduct(product.id), product)
  return renderToString(
    h(HelmetProvider, { context: {} },
      h(QueryClientProvider, { client: qc },
        h(StaticRouter, { location: path },
          h(Routes, null,
            h(Route, { path: '/pass/:id', element: h(GroupBuyDetailPage) }),
          ),
        ),
      ),
    ),
  )
}
