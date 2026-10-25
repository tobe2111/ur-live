/**
 * 🦶 홈 크롤러 푸터 — 2026-10-24 (대표 "홈에 짧은 소개 문단과 링크 묶음 … 실제 페이지에 영향이 가지 않으면 작업해줘").
 *
 * ## 왜
 * 네이버 서치어드바이저 실측(2026-10-23): "유어딜" 검색은 노출 32·클릭 8 로 살아 있는데, 그 클릭이 전부
 * 블로그 글(`/blog/safe-payment-system`)로 떨어지고 **홈은 검색 웹문서 TOP 10 에 없다**. 네이버 크롤러(Yeti)가
 * 받는 홈 HTML 을 재 보니 글자 426자 · 링크 5개 · "유어딜이 무엇인가" 를 말하는 문장 0줄이었다 —
 * 크롤러가 폰 첫 화면(카드 4장)을 받고, **폰 홈엔 푸터가 없기 때문**이다(`MobileHomePage` 는 `SiteFooter`
 * 를 안 그린다. PC 홈 `PcHomePage` 만 그린다).
 *
 * ## 무엇을
 * PC 홈이 **이미 화면에 보여 주는** `SiteFooter` 의 내용(브랜드 소개 한 줄 + 링크 세 묶음 + 사업자 정보)을
 * 홈 `#root` 에 `<noscript>` 로 덧붙인다.
 *
 * ## 🔒 사람 화면은 한 픽셀도 안 바뀐다
 * `<noscript>` 는 스크립트가 켜진 브라우저에서 **렌더되지 않는다**(파서가 글자로 취급한다). 그리고 React 가
 * 마운트하며 `#root` 를 통째로 갈아 끼우므로 DOM 에도 남지 않는다. 그래서 첫 화면 밀림·LCP 와 무관하다.
 *
 * ## 🔒 크롤러 전용 문구가 아니다
 * 여기 있는 글자는 전부 **같은 URL 의 PC 화면에 실제로 떠 있는 글자**다(같은 주소를 넓은 화면으로 열면 푸터로
 * 보인다). 지어낸 소개문을 넣지 않는 이유가 그것이다 — 화면에 없는 말을 크롤러에게만 주면 클로킹이다.
 * 그래서 이 목록은 `SiteFooter.tsx` 와 **글자까지 같아야 하고**, 시험이 그 소스를 파싱해 대조한다
 * (`home-footer-noscript-2026-10-24.test.ts`). 푸터를 고치면 여기도 같이 고친다 — 안 고치면 빨간불이다.
 *
 * ## ⚠️ 못 하는 것
 * - JS 를 렌더하는 크롤러(Googlebot)는 렌더된 **폰** 화면을 보므로 이 블록을 쓰지 않는다. 구글엔 효과가 작다.
 * - 네이버가 그 글을 보고 홈을 "유어딜" 결과로 올릴지는 네이버가 정한다(수일~수주, 서치어드바이저로만 보인다).
 */
import { REFERRAL_GROUP_DISCOUNT_DISABLED } from '../../shared/feature-flags'

/** 로고(`UrDealLogo`)의 접근성 이름이 `urdeal — 유어딜` 이다 — 크롤러에겐 그 이름의 한글 부분을 준다. */
export const HOME_FOOTER_BRAND = '유어딜'

/** `SiteFooter` 의 브랜드 소개 문단(화면은 `<br />` 로 두 줄). */
export const HOME_FOOTER_TAGLINE_LINES = ['우리 동네 이용권·공동구매·교환권을', '할인가로, 매장에서 QR로 바로.'] as const

export const HOME_FOOTER_PARTNERSHIP = { href: '/partnership', label: '광고·제휴 문의' } as const

export interface FooterLink { href: string; label: string }
export interface FooterGroup { title: string; links: FooterLink[] }

/** `SiteFooter` 의 링크 세 묶음 — 순서·라벨까지 같다. */
export function homeFooterGroups(): FooterGroup[] {
  return [
    {
      title: '유어딜',
      links: [
        { href: '/about', label: '서비스 소개' },
        { href: '/vouchers', label: '교환권' },
        { href: '/map', label: '동네딜 지도' },
        { href: '/region', label: '지역별 동네딜' },
        { href: '/new-openings', label: '우리 동네 새 가게' },
        { href: '/soon', label: '오픈 예정' },
        { href: '/stays', label: '숙소' },
        { href: '/experience', label: '체험단 모집' },
        { href: '/blog', label: '블로그' },
        { href: '/faq', label: '자주 묻는 질문' },
      ],
    },
    {
      title: '파트너',
      links: [
        { href: '/partners', label: '사장님 가게 입점' },
        { href: '/store/new', label: '내 가게 등록하기' },
        { href: '/area-report', label: '우리 동네 상권 리포트' },
        { href: '/creators', label: '크리에이터 모집' },
        // 화면과 같은 조건 — 꺼져 있으면 화면에도 없다.
        ...(REFERRAL_GROUP_DISCOUNT_DISABLED ? [] : [{ href: '/referral', label: '공구 개최하기' }]),
      ],
    },
    {
      title: '약관·정책',
      links: [
        { href: '/terms', label: '서비스 이용약관' },
        { href: '/terms/seller', label: '판매자 약관' },
        { href: '/privacy', label: '개인정보처리방침' },
        { href: '/refund', label: '배송 및 환불 정책' },
      ],
    },
  ]
}

/** `SiteFooter` 하단 법적 고지 — 화면 문장 그대로. */
export const HOME_FOOTER_LEGAL = [
  '상호명: 리스터코퍼레이션 · 대표자: 정지원 · 사업자등록번호: 479-09-02930 · 통신판매업신고: 2025-부산금정-0540',
  '사업장주소: 서울특별시 강남구 남부순환로359길 14, 3층(도곡동) · 대표이메일: jiwon@ur-team.com',
  '서비스 제공 기간: 상품 구매 후 평균 7일 이내 배송 완료',
  '© 2026 리스터코퍼레이션. All rights reserved.',
] as const

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const a = (l: FooterLink) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`

/** 홈 `#root` 끝에 붙이는 `<noscript><footer>…</footer></noscript>`. 입력이 없어 실패 경로가 없다. */
export function homeFooterNoscript(): string {
  const groups = homeFooterGroups()
    .map(g => `<nav aria-label="${esc(g.title)}"><h3>${esc(g.title)}</h3><ul>${g.links.map(l => `<li>${a(l)}</li>`).join('')}</ul></nav>`)
    .join('')
  const legal = HOME_FOOTER_LEGAL.map(t => `<p>${esc(t)}</p>`).join('')
  return `<noscript><footer><p><strong>${esc(HOME_FOOTER_BRAND)}</strong> ${esc(HOME_FOOTER_TAGLINE_LINES.join(' '))}</p>`
    + `<p>${a(HOME_FOOTER_PARTNERSHIP)}</p>${groups}${legal}</footer></noscript>`
}
