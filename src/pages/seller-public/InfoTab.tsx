/**
 * 🛡️ 2026-05-07: TD-018 분할 — SellerPublicPage 의 정보 탭 (소개 / SNS 링크 / 사업자 정보).
 * 🏁 2026-06-26 (대표): 서포터 랭킹 제거 + 이용권 '이용안내'는 링크샵에서 제거(이용권 상세페이지 전담).
 *   '이용권' 단정 표현도 제거 — 이용권은 식당 외 카테고리(뷰티/숙박 등)도 있음.
 */
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Check, X, MessageCircle, Phone, Building2, ShieldCheck } from 'lucide-react'
import type { Seller } from './types'
import type { ThemeTokens } from './theme'

interface Props {
  seller: Seller
  sellerId: string
  isOwner: boolean
  /** 🔗 2026-07-01 링크샵 전수조사: 큐레이터(/u/) 진입 시 헤더는 curator.bio 를 보여주는데 InfoTab 은
   *  seller.bio(빈값)만 봐 "아직 소개가 없어요"를 띄워 모순이었음. 방문자에겐 헤더와 동일한 effectiveBio 로 폴백. */
  effectiveBio?: string | null
  T: ThemeTokens
  // 인라인 편집 상태
  editingField: string | null
  setEditingField: (v: string | null) => void
  editBio: string
  setEditBio: (v: string) => void
  editInsta: string
  setEditInsta: (v: string) => void
  editYoutube: string
  setEditYoutube: (v: string) => void
  editKakao: string
  setEditKakao: (v: string) => void
  saving: boolean
  startEdit: (field: string) => void
  saveEdit: (field: string, value: string) => void
}

