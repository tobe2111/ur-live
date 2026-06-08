// ──────────────────────────────────────────────────────────────
// 🏪 유통스타트 도매몰 — 표준 쇼핑몰 푸터 (라이트 B2B 서피스)
//   도매몰은 라이트 고정 — dark: variant 없음 (대시보드 계열 잠금).
//   레퍼런스: 한국형 쇼핑몰 하단 푸터(회사소개·약관 링크 행 + 사업자정보 +
//   고객상담센터 + 무통장입금안내 + 저작권/지재권 밴드 + PG/에스크로 배지).
// ──────────────────────────────────────────────────────────────
import { WT } from './wholesale-theme'

// 🏢 사업자정보 — 리스터코퍼레이션(유어팀) 공식 정보. 한 곳만 고치면 푸터 전체 반영.
const BUSINESS_INFO = {
  corp: '리스터코퍼레이션',
  brand: '유어팀',
  ceo: '정지원',
  bizRegNo: '479-09-02930',
  repPhone: '0503-7151-4726',
  headOffice: '서울특별시 강남구 남부순환로 357길 14, 3F',
  logistics: '인천광역시 부평구 주부토로 236, U1센터 C동 109호',
  privacyManager: '정지원',
  csEmail: 'jiwon@ur-team.com',
  csHours: '평일 10:00 ~ 17:00 (점심 12:00 ~ 13:00)',
  csClosed: '주말 · 공휴일 휴무',
} as const

// 상단 링크 행 (좌측 회사/정책 + 우측 입점/제휴 액션)
// 실존 라우트는 그대로 연결, 없으면 placeholder(#) + TODO.
const INFO_LINKS: { label: string; href: string; todo?: boolean }[] = [
  { label: '회사소개', href: '/wholesale/intro' },
  { label: '이용약관', href: '/terms' },
  { label: '개인정보처리방침', href: '/privacy' },
]

const ACTION_LINKS: { label: string; href: string; todo?: boolean }[] = [
  { label: '입점매장안내', href: '/wholesale/intro' },
  { label: '상품제휴', href: '/wholesale/oem' }, // OEM/ODM = 상품제휴/제조
  { label: '입점신청', href: '/supplier/register' }, // 제조(브랜드)회원 입점
]

// PG / 에스크로 / 배송 / 신뢰 배지 — 실제 배지 이미지가 assets 에 없어 텍스트 칩으로 대체.
const TRUST_BADGES: string[] = [
  'KCP 결제',
  '구매안전(에스크로)',
  '국민은행 안심거래',
  '대한통운 택배',
  '공정위 표준약관',
  '현금영수증',
  'COMODO SSL',
]

export default function WholesaleFooter() {
  return (
    <footer className="mt-14 border-t" style={{ background: WT.fill, borderColor: WT.line, color: WT.ink2 }}>
      {/* 상단 링크 행 — 좌 회사/정책 · 우 입점/제휴 */}
      <div className="border-b" style={{ borderColor: WT.line }}>
        <div className="ur-content-wide px-5 lg:px-8 py-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] font-bold" style={{ color: WT.ink }}>
            {INFO_LINKS.map((l) => (
              <a key={l.label} href={l.href} className="hover:underline whitespace-nowrap" style={{ color: WT.ink }}>
                {l.label}
              </a>
            ))}
          </nav>
          <nav className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] font-medium" style={{ color: WT.ink3 }}>
            {ACTION_LINKS.map((l, i) => (
              <span key={l.label} className="inline-flex items-center gap-3">
                {i > 0 && <span aria-hidden style={{ color: WT.ink4 }}>·</span>}
                <a href={l.href} className="hover:underline whitespace-nowrap" style={{ color: WT.ink3 }}>{l.label}</a>
              </span>
            ))}
          </nav>
        </div>
      </div>

      {/* 본문 — 사업자정보 + 고객상담센터 + 무통장입금 */}
      <div className="ur-content-wide px-5 lg:px-8 py-7">
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-7 lg:gap-9">

          {/* 사업자정보 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md text-white font-extrabold text-[11px]" style={{ background: WT.brand }}>유</span>
              <span className="text-[14px] font-extrabold" style={{ color: WT.ink }}>유통스타트 도매몰</span>
            </div>
            <div className="text-[12px] leading-relaxed" style={{ color: WT.ink3 }}>
              <p>
                <b style={{ color: WT.ink2 }}>{BUSINESS_INFO.brand}</b>
                <span className="mx-1.5" style={{ color: WT.ink4 }}>|</span>
                {BUSINESS_INFO.corp}
                <span className="mx-1.5" style={{ color: WT.ink4 }}>|</span>
                대표 {BUSINESS_INFO.ceo}
              </p>
              <p>사업자등록번호 {BUSINESS_INFO.bizRegNo}</p>
              <p>본사 {BUSINESS_INFO.headOffice}</p>
              <p>인천 물류센터 {BUSINESS_INFO.logistics}</p>
              <p>개인정보관리책임자 {BUSINESS_INFO.privacyManager}</p>
            </div>
          </div>

          {/* 고객센터 및 제휴문의 */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] font-bold" style={{ color: WT.ink3 }}>고객센터 및 제휴문의</p>
            <a href={`tel:${BUSINESS_INFO.repPhone}`} className="text-[24px] font-extrabold leading-none" style={{ color: WT.ink }}>
              {BUSINESS_INFO.repPhone}
            </a>
            <a href={`mailto:${BUSINESS_INFO.csEmail}`} className="text-[13px] font-bold hover:underline" style={{ color: WT.brand }}>
              {BUSINESS_INFO.csEmail}
            </a>
            <div className="text-[12px] leading-relaxed" style={{ color: WT.ink3 }}>
              <p>{BUSINESS_INFO.csHours}</p>
              <p>{BUSINESS_INFO.csClosed}</p>
            </div>
            <a
              href={`mailto:${BUSINESS_INFO.csEmail}`}
              className="mt-1 inline-flex w-fit items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-bold text-white"
              style={{ background: WT.ink }}
            >
              제휴 · 1:1 문의하기
            </a>
          </div>
        </div>
      </div>

      {/* PG / 에스크로 / 신뢰 배지 행 */}
      <div className="border-t" style={{ borderColor: WT.line }}>
        <div className="ur-content-wide px-5 lg:px-8 py-4 flex flex-wrap items-center gap-2">
          {TRUST_BADGES.map((b) => (
            <span
              key={b}
              className="inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold"
              style={{ background: '#fff', border: '1px solid ' + WT.line, color: WT.ink3 }}
            >
              {b}
            </span>
          ))}
        </div>
      </div>

      {/* 저작권 / 지식재산권 보호 밴드 (다크) */}
      <div style={{ background: WT.ink }}>
        <div className="ur-content-wide px-5 lg:px-8 py-5 flex flex-col gap-2">
          <p className="text-[11px] leading-relaxed" style={{ color: '#B6BCC4' }}>
            {BUSINESS_INFO.brand}({BUSINESS_INFO.corp})에서 제공하는 모든 상품 이미지 · 콘텐츠 및 디자인의 저작권은
            {' '}{BUSINESS_INFO.corp} 또는 각 공급사에 있으며, 무단 복제 · 배포 · 도용 시 저작권법에 따라
            민 · 형사상 책임을 질 수 있습니다. 도매 공급가 및 거래 정보는 회원 외부 유출을 금합니다.
          </p>
          <p className="text-[11px]" style={{ color: '#8A929E' }}>
            Copyright © {BUSINESS_INFO.corp} ({BUSINESS_INFO.brand}). All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
