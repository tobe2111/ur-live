/**
 * 📸 2026-07-19 (대표 — 대표사진 가이드): 이용권 등록 대표사진 단계의 권장 안내 박스.
 *   "음식/시술 결과 사진이 간판·메뉴판 사진보다 판매가 잘 돼요" — 판매 전환이 잘 되는
 *   사진 유형을 등록 시점에 알려 등록 플로우 품질 개선(개발 로직 무관, 안내 전용).
 *   셀러 대시보드(라이트 고정) — dark: variant 금지 정책 준수.
 */
import { useTranslation } from 'react-i18next'

export default function SellerVoucherPhotoGuide() {
  const { t } = useTranslation()
  return (
    <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-3">
      <p className="text-[12px] font-semibold text-amber-800">
        {t('seller.mealVoucher.photoGuideTitle', { defaultValue: '💡 음식·시술 결과 사진이 간판·메뉴판 사진보다 판매가 잘 돼요' })}
      </p>
      <p className="text-[11px] text-amber-700 mt-1">
        {t('seller.mealVoucher.photoGuideGood', { defaultValue: '✅ 추천 예시: 대표 메뉴 클로즈업 · 시술 결과(전/후) · 실제 제공되는 모습' })}
      </p>
      <p className="text-[11px] text-amber-700 mt-0.5">
        {t('seller.mealVoucher.photoGuideBad', { defaultValue: '❌ 피해주세요: 간판 · 메뉴판 · 건물 외관 사진' })}
      </p>
    </div>
  )
}
