// ──────────────────────────────────────────────────────────────
// 🏪 유통스타트 도매몰 — 푸터 (2026-06-16 시안 정렬 — 유통스타트 도매몰.dc.html)
//   신뢰 배지 행 + (좌: 로고·사업자정보·정책 링크 / 우: 고객센터·제휴문의). 라이트 고정.
//   🏢 2026-07-04 (대표 — "푸터 사업자정보·로고도 몰마다 다름"): 몰별 company_json 오버레이 —
//   useBusinessInfo() 가 몰 설정을 기본(BUSINESS_INFO) 위에 병합. 미설정 몰(유통스타트)은 byte-불변.
// ──────────────────────────────────────────────────────────────
import { WT } from './wholesale-theme'
import { WholesaleWordmark } from '../wholesale-catalog/WholesaleLogo'
import { useWholesaleMall } from '@/hooks/queries/useWholesale'
import { cfImage } from '@/utils/cf-image'

// 🏢 기본 사업자정보 — 사람과고리 공식 정보(2026-06-16 사용자 제공). 몰 company_json 미설정 시 폴백 SSOT.
export const BUSINESS_INFO = {
  company: '사람과고리',
  ceo: '송유미',
  bizRegNo: '108-20-56790',
  mailOrderNo: '제 20174-서울중구-0242호',
  tel: '02-2038-0996',
  fax: '0303-3443-4424',
  address: '서울 중구 동호로33길 24(오장동, 센트마 4093호)',
  // 🏦 입금 은행 — 우체국 (2026-06-18 사용자 제공). bankNo 채우면 무통장입금 안내가 자동 노출.
  bankName: '우체국',
  bankNo: '014084-02-129530',
  bankHolder: '사람과고리(송유미)',
  csEmail: 'utongstart@naver.com',
} as const

export type BusinessInfo = { [K in keyof typeof BUSINESS_INFO]: string }

/**
 * 🏢 현재 몰의 사업자정보 — wholesale_malls.company_json(어드민 몰 관리에서 편집)을 기본값 위에 병합.
 *   설정된 키만 덮어씀 → 유통스타트(미설정)는 기존과 byte-동일. 푸터/고객센터/약관이 공용 소비.
 */
export function useBusinessInfo(): BusinessInfo {
  const { company } = useWholesaleMall()
  if (!company) return BUSINESS_INFO
  const merged: Record<string, string> = { ...BUSINESS_INFO }
  for (const [k, v] of Object.entries(company)) if (typeof v === 'string' && v.trim()) merged[k] = v
  return merged as BusinessInfo
}

// 정책/안내 링크 (시안: 회사소개 · 이용약관 · 개인정보처리방침 · 입점안내)
const FOOTER_LINKS: { label: string; href: string }[] = [
  { label: '회사소개', href: '/wholesale/intro' },
  { label: '이용약관', href: '/wholesale/terms' },
  { label: '개인정보처리방침', href: '/wholesale/privacy' },
  { label: '입점안내', href: '/wholesale/start' },
]

export default function WholesaleFooter() {
  const biz = useBusinessInfo()
  // 🖼️ 몰 로고 — 어드민 몰 관리에서 설정 시 워드마크 대신 이미지(높이 26 고정). 미설정=기존 워드마크.
  const { logoUrl, displayName } = useWholesaleMall()
  return (
    <footer className="mt-6" style={{ background: '#fff', borderTop: '1px solid ' + WT.line }}>
      <div className="ur-content-wide px-5 lg:px-8 py-7">
        {/* 본문 — 좌 사업자정보 / 우 고객센터 */}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-6 sm:gap-8 pt-5" style={{ borderTop: '1px solid ' + WT.line }}>
          {/* 좌 — 로고 + 사업자정보 + 정책 링크 */}
          <div className="text-[12.5px] leading-[1.8]" style={{ color: WT.ink3 }}>
            <div className="mb-2.5">
              {logoUrl
                ? <img src={cfImage(logoUrl, { width: 156 })} alt={displayName} style={{ height: 26, width: 'auto' }} />
                : <WholesaleWordmark height={26} />}
            </div>
            {biz.company} · 대표 {biz.ceo} · 사업자등록번호 {biz.bizRegNo}<br />
            통신판매신고 {biz.mailOrderNo}<br />
            주소 {biz.address}<br />
            {biz.bankNo && <>무통장 입금 {biz.bankName} {biz.bankNo} 예금주 {biz.bankHolder}<br /></>}
            <span className="inline-flex flex-wrap items-center gap-x-2 mt-1">
              {FOOTER_LINKS.map((l, i) => (
                <span key={l.label} className="inline-flex items-center gap-2">
                  {i > 0 && <span aria-hidden style={{ color: WT.line2 }}>·</span>}
                  <a href={l.href} className="hover:underline" style={{ color: WT.ink4 }}>{l.label}</a>
                </span>
              ))}
            </span>
          </div>

          {/* 우 — 고객센터 · 제휴문의 */}
          <div className="text-[12.5px] leading-[1.7] sm:text-right shrink-0" style={{ color: WT.ink3 }}>
            <div className="text-[12px]">고객센터 · 제휴문의</div>
            <a href={`tel:${biz.tel}`} className="block text-[20px] font-extrabold my-0.5" style={{ color: WT.ink }}>Tel. {biz.tel}</a>
            <div>Fax. {biz.fax}</div>
            <a href={`mailto:${biz.csEmail}`} className="font-semibold hover:underline" style={{ color: WT.brand }}>{biz.csEmail}</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
