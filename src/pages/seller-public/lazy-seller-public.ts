/**
 * 🏪 사업자 유어샵 페이지(`SellerPublicPage`)의 **하나뿐인** lazy 래퍼 (2026-10-15).
 *
 * 같은 페이지를 두 곳이 그린다 — `/u/:handle`(CuratorPage 안에서 사업자면 이걸 그린다)과
 * `/profile/:id`·`/s/:id`(seller.routes). 래퍼가 두 벌이면 한쪽이 받아 둔 모듈을 다른 쪽이 모르고
 * "페이지 로딩 중" 을 다시 띄운다(`lib/boot-page` 머리말의 0.5초 공개 지연). 그래서 한 곳에 둔다.
 */
import { lazyPage } from '@/lib/boot-page'

export const SellerPublicPage = lazyPage(() => import('@/pages/SellerPublicPage'))
