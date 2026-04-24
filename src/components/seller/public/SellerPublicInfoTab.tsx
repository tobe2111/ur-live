import { useTranslation } from 'react-i18next'
import { MessageCircle, Pencil, Check, X, Plus, Phone } from 'lucide-react'
import SupporterRanking from '@/components/live/SupporterRanking'
import { Seller, ThemeClasses } from '@/components/seller/public/seller-public-types'

interface SellerPublicInfoTabProps {
  seller: Seller
  sellerId: string
  isOwner: boolean
  T: ThemeClasses
  editingField: string | null
  setEditingField: (f: string | null) => void
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
  saveEdit: (field: string, value: string) => Promise<void>
}

export default function SellerPublicInfoTab({
  seller, sellerId, isOwner, T,
  editingField, setEditingField,
  editBio, setEditBio,
  editInsta, setEditInsta,
  editYoutube, setEditYoutube,
  editKakao, setEditKakao,
  saving, startEdit, saveEdit,
}: SellerPublicInfoTabProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <section>
        <h3 className={`text-base font-bold ${T.text} mb-2`}>{t('seller.publicPage.introduction')}</h3>
        {editingField === 'bio-info' ? (
          <div>
            <textarea autoFocus value={editBio} onChange={e => setEditBio(e.target.value)} rows={4}
              className="w-full text-sm bg-[#121212] border border-pink-500 rounded-lg p-2 focus:outline-none resize-none" />
            <div className="flex gap-2 mt-1">
              <button onClick={() => { saveEdit('bio', editBio); setEditingField(null) }} disabled={saving} className="px-3 py-1 bg-pink-500 text-white text-xs font-bold rounded-lg">{t('common.save')}</button>
              <button onClick={() => setEditingField(null)} className="px-3 py-1 bg-[#1A1A1A] text-gray-500 text-xs rounded-lg">{t('common.cancel')}</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap group" onClick={() => { if (isOwner) { setEditBio(seller.bio || ''); setEditingField('bio-info') } }}>
            {seller.bio || (isOwner ? t('seller.publicPage.enterBioTap') : t('seller.publicPage.noBio'))}
            {isOwner && <Pencil className="w-3 h-3 text-gray-300 inline ml-1 opacity-0 group-hover:opacity-100" />}
          </p>
        )}

        {/* SNS 링크 */}
        <div className="mt-3 space-y-2">
          {/* Instagram */}
          {editingField === 'instagram' ? (
            <div className="flex gap-2">
              <input autoFocus value={editInsta} onChange={e => setEditInsta(e.target.value)} placeholder="https://instagram.com/..."
                className="flex-1 px-2 py-1.5 border border-pink-500 rounded-lg text-sm bg-[#121212]" />
              <button onClick={() => saveEdit('instagram', editInsta)} className="px-2 py-1.5 bg-pink-500 text-white text-xs rounded-lg"><Check className="w-3 h-3" /></button>
              <button onClick={() => setEditingField(null)} aria-label="편집 취소" className="px-2 py-1.5 bg-[#1A1A1A] text-xs rounded-lg"><X className="w-3 h-3" /></button>
            </div>
          ) : seller.sns_instagram ? (
            <div className="flex items-center gap-2 group" onClick={() => isOwner && startEdit('instagram')}>
              <a href={seller.sns_instagram} target="_blank" rel="noopener" onClick={e => isOwner && e.preventDefault()} className="text-sm text-pink-500">Instagram →</a>
              {isOwner && <Pencil className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100" />}
            </div>
          ) : isOwner ? (
            <button onClick={() => startEdit('instagram')} className="text-xs text-gray-400 flex items-center gap-1"><Plus className="w-3 h-3" /> {t('seller.publicPage.addInstagram')}</button>
          ) : null}

          {/* YouTube */}
          {editingField === 'youtube' ? (
            <div className="flex gap-2">
              <input autoFocus value={editYoutube} onChange={e => setEditYoutube(e.target.value)} placeholder="https://youtube.com/..."
                className="flex-1 px-2 py-1.5 border border-pink-500 rounded-lg text-sm bg-[#121212]" />
              <button onClick={() => saveEdit('youtube', editYoutube)} className="px-2 py-1.5 bg-pink-500 text-white text-xs rounded-lg"><Check className="w-3 h-3" /></button>
              <button onClick={() => setEditingField(null)} aria-label="편집 취소" className="px-2 py-1.5 bg-[#1A1A1A] text-xs rounded-lg"><X className="w-3 h-3" /></button>
            </div>
          ) : seller.sns_youtube ? (
            <div className="flex items-center gap-2 group" onClick={() => isOwner && startEdit('youtube')}>
              <a href={seller.sns_youtube} target="_blank" rel="noopener" onClick={e => isOwner && e.preventDefault()} className="text-sm text-red-500">YouTube →</a>
              {isOwner && <Pencil className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100" />}
            </div>
          ) : isOwner ? (
            <button onClick={() => startEdit('youtube')} className="text-xs text-gray-400 flex items-center gap-1"><Plus className="w-3 h-3" /> {t('seller.publicPage.addYoutube')}</button>
          ) : null}

          {/* 카카오 채팅 */}
          {editingField === 'kakao' ? (
            <div className="flex gap-2">
              <input autoFocus value={editKakao} onChange={e => setEditKakao(e.target.value)} placeholder="https://open.kakao.com/..."
                className="flex-1 px-2 py-1.5 border border-pink-500 rounded-lg text-sm bg-[#121212]" />
              <button onClick={() => saveEdit('kakao', editKakao)} className="px-2 py-1.5 bg-pink-500 text-white text-xs rounded-lg"><Check className="w-3 h-3" /></button>
              <button onClick={() => setEditingField(null)} aria-label="편집 취소" className="px-2 py-1.5 bg-[#1A1A1A] text-xs rounded-lg"><X className="w-3 h-3" /></button>
            </div>
          ) : isOwner && !seller.kakao_chat_link ? (
            <button onClick={() => startEdit('kakao')} className="text-xs text-gray-400 flex items-center gap-1"><Plus className="w-3 h-3" /> {t('seller.publicPage.addKakaoChat')}</button>
          ) : null}
        </div>
      </section>

      {/* 사업자 정보 + 연락처 (전자상거래법: 필수 표시 항목) */}
      <section className="bg-[#121212] rounded-xl p-4">
        <h3 className={`text-sm font-bold ${T.text} mb-3`}>{t('seller.publicPage.sellerInfo')}</h3>
        <div className="text-sm text-gray-400 space-y-2">
          <div className="flex">
            <span className="w-24 text-gray-400 shrink-0 text-xs">{t('seller.publicPage.businessName')}</span>
            <span className="text-xs">{seller.business_name || <span className="text-gray-500">{t('common.noInfo')}</span>}</span>
          </div>
          <div className="flex">
            <span className="w-24 text-gray-400 shrink-0 text-xs">{t('seller.publicPage.representative')}</span>
            <span className="text-xs">{seller.ceo_name || seller.name || <span className="text-gray-500">{t('common.noInfo')}</span>}</span>
          </div>
          <div className="flex">
            <span className="w-24 text-gray-400 shrink-0 text-xs">{t('seller.publicPage.businessNumber')}</span>
            <span className="text-xs">{seller.business_number || <span className="text-gray-500">{t('common.noInfo')}</span>}</span>
          </div>
          <div className="flex">
            <span className="w-24 text-gray-400 shrink-0 text-xs">{t('seller.publicPage.mailOrderNumber')}</span>
            <span className="text-xs">{seller.mail_order_number || <span className="text-gray-500">{t('common.noInfo')}</span>}</span>
          </div>
          <div className="flex">
            <span className="w-24 text-gray-400 shrink-0 text-xs">{t('common.address')}</span>
            <span className="text-xs">{seller.business_address || <span className="text-gray-500">{t('common.noInfo')}</span>}</span>
          </div>
        </div>
        {/* 연락 수단 */}
        <div className="flex gap-2 mt-3">
          {seller.kakao_chat_link && (
            <a href={seller.kakao_chat_link} target="_blank" rel="noopener"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-xs font-bold active:scale-[0.97]">
              <MessageCircle className="w-3.5 h-3.5" /> {t('seller.publicPage.kakaoInquiry')}
            </a>
          )}
          {seller.phone && (
            <a href={`tel:${seller.phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#020202] border border-[#2A2A2A] text-gray-300 rounded-xl text-xs font-bold active:scale-[0.97]">
              <Phone className="w-3.5 h-3.5" /> {t('seller.publicPage.phoneInquiry')}
            </a>
          )}
        </div>
      </section>

      {/* 서포터 랭킹 */}
      <section>
        <SupporterRanking sellerId={sellerId} />
      </section>

      <section>
        <h3 className={`text-base font-bold ${T.text} mb-2`}>{t('seller.publicPage.voucherGuide')}</h3>
        <div className="text-sm text-gray-400 space-y-2">
          <div className="flex"><span className="w-20 text-gray-500 shrink-0">{t('seller.publicPage.howToUse')}</span><span>{t('seller.publicPage.howToUseDesc')}</span></div>
          <div className="flex"><span className="w-20 text-gray-500 shrink-0">{t('seller.publicPage.validity')}</span><span>{t('seller.publicPage.validityDesc')}</span></div>
          <div className="flex"><span className="w-20 text-gray-500 shrink-0">{t('seller.publicPage.refund')}</span><span>{t('seller.publicPage.refundDesc')}</span></div>
          <div className="flex"><span className="w-20 text-gray-500 shrink-0">{t('seller.publicPage.contact')}</span><span>{t('seller.publicPage.contactDesc')}</span></div>
        </div>
      </section>
    </div>
  )
}
