/**
 * 🛡️ 2026-05-07: TD-018 분할 — SellerPublicPage 의 정보 탭.
 * 🏁 2026-06-26 (대표): 서포터 랭킹 제거 + 이용권 '이용안내'는 링크샵에서 제거(이용권 상세페이지 전담).
 * 🖼️ 2026-07-01 (대표 신고 — "정보 입력부가 부실" + "소개는 헤더 SNS 와 중복" + "수정 기능이 없음"):
 *   ① 소개 섹션(bio·Instagram·YouTube 추가) 제거 — CuratorHeader 가 이미 bio/SNS 표시+편집 전담(중복 UI 폐기).
 *   ② 판매자 정보 카드 구조화(카드+구분선+인증배지) + 소유자 '수정' 버튼 → /seller/business-info 딥링크.
 *   ③ 카카오 채팅 링크(헤더에 없는 유일한 항목)만 카드 연락수단 영역에서 인라인 편집 유지.
 */
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Check, X, MessageCircle, Phone, Building2, ShieldCheck } from 'lucide-react'
import type { Seller } from './types'
import type { ThemeTokens } from './theme'

interface Props {
  seller: Seller
  isOwner: boolean
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
  seller, isOwner, T,
  editingField, setEditingField, editKakao, setEditKakao,
  saving, startEdit, saveEdit,
}: Props) {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      {/* 사업자 정보 + 연락처 (전자상거래법: 필수 표시 항목) */}
      <section className="rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#1A1A1A]">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <h3 className={`text-sm font-bold ${T.text}`}>{t('seller.publicPage.sellerInfo')}</h3>
          </div>
          <div className="flex items-center gap-2">
            {seller.business_number && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" /> {t('seller.publicPage.verifiedBusiness', { defaultValue: '사업자 인증' })}
              </span>
            )}
            {/* 🖼️ 2026-07-01 (대표 신고 — "수정 기능이 없음"): 사업자 정보의 SSOT 편집은 셀러 대시보드
                (/seller/business-info — 국세청 진위확인·사업자등록증 업로드 포함)라 인라인 대신 딥링크. */}
            {isOwner && (
              <Link to="/seller/business-info"
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-[#2A2A2A] px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300 active:scale-95">
                <Pencil className="w-3 h-3" /> {t('common.edit', { defaultValue: '수정' })}
              </Link>
            )}
          </div>
        </div>
        <dl className="divide-y divide-gray-100 dark:divide-[#1A1A1A]">
          {([
            [t('seller.publicPage.businessName'), seller.business_name],
            [t('seller.publicPage.representative'), seller.ceo_name || seller.name],
            [t('seller.publicPage.businessNumber'), seller.business_number],
            [t('seller.publicPage.mailOrderNumber'), seller.mail_order_number],
            [t('common.address'), seller.business_address],
          ] as [string, string | null | undefined][]).map(([label, value], i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-2.5">
              <dt className="w-24 shrink-0 text-xs text-gray-400 dark:text-gray-500">{label}</dt>
              <dd className={`text-xs leading-relaxed ${value ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                {value || t('common.noInfo')}
              </dd>
            </div>
          ))}
          {/* 🛡️ 2026-04-22: 셀러 phone/email 공개 노출 제거 (개인정보 보호법 / PIPA) */}
        </dl>
        {/* 연락 수단 — 카카오 채팅 링크는 헤더 SNS 에 없는 유일한 항목이라 여기서 인라인 편집 */}
        {editingField === 'kakao' ? (
          <div className="flex gap-2 p-4 pt-3 border-t border-gray-100 dark:border-[#1A1A1A]">
            <input autoFocus value={editKakao} onChange={e => setEditKakao(e.target.value)} placeholder="https://open.kakao.com/..."
              className="flex-1 px-2 py-1.5 border border-pink-500 rounded-lg text-sm bg-gray-50 dark:bg-[#121212] text-gray-900 dark:text-white" />
            <button onClick={() => saveEdit('kakao', editKakao)} disabled={saving} aria-label="저장" className="px-2 py-1.5 bg-pink-500 text-white text-xs rounded-lg"><Check className="w-3 h-3" /></button>
            <button onClick={() => setEditingField(null)} aria-label="편집 취소" className="px-2 py-1.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 text-xs rounded-lg"><X className="w-3 h-3" /></button>
          </div>
        ) : (seller.kakao_chat_link || seller.phone || isOwner) && (
          <div className="flex gap-2 p-4 pt-3 border-t border-gray-100 dark:border-[#1A1A1A]">
            {seller.kakao_chat_link ? (
              <a href={seller.kakao_chat_link} target="_blank" rel="noopener"
                onClick={e => { if (isOwner) { e.preventDefault(); startEdit('kakao') } }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-xs font-bold active:scale-[0.97]">
                <MessageCircle className="w-3.5 h-3.5" /> {t('seller.publicPage.kakaoInquiry')}
                {isOwner && <Pencil className="w-3 h-3 opacity-50" />}
              </a>
            ) : isOwner ? (
              <button onClick={() => startEdit('kakao')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-gray-300 dark:border-[#2A2A2A] text-gray-500 dark:text-gray-400 rounded-xl text-xs font-bold active:scale-[0.97]">
                <Plus className="w-3.5 h-3.5" /> {t('seller.publicPage.addKakaoChat')}
              </button>
            ) : null}
            {seller.phone && (
              <a href={`tel:${seller.phone}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white dark:bg-[#020202] border border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold active:scale-[0.97]">
                <Phone className="w-3.5 h-3.5" /> {t('seller.publicPage.phoneInquiry')}
              </a>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
