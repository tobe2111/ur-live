/**
 * 🎟️ 교환권 머리 한 줄 (2026-11-01 대표 확정 **A안**) — 클래스 SSOT 는 `@/shared/vouchers-top-row`.
 *
 * 2026-10-14 안 C 의 `VouchersHero`(배너 196px)를 대체한다. 대표: *"배너 없는게 낫겠고"*.
 * 왜 한 줄인지·무엇을 잃었는지는 그 SSOT 파일 머리말에 있다.
 *
 * 🔴 **자리를 예약할 필요가 없다** — 이 줄의 높이(56)는 글자·아이콘이 아니라 `h-14` 가 정하고,
 *    잔액 숫자가 늦게 와도 줄 높이는 안 바뀐다. 배너 시절에는 `/api/banners` 응답 전후로 196px 가
 *    생겼다 사라져 **아래 전부가 밀렸고**, 그래서 어두운 판을 미리 세워 둬야 했다(그 장치가 사라졌다).
 */
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { ArrowRight } from 'lucide-react'
import { WalletIcon } from '@/components/icons/urdeal-icons'
import { useTranslation } from '@/lib/i18n-lite'
import { formatNumber } from '@/utils/format'
import {
  VOUCHERS_TOP_ROW, VOUCHERS_TOP_UNKNOWN,
  VOUCHERS_TOP_EARN_PATH, VOUCHERS_TOP_BOX_PATH, VOUCHERS_TOP_SEARCH_PATH,
} from '@/shared/vouchers-top-row'

export interface VouchersTopRowProps {
  /** 서버가 준 잔액. `null` = 아직 못 읽음(0 과 구분한다 — 0 을 적지 않는다). */
  balance: number | null
  /** 로그인 여부(동기 판정 `getUserIdSync`). 비로그인이면 잔액이 아니라 할 수 있는 일을 말한다. */
  loggedIn?: boolean
  /** 조회 실패 — 0 으로 위장하지 않고 `—`. */
  failed?: boolean
}

export default function VouchersTopRow({ balance, loggedIn, failed }: VouchersTopRowProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const C = VOUCHERS_TOP_ROW

  return (
    <>
      <div className={C.row}>
        {loggedIn ? (
          <button type="button" onClick={() => navigate(VOUCHERS_TOP_EARN_PATH)} className={C.deal}>
            <span className={C.dealLabel}>{t('voucher.myDeal', { defaultValue: '내 딜' })}</span>
            {/* 🔴 아직 모르면 숫자를 비운다(0 을 적지 않는다). 줄 높이는 `h-14` 가 정하므로 안 밀린다. */}
            <span className={C.dealNum}>{failed ? VOUCHERS_TOP_UNKNOWN : balance == null ? '' : formatNumber(balance)}</span>
            <span className={C.dealUnit}>{t('common.dealUnit', { defaultValue: '딜' })}</span>
          </button>
        ) : (
          <button type="button" onClick={() => navigate(VOUCHERS_TOP_EARN_PATH)} className={C.guest}>
            {t('voucher.earnDeal', { defaultValue: '딜 모으기' })}
            <ArrowRight className="w-4 h-4" strokeWidth={1.6} />
          </button>
        )}

        <div className={C.actions}>
          <button
            type="button"
            onClick={() => navigate(VOUCHERS_TOP_SEARCH_PATH)}
            aria-label={t('common.search', { defaultValue: '검색' })}
            className={C.icbtn}
          >
            <Search className="w-[22px] h-[22px]" strokeWidth={1.6} />
          </button>
          <button
            type="button"
            onClick={() => navigate(VOUCHERS_TOP_BOX_PATH)}
            aria-label={t('voucher.myBox', { defaultValue: '보관함' })}
            className={C.icbtn}
          >
            <WalletIcon className="w-[22px] h-[22px]" />
          </button>
        </div>
      </div>
      <div className={C.rule} />
    </>
  )
}
