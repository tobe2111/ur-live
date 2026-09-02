/**
 * 🛡️ 2026-05-07: TD-018 분할 — SellerPublicPage 의 정보 탭.
 * 🏁 2026-06-26 (대표): 서포터 랭킹 제거 + 이용권 '이용안내'는 유어샵에서 제거(이용권 상세페이지 전담).
 * 🖼️ 2026-07-01 (대표 신고): 소개 섹션 제거(헤더와 중복) + 판매자 정보 편집 딥링크 + 통신판매업신고번호.
 * 🧾 2026-07-02 (대표 시안 — 쇼핑몰 푸터처럼): 카드+배지 → **"MORE INFO +" 접이식 푸터**(29cm/무신사식
 *   `LABEL. value` 평문 + [사업자정보확인] 링크). 유어샵 맨 밑에 자연스럽게 얹힘. 카카오 문의는 유지.
 */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { MessageCircle, Phone } from 'lucide-react'
import type { Seller } from './types'
import type { ThemeTokens } from './theme'

interface Props {
  seller: Seller
  isOwner: boolean
  T: ThemeTokens
}

// 🧹 2026-07-20 (유어샵 전수조사): 카카오 채팅 링크 인라인 편집 props(canSellerEdit/editingField/editKakao/
//   saving/startEdit/saveEdit) 제거 — 연락처 편집은 셀러 대시보드 전담. InfoTab 은 표시 전용.
export default function InfoTab({ seller, isOwner, T }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const ceo = seller.ceo_name || seller.name
  const bizNoDigits = (seller.business_number || '').replace(/[^0-9]/g, '')
  const bizCheckUrl = bizNoDigits.length >= 10
    ? `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${bizNoDigits}`
    : null
  const hasAnyInfo = !!(seller.business_name || ceo || seller.business_number || seller.mail_order_number || seller.business_address)

  // 푸터 한 줄 — `LABEL. value` (라벨 세미볼드/뮤트, 값 살짝 진하게). 값 없으면 렌더 스킵.
  // ⚠️ 각 <p> 에 명시적 text-[11px] 필수: 전역 `@layer base` 의 `p{font-size:clamp(15px…)}`(index.css)
  //   이 부모 div 의 text-[10px] 상속을 덮어써 15px 로 커지던 버그(2026-07-07 대표 신고). 유틸리티 레이어가
  //   base 를 이겨야 하므로 크기 클래스를 <p> 자신에 둔다.
  const Row = ({ label, value, extra }: { label: string; value?: string | null; extra?: ReactNode }) =>
    value ? (
      <p className="text-[11px] leading-relaxed">
        <span className="font-semibold text-gray-500 dark:text-gray-400">{label}</span>{' '}
        <span className="text-gray-400 dark:text-gray-500">{value}</span>
        {extra ? <> {extra}</> : null}
      </p>
    ) : null

  return (
    <div className="space-y-3">
      {/* 연락 수단 — 🧹 2026-07-20 (대표 — "카카오 채팅 링크 추가 없어도 됨"): 오너 인라인 편집/추가
          어포던스 제거(연락처는 셀러 대시보드에서 관리). 방문자에겐 기존 링크가 있으면 표시만. */}
      {(seller.kakao_chat_link || seller.phone) && (
        <div className="flex gap-2">
          {seller.kakao_chat_link && (
            <a href={seller.kakao_chat_link} target="_blank" rel="noopener"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-xs font-bold active:scale-[0.97]">
              <MessageCircle className="w-3.5 h-3.5" /> {t('seller.publicPage.kakaoInquiry', { defaultValue: '카카오 문의' })}
            </a>
          )}
          {seller.phone && (
            <a href={`tel:${seller.phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white dark:bg-[#11141C] border border-gray-200 dark:border-[#2C2F35] text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold active:scale-[0.97]">
              <Phone className="w-3.5 h-3.5" /> {t('seller.publicPage.phoneInquiry', { defaultValue: '전화 문의' })}
            </a>
          )}
        </div>
      )}

      {/* 🧾 판매자(사업자) 정보 — 쇼핑몰 푸터식 "MORE INFO +" 접이식 (전자상거래법 표시 항목) */}
      {(hasAnyInfo || isOwner) && (
        <div className="pt-1">
          <button
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className="w-full flex items-center gap-1.5 py-1 text-[11px] font-bold text-gray-500 dark:text-gray-400 active:opacity-70"
          >
            {t('seller.publicPage.moreInfo', { defaultValue: '사업자 정보 더보기' })}
            <span className="text-[11px] leading-none font-normal">{open ? '−' : '+'}</span>
          </button>

          {open && (
            <div className="mt-2 space-y-0.5 leading-relaxed text-gray-400 dark:text-gray-500">
              {(seller.business_name || ceo) && (
                <p className="text-[11px] leading-relaxed">
                  {seller.business_name && (
                    <><span className="font-semibold text-gray-500 dark:text-gray-400">COMPANY.</span> <span className="text-gray-400 dark:text-gray-500">{seller.business_name}</span></>
                  )}
                  {ceo && (
                    <><span className="ml-3 font-semibold text-gray-500 dark:text-gray-400">CEO.</span> <span className="text-gray-400 dark:text-gray-500">{ceo}</span></>
                  )}
                </p>
              )}
              <Row label="ADDRESS." value={seller.business_address} />
              <Row
                label="BUSINESS NO."
                value={seller.business_number}
                extra={bizCheckUrl && (
                  <a href={bizCheckUrl} target="_blank" rel="noopener noreferrer"
                    className="text-gray-500 dark:text-gray-400 underline underline-offset-2 active:opacity-70">
                    [{t('seller.publicPage.bizInfoCheck', { defaultValue: '사업자정보확인' })}]
                  </a>
                )}
              />
              <Row label="ORDER LICENSE." value={seller.mail_order_number} />
              {isOwner && !seller.mail_order_number && (
                <p className="text-[11px] leading-relaxed">
                  <span className="font-semibold text-gray-500 dark:text-gray-400">ORDER LICENSE.</span>{' '}
                  <Link to="/seller/business-info" className="text-gray-400 dark:text-gray-500 underline underline-offset-2">
                    {t('seller.publicPage.mailOrderNumber', { defaultValue: '통신판매업신고번호' })} {t('common.register', { defaultValue: '등록' })}
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
