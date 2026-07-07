/**
 * 🛡️ 2026-05-07: TD-018 분할 — SellerPublicPage 의 정보 탭.
 * 🏁 2026-06-26 (대표): 서포터 랭킹 제거 + 이용권 '이용안내'는 링크샵에서 제거(이용권 상세페이지 전담).
 * 🖼️ 2026-07-01 (대표 신고): 소개 섹션 제거(헤더와 중복) + 판매자 정보 편집 딥링크 + 통신판매업신고번호.
 * 🧾 2026-07-02 (대표 시안 — 쇼핑몰 푸터처럼): 카드+배지 → **"MORE INFO +" 접이식 푸터**(29cm/무신사식
 *   `LABEL. value` 평문 + [사업자정보확인] 링크). 링크샵 맨 밑에 자연스럽게 얹힘. 카카오 문의는 유지.
 */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Plus, Check, X, MessageCircle, Phone, Pencil } from 'lucide-react'
import type { Seller } from './types'
import type { ThemeTokens } from './theme'

interface Props {
  seller: Seller
  isOwner: boolean
  /** 🔑 2026-07-07: 카카오 채팅 링크 인라인 편집(PUT /api/seller/profile)은 seller_token 필요.
   *  링크샵 소유자여도 셀러 토큰이 없으면(소비자 로그인만) 편집 어포던스 숨김 → 401 방지. */
  canSellerEdit?: boolean
  T: ThemeTokens
  // 인라인 편집 상태 (카카오 채팅 링크 전용 — bio/SNS 는 CuratorHeader 전담)
  editingField: string | null
  setEditingField: (v: string | null) => void
  editKakao: string
  setEditKakao: (v: string) => void
  saving: boolean
  startEdit: (field: string) => void
  saveEdit: (field: string, value: string) => void
}

export default function InfoTab({
  seller, isOwner, canSellerEdit = false, T,
  editingField, setEditingField, editKakao, setEditKakao,
  saving, startEdit, saveEdit,
}: Props) {
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
      {/* 연락 수단 — 카카오 채팅 링크(헤더 SNS 에 없는 유일 항목)만 여기서 인라인 편집 */}
      {editingField === 'kakao' ? (
        <div className="flex gap-2">
          <input autoFocus value={editKakao} onChange={e => setEditKakao(e.target.value)} placeholder="https://open.kakao.com/..."
            className="flex-1 px-2 py-1.5 border border-pink-500 rounded-lg text-sm bg-gray-50 dark:bg-[#121212] text-gray-900 dark:text-white" />
          <button onClick={() => saveEdit('kakao', editKakao)} disabled={saving} aria-label={t('common.save', { defaultValue: '저장' })} className="px-2 py-1.5 bg-pink-500 text-white text-xs rounded-lg"><Check className="w-3 h-3" /></button>
          <button onClick={() => setEditingField(null)} aria-label={t('common.cancel', { defaultValue: '취소' })} className="px-2 py-1.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 text-xs rounded-lg"><X className="w-3 h-3" /></button>
        </div>
      ) : (seller.kakao_chat_link || seller.phone || canSellerEdit) ? (
        <div className="flex gap-2">
          {seller.kakao_chat_link ? (
            <a href={seller.kakao_chat_link} target="_blank" rel="noopener"
              onClick={e => { if (canSellerEdit) { e.preventDefault(); startEdit('kakao') } }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-xs font-bold active:scale-[0.97]">
              <MessageCircle className="w-3.5 h-3.5" /> {t('seller.publicPage.kakaoInquiry', { defaultValue: '카카오 문의' })}
              {canSellerEdit && <Pencil className="w-3 h-3 opacity-50" />}
            </a>
          ) : canSellerEdit ? (
            <button onClick={() => startEdit('kakao')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-gray-300 dark:border-[#2A2A2A] text-gray-500 dark:text-gray-400 rounded-xl text-xs font-bold active:scale-[0.97]">
              <Plus className="w-3.5 h-3.5" /> {t('seller.publicPage.addKakaoChat', { defaultValue: '카카오 채팅 링크 추가' })}
            </button>
          ) : null}
          {seller.phone && (
            <a href={`tel:${seller.phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white dark:bg-[#020202] border border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold active:scale-[0.97]">
              <Phone className="w-3.5 h-3.5" /> {t('seller.publicPage.phoneInquiry', { defaultValue: '전화 문의' })}
            </a>
          )}
        </div>
      ) : null}

      {/* 🧾 판매자(사업자) 정보 — 쇼핑몰 푸터식 "MORE INFO +" 접이식 (전자상거래법 표시 항목) */}
      {(hasAnyInfo || isOwner) && (
        <div className="pt-1">
          <button
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className="w-full flex items-center gap-1.5 py-1 text-[10px] font-bold tracking-wider text-gray-400 dark:text-gray-500 uppercase active:opacity-70"
          >
            {t('seller.publicPage.moreInfo', { defaultValue: 'MORE INFO' })}
            <span className="text-[11px] leading-none font-normal">{open ? '−' : '+'}</span>
            {isOwner && (
              <Link
                to="/seller/business-info"
                onClick={e => e.stopPropagation()}
                className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 normal-case tracking-normal active:opacity-70"
              >
                <Pencil className="w-2.5 h-2.5" /> {t('common.edit', { defaultValue: '수정' })}
              </Link>
            )}
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
