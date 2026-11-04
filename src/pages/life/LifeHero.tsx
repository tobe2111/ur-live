/**
 * 🏠 생활 첫 화면 머리 — 2026-11-03 대표 확정 **안 5** (시안 https://claude.ai/artifact/BNd18HDtYuEf2p3iFu4rw7)
 *   대표 *"안 5가 가장 돋보이네 문구도 좋고"* → 실시간 한 줄은 **C**(실제 기록 있을 때만 · 없으면 지금 사실인 것).
 *
 * 종전(파란 판 + 회색 상자 셋)을 걷었다 — 판 안에 판이었고, 1·2·3 은 사용법일 뿐 이 서비스만의 것이 아니었고,
 * 화면 절반을 쓰면서 누를 버튼이 하나도 없었다. 이제 평면 제목·설명 + 주 버튼 하나 + 실시간 한 줄.
 * 버튼은 업종을 몰라서 바로 요청서로 갈 수 없다 → **업종 고르기 창**(아래 업종 그림과 같은 묶음)을 연다.
 */
import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { HomeServiceCategory } from '@/shared/home-service'
import { lifeLiveLine, type LifeLive } from './life-live'

const LifeCategoryPicker = lazy(() => import('./LifeCategoryPicker'))

export interface LifeGroup { title: string; keys: readonly HomeServiceCategory[] }

export default function LifeHero({ groups, open, live }: { groups: readonly LifeGroup[]; open: boolean; live: LifeLive | null }) {
  const [picking, setPicking] = useState(false)
  const line = lifeLiveLine(live, Date.now())
  return (
    <section aria-label="사장님 생활 견적" data-testid="life-hero" className="pt-1 pb-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-brand-text">사장님 생활 견적 서비스</span>
        <Link to="/life/requests" className="flex shrink-0 items-center text-[13px] font-medium text-ink active:opacity-70">
          내 견적 요청<ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <h1 className="mt-2 text-[20px] font-semibold leading-snug tracking-tight lg:text-[34px]">사장님, 가게 일은<br className="lg:hidden" /> 여기서 맡기세요</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">간판·방역·설비 수리까지, 근처 업체 견적을 무료로 비교해요.</p>
      <button
        type="button"
        disabled={!open}
        onClick={() => setPicking(true)}
        className="ur-btn ur-btn-lg ur-btn-primary mt-5 flex w-full justify-center disabled:opacity-50 lg:w-auto lg:px-10"
      >
        무료로 견적 받기
      </button>
      {!open && <p className="mt-2 text-[13px] font-medium text-tone-bad">지금은 잠시 요청을 받지 않아요.</p>}
      {line && (
        <p data-testid="life-live" className="mt-5 flex items-center gap-2 border-y border-rule py-3 text-[13px] text-gray-500 dark:text-gray-400">
          <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${line.fresh ? 'bg-tone-ok' : 'bg-brand'}`} />
          <span className="min-w-0 truncate">{line.text}</span>
        </p>
      )}

      {/* 창은 누를 때만 받는다 — 첫 화면 무게(시트 부품 +1.3KB)를 늘리지 않게. */}
      {picking && (
        <Suspense fallback={null}>
          <LifeCategoryPicker groups={groups} onClose={() => setPicking(false)} />
        </Suspense>
      )}
    </section>
  )
}
