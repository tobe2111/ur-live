/**
 * 📸 2026-07-19 (대표 — 대표사진 가이드): 이용권 등록 대표사진 단계의 권장 안내 박스.
 *   "음식/시술 결과 사진이 간판·메뉴판 사진보다 판매가 잘 돼요" — 판매 전환이 잘 되는
 *   사진 유형을 등록 시점에 알려 등록 플로우 품질 개선(개발 로직 무관, 안내 전용).
 *   예시 이미지는 외부 에셋 없이 내장 SVG 일러스트(추천=음식 클로즈업 / 비추천=간판)로 —
 *   네트워크 0 · 용량 ~1KB · 다국어 라벨은 i18n.
 *   셀러 대시보드(라이트 고정) — dark: variant 금지 정책 준수.
 */
import { useTranslation } from 'react-i18next'

/** ✅ 추천 예시 — 그릇에 담긴 음식 클로즈업(프레임을 가득 채움) */
function GoodExampleSvg() {
  return (
    <svg viewBox="0 0 96 72" className="w-full h-auto" aria-hidden="true">
      <rect width="96" height="72" rx="6" fill="#EAF1FE" />
      {/* 김 — 갓 나온 요리 */}
      <path d="M38 12c-2 3 2 5 0 8M48 10c-2 3 2 5 0 8M58 12c-2 3 2 5 0 8" stroke="#C9A5AD" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* 그릇(클로즈업 — 프레임 하단을 가득) */}
      <ellipse cx="48" cy="40" rx="34" ry="11" fill="#1C69EF" opacity="0.9" />
      <path d="M14 40h68c0 14-14 24-34 24S14 54 14 40Z" fill="#FFFFFF" stroke="#1C69EF" strokeWidth="2.5" />
      {/* 음식 봉긋 */}
      <path d="M22 39c4-8 12-12 26-12s22 4 26 12" fill="#F3C1CA" stroke="#1C69EF" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="38" cy="34" r="2.2" fill="#1C69EF" />
      <circle cx="52" cy="31" r="2.2" fill="#1C69EF" />
      <circle cx="62" cy="35" r="2.2" fill="#1C69EF" />
    </svg>
  )
}

/** ❌ 비추천 예시 — 멀리서 찍은 간판/건물 외관 */
function BadExampleSvg() {
  return (
    <svg viewBox="0 0 96 72" className="w-full h-auto" aria-hidden="true">
      <rect width="96" height="72" rx="6" fill="#F3EEEA" />
      {/* 건물 외관 */}
      <rect x="18" y="22" width="60" height="42" fill="#FFFFFF" stroke="#8A8580" strokeWidth="2" />
      {/* 간판 */}
      <rect x="22" y="12" width="52" height="14" rx="2" fill="#D8D2CC" stroke="#8A8580" strokeWidth="2" />
      <path d="M30 19h20M54 19h12" stroke="#6E6B68" strokeWidth="2.5" strokeLinecap="round" />
      {/* 문 · 창(메뉴판) */}
      <rect x="26" y="34" width="18" height="30" fill="#F3EEEA" stroke="#8A8580" strokeWidth="1.5" />
      <rect x="52" y="34" width="18" height="20" fill="#F3EEEA" stroke="#8A8580" strokeWidth="1.5" />
      <path d="M55 39h12M55 43h12M55 47h8" stroke="#8A8580" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export default function SellerVoucherPhotoGuide() {
  const { t } = useTranslation()
  return (
    <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-3">
      <p className="text-[12px] font-semibold text-amber-800">
        {t('seller.mealVoucher.photoGuideTitle', { defaultValue: '음식·시술 결과 사진이 간판·메뉴판 사진보다 판매가 잘 돼요' })}
      </p>
      {/* 예시 일러스트 — 추천(음식 클로즈업) vs 비추천(간판/외관) */}
      <div className="grid grid-cols-2 gap-2 mt-2 max-w-[360px]">
        <figure className="m-0">
          <div className="rounded-md overflow-hidden ring-1 ring-amber-200"><GoodExampleSvg /></div>
          <figcaption className="text-[11px] text-amber-700 mt-1">
            {t('seller.mealVoucher.photoGuideGood', { defaultValue: '추천 예시: 대표 메뉴 클로즈업 · 시술 결과(전/후) · 실제 제공되는 모습' })}
          </figcaption>
        </figure>
        <figure className="m-0">
          <div className="rounded-md overflow-hidden ring-1 ring-amber-200 opacity-70"><BadExampleSvg /></div>
          <figcaption className="text-[11px] text-amber-700 mt-1">
            {t('seller.mealVoucher.photoGuideBad', { defaultValue: '피해주세요: 간판 · 메뉴판 · 건물 외관 사진' })}
          </figcaption>
        </figure>
      </div>
    </div>
  )
}
