/**
 * 🎯 안 C — **잴 것이 없으면 재는 도구를 그리지 않는다** (2026-09-15 대표 확정 "안 C로 가자").
 *
 * 시안 갤러리(`/design/variants?set=seller-analytics`)에서 대표가 고른 안이다.
 * 고른 이유는 실측에서 나왔다: 이 화면은 내용이 나오기 전에 질문을 셋 하고(탭 6 → 기간 3),
 * 그 답이 **전부 0** 으로 갔다. 컨트롤 12개, 정보 0개. 다른 색을 입혀도 똑같이 비어 보인다.
 *
 * ⚠️ 두 가지 "없음" 을 구분한다 — 섞으면 거짓말이 된다.
 *   ① **한 번도 판 적 없음**(`total_buyers === 0`, 전 기간) → 온보딩. 지금 할 수 있는 일 하나를 준다.
 *   ② **이 기간에만 없음** → 60일 전에 판 사람에게 "아직 판매가 없어요" 라고 하면 틀린 말이다.
 *      기간을 넓히라고 말한다.
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const CARD = 'rounded-[var(--dash-radius,16px)] border border-rule bg-white p-6 text-center'

/** ① 전 기간 판매 0 — 온보딩 */
export function NoSalesEver() {
  const { t } = useTranslation()
  return (
    <div className={CARD}>
      <p className="text-[15px] font-bold text-gray-900">{t('seller.analyticsView.noSalesTitle', { defaultValue: '아직 판매가 없어요' })}</p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-500">
        {t('seller.analyticsView.noSalesBody', { defaultValue: '첫 이용권이 팔리면 여기에 매출·고객·재구매가 쌓입니다. 지금은 볼 숫자가 없어서 비워 뒀어요.' })}
      </p>
      <Link to="/seller/meal-voucher/new" className="ur-btn ur-btn-md ur-btn-primary mt-4 inline-flex">
        {t('seller.analyticsView.noSalesCta', { defaultValue: '이용권 등록하기' })}
      </Link>
    </div>
  )
}

/** ② 이 기간에만 0 — 기간을 넓히라고 말한다(온보딩 문구를 쓰면 틀린 말이 된다) */
export function NoSalesInWindow({ days, onWiden }: { days: number; onWiden: () => void }) {
  const { t } = useTranslation()
  return (
    <div className={CARD}>
      <p className="text-[15px] font-bold text-gray-900">{t('seller.analyticsView.windowEmptyTitle', { days, defaultValue: '최근 {{days}}일에는 판매가 없어요' })}</p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-500">
        {t('seller.analyticsView.windowEmptyBody', { defaultValue: '기간을 넓혀서 보시거나, 이용권을 새로 올려 보세요.' })}
      </p>
      {days < 90 && (
        <button type="button" onClick={onWiden} className="ur-btn ur-btn-md ur-btn-secondary mt-4">
          {t('seller.analyticsView.widen90', { defaultValue: '90일로 보기' })}
        </button>
      )}
    </div>
  )
}
