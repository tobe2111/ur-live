/**
 * 🪜 유어샵 수익 사다리 — 소개자가 돈 버는 길 3개를 **한 곳에 순서대로** (2026-08-27 대표 확정)
 *
 * ## 왜 만들었나
 * 소개자가 돈 버는 길이 셋인데 **세 화면에 흩어져 있었다**:
 *   ① 매장 영입 2%/1년 → `/influencer/settlement`(정산 페이지) 안쪽
 *   ② 딜(소개비 %)     → 매장이 먼저 제안해야 함. 소개자 화면엔 안내 없음
 *   ③ 담아서 팔기      → 유어샵. "최근 30일 적립 ₩0" 만
 *
 * 가장 돈이 되는 ①이 **가장 안 가는 화면**(정산은 돈 받을 때만 간다)에 있었고, 자주 오는
 * 유어샵에는 그 이야기가 한 줄도 없었다. 그래서 유어샵에 오면 "적립 ₩0"만 보이고
 * **뭘 해야 0이 아니게 되는지**는 알 수 없었다.
 *
 * ## 순서가 곧 설명이다
 * ①이 ②를 만들고(내가 데려온 가게니 딜을 주기 쉽다), ②가 ③을 돈으로 만든다
 * (딜이 없으면 담아 팔아도 **0원** — 어필리에이트는 2026-08-22 종료).
 * 그래서 위에서 아래로 읽으면 그대로 할 일 순서가 된다.
 *
 * ⚠️ **①과 ③은 겹쳐서 받는다.** 영입 2%는 `influencer_attributions(source='store_intro')` 라는
 *   별개 레일이라 딜 커미션과 합산된다. 화면이 그걸 말해 주지 않으면 사람들은 둘 중 하나만 한다.
 *
 * ⚠️ 숫자를 여기 하드코딩하지 않는다 — 요율은 어드민이 바꾼다(`platform_settings`).
 *   서버가 내려준 값을 쓰고, 못 받으면 정책 기본값(`INFLUENCER_STORE_INTRO_*`)을 보여 준다.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, ChevronRight } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { COMMISSION_DEFAULTS } from '@/shared/constants/policy'

interface Props {
  /** 이 유어샵 주인의 유저 id — 초대 링크의 `?ref=` 값이 된다. */
  curatorId: string | number
  /** 지금 딜이 붙어 있는 핀 수. 0 이면 2단이 아직 비어 있다는 뜻. */
  dealCount: number
  /** 담은 핀 총 수. 0 이면 3단이 비어 있다. */
  pinCount: number
}

export default function EarnLadder({ curatorId, dealCount, pinCount }: Props) {
  const [copied, setCopied] = useState(false)
  const inviteUrl = `${window.location.origin}/store/new?ref=${encodeURIComponent(String(curatorId))}`

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true); setTimeout(() => setCopied(false), 1800)
      toast.success('초대 링크를 복사했어요')
    } catch {
      toast.error('복사하지 못했어요 — 링크를 길게 눌러 복사해주세요')
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-3">
      <div className="rounded-2xl border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#0D0F12] overflow-hidden">
        <div className="px-4 pt-3.5 pb-2">
          <p className="text-[14px] font-extrabold text-gray-900 dark:text-white">내 유어샵으로 버는 법</p>
          <p className="mt-0.5 text-[11.5px] text-gray-500 dark:text-gray-400">위에서부터 하면 아래가 쉬워져요.</p>
        </div>

        {/* 1단 — 가장 큼 · 패시브. 브랜드색을 여기 한 곳에만 쓴다(무엇이 제일 중요한지 눈으로 보이게). */}
        <div className="mx-3 mb-2 rounded-xl border border-brand/25 bg-brand/[0.04] dark:bg-brand/[0.08] p-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-brand text-white text-[11px] font-extrabold flex items-center justify-center">1</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-extrabold text-gray-900 dark:text-white">가게를 데려오세요</p>
              <p className="mt-1 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
                내 초대 링크로 등록한 가게는 <b className="text-gray-900 dark:text-white">매출의 {COMMISSION_DEFAULTS.INFLUENCER_STORE_INTRO_PCT}%</b>를{' '}
                <b className="text-gray-900 dark:text-white">{COMMISSION_DEFAULTS.INFLUENCER_STORE_INTRO_MONTHS / 12}년간</b> 받습니다.
                <br />
                <span className="text-gray-500 dark:text-gray-400">그 가게가 스스로 팔아도 내 몫이에요 — 내가 아무것도 안 해도 들어옵니다.</span>
              </p>
              <button
                onClick={copyInvite}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-bold text-white active:opacity-80"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? '복사됨' : '초대 링크 복사'}
              </button>
            </div>
          </div>
        </div>

        {/* 2단 — 조건. 여기가 비면 3단이 0원이라 그 사실을 그대로 적는다. */}
        <div className="mx-3 mb-2 rounded-xl border border-gray-200 dark:border-[#2C2F35] p-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-[#0D0F12] text-[11px] font-extrabold flex items-center justify-center">2</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-extrabold text-gray-900 dark:text-white">
                그 가게와 소개비를 정하세요
                {dealCount > 0 && <span className="ml-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">계약 {dealCount}곳</span>}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
                가게가 “이 이용권 팔아주면 몇 %” 를 정해 제안합니다. 수락하면 계약이 됩니다.
                {dealCount === 0 && (
                  <>
                    <br />
                    <span className="font-bold text-amber-700 dark:text-amber-400">⚠️ 계약이 없으면 아래 3단은 팔려도 0원입니다.</span>
                  </>
                )}
              </p>
              <Link
                to="/influencer/settlement"
                className="mt-2.5 inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-[#2C2F35] px-3 py-1.5 text-[12px] font-bold text-gray-700 dark:text-gray-200 active:opacity-70"
              >
                내 계약·정산 보기 <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* 3단 — 이미 하고 있는 것. 위 둘을 하면 여기가 돈이 된다는 연결을 적는다. */}
        <div className="mx-3 mb-3 rounded-xl border border-gray-200 dark:border-[#2C2F35] p-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-[#0D0F12] text-[11px] font-extrabold flex items-center justify-center">3</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-extrabold text-gray-900 dark:text-white">
                담아서 파세요
                {pinCount > 0 && <span className="ml-1.5 text-[11px] font-bold text-gray-400">{pinCount}개 담음</span>}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
                담은 이용권은 내 유어샵에 <b className="text-gray-900 dark:text-white">계속 남습니다</b>. 내 샵으로 팔릴 때마다 소개비가 붙어요.
                <br />
                <span className="text-gray-500 dark:text-gray-400">1단으로 데려온 가게라면 <b>2%와 소개비를 둘 다</b> 받습니다.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