export default function InfoTab({
  seller, sellerId, isOwner, effectiveBio, T,
  editingField, setEditingField, editBio, setEditBio,
  editInsta, setEditInsta, editYoutube, setEditYoutube, editKakao, setEditKakao,
  saving, startEdit, saveEdit,
}: Props) {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <section>
        <h3 className={`text-base font-bold ${T.text} mb-2`}>{t('seller.publicPage.introduction')}</h3>
        {editingField === 'bio-info' ? (
          <div>
            <textarea autoFocus value={editBio} onChange={e => setEditBio(e.target.value)} rows={4}
              className="w-full text-sm bg-gray-50 dark:bg-[#121212] border border-pink-500 rounded-lg p-2 focus:outline-none resize-none text-gray-900 dark:text-white" />
            <div className="flex gap-2 mt-1">
              <button onClick={() => { saveEdit('bio', editBio); setEditingField(null) }} disabled={saving} className="px-3 py-1 bg-pink-500 text-white text-xs font-bold rounded-lg">{t('common.save')}</button>
              <button onClick={() => setEditingField(null)} className="px-3 py-1 bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 text-xs rounded-lg">{t('common.cancel')}</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap group" onClick={() => { if (isOwner) { setEditBio(seller.bio || ''); setEditingField('bio-info') } }}>
            {seller.bio || (isOwner ? t('seller.publicPage.enterBioTap') : (effectiveBio || t('seller.publicPage.noBio')))}
            {isOwner && <Pencil className="w-3 h-3 text-gray-300 inline ml-1 opacity-60 lg:opacity-0 lg:group-hover:opacity-100" />}
          </p>
        )}

        {/* SNS 링크 */}
        <div className="mt-3 space-y-2">
          {/* Instagram */}
          {editingField === 'instagram' ? (
            <div className="flex gap-2">
              <input autoFocus value={editInsta} onChange={e => setEditInsta(e.target.value)} placeholder="https://instagram.com/..."
                className="flex-1 px-2 py-1.5 border border-pink-500 rounded-lg text-sm bg-gray-50 dark:bg-[#121212] text-gray-900 dark:text-white" />
              <button onClick={() => saveEdit('instagram', editInsta)} className="px-2 py-1.5 bg-pink-500 text-white text-xs rounded-lg"><Check className="w-3 h-3" /></button>
              <button onClick={() => setEditingField(null)} aria-label="편집 취소" className="px-2 py-1.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 text-xs rounded-lg"><X className="w-3 h-3" /></button>
            </div>
          ) : seller.sns_instagram ? (
            <div className="flex items-center gap-2 group" onClick={() => isOwner && startEdit('instagram')}>
              <a href={seller.sns_instagram} target="_blank" rel="noopener" onClick={e => isOwner && e.preventDefault()} className="text-sm text-pink-500">Instagram →</a>
              {isOwner && <Pencil className="w-3 h-3 text-gray-300 opacity-60 lg:opacity-0 lg:group-hover:opacity-100" />}
            </div>
          ) : isOwner ? (
            <button onClick={() => startEdit('instagram')} className="text-xs text-gray-400 flex items-center gap-1"><Plus className="w-3 h-3" /> {t('seller.publicPage.addInstagram')}</button>
          ) : null}

          {/* YouTube */}
          {editingField === 'youtube' ? (
            <div className="flex gap-2">
              <input autoFocus value={editYoutube} onChange={e => setEditYoutube(e.target.value)} placeholder="https://youtube.com/..."
                className="flex-1 px-2 py-1.5 border border-pink-500 rounded-lg text-sm bg-gray-50 dark:bg-[#121212] text-gray-900 dark:text-white" />
              <button onClick={() => saveEdit('youtube', editYoutube)} className="px-2 py-1.5 bg-pink-500 text-white text-xs rounded-lg"><Check className="w-3 h-3" /></button>
              <button onClick={() => setEditingField(null)} aria-label="편집 취소" className="px-2 py-1.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 text-xs rounded-lg"><X className="w-3 h-3" /></button>
            </div>
          ) : seller.sns_youtube ? (
            <div className="flex items-center gap-2 group" onClick={() => isOwner && startEdit('youtube')}>
              <a href={seller.sns_youtube} target="_blank" rel="noopener" onClick={e => isOwner && e.preventDefault()} className="text-sm text-red-500">YouTube →</a>
              {isOwner && <Pencil className="w-3 h-3 text-gray-300 opacity-60 lg:opacity-0 lg:group-hover:opacity-100" />}
            </div>
          ) : isOwner ? (
            <button onClick={() => startEdit('youtube')} className="text-xs text-gray-400 flex items-center gap-1"><Plus className="w-3 h-3" /> {t('seller.publicPage.addYoutube')}</button>
          ) : null}

          {/* 카카오 채팅 */}
          {editingField === 'kakao' ? (
            <div className="flex gap-2">
              <input autoFocus value={editKakao} onChange={e => setEditKakao(e.target.value)} placeholder="https://open.kakao.com/..."
                className="flex-1 px-2 py-1.5 border border-pink-500 rounded-lg text-sm bg-gray-50 dark:bg-[#121212] text-gray-900 dark:text-white" />
              <button onClick={() => saveEdit('kakao', editKakao)} className="px-2 py-1.5 bg-pink-500 text-white text-xs rounded-lg"><Check className="w-3 h-3" /></button>
              <button onClick={() => setEditingField(null)} aria-label="편집 취소" className="px-2 py-1.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 text-xs rounded-lg"><X className="w-3 h-3" /></button>
            </div>
          ) : isOwner && !seller.kakao_chat_link ? (
            <button onClick={() => startEdit('kakao')} className="text-xs text-gray-400 flex items-center gap-1"><Plus className="w-3 h-3" /> {t('seller.publicPage.addKakaoChat')}</button>
          ) : null}
        </div>
      </section>

      {/* 사업자 정보 + 연락처 (전자상거래법: 필수 표시 항목)
          🖼️ 2026-07-01 (대표 신고 — "정보 입력부가 부실해 보임"): 전부 흐린 text-xs 나열 → 카드+구분선+
          헤더 아이콘+사업자 인증 배지로 구조화. 값은 진하게(font-medium, gray-900/white), 라벨만 muted. */}
      <section className="rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#1A1A1A]">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <h3 className={`text-sm font-bold ${T.text}`}>{t('seller.publicPage.sellerInfo')}</h3>
          </div>
          {seller.business_number && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" /> {t('seller.publicPage.verifiedBusiness', { defaultValue: '사업자 인증' })}
            </span>
          )}
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
        {/* 연락 수단 */}
        {(seller.kakao_chat_link || seller.phone) && (
          <div className="flex gap-2 p-4 pt-3 border-t border-gray-100 dark:border-[#1A1A1A]">
            {seller.kakao_chat_link && (
              <a href={seller.kakao_chat_link} target="_blank" rel="noopener"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-xs font-bold active:scale-[0.97]">
                <MessageCircle className="w-3.5 h-3.5" /> {t('seller.publicPage.kakaoInquiry')}
              </a>
            )}
            {seller.phone && (
              <a href={`tel:${seller.phone}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white dark:bg-[#020202] border border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold active:scale-[0.97]">
                <Phone className="w-3.5 h-3.5" /> {t('seller.publicPage.phoneInquiry')}
              </a>
            )}
          </div>
        )}
      </section>

      {/* 🏁 2026-06-26 (대표): 서포터 랭킹 + 이용권 이용안내 섹션 제거 — 이용안내는 이용권 상세페이지 전담. */}
    </div>
  )
}
