/**
 * 📱 고정 화면 스토리 — 폰은 멈춰 있고 글이 지나간다 (2026-10-31, `/partners` "손님이 오는 길" · `/about` "사장님은 이렇게").
 *
 * PC: 왼쪽 폰이 화면에 붙어 있고, 오른쪽 단계가 화면 가운데를 지날 때마다 폰 화면이 그 단계 화면으로 바뀐다.
 *     세로 레일이 지나온 만큼 파랗게 차오른다.
 * 폰: 고정하면 화면 절반을 폰이 먹는다 → 단계마다 작은 화면을 옆에 둔 평범한 목록.
 *
 * 왜: 점 네 개짜리 가로 타임라인이 세 랜딩에 다 있었다 — 가장 흔한 AI 랜딩 그림이다. 순서를 선이 아니라
 *   **실제 화면**이 말하게 한다.
 *
 * ■ 2026-11-01 고급화 ③④: 폰을 실기기 모양(`ur-device`)으로, 단계마다 `tone` 을 주면 바깥 `ToneScroll` 이
 *   그 단계를 지날 때 바탕색을 바꾼다. 글자는 `ur-tone-fg/mu` 라 바탕과 **함께** 바뀌고, 묶음 밖에서는
 *   테마 기본색으로 떨어진다.
 */
import { useActiveStep } from './motion'
import type { Tone } from './premium'

export type StoryStep = { t: string; d: string; shot: string; alt: string; tone?: Tone }

export default function StickyStory({ steps, shotUrl }: { steps: StoryStep[]; shotUrl: (n: string) => string }) {
  const [ref, active] = useActiveStep(steps.length)
  return (
    <div ref={ref} className="lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 xl:gap-28">
      <div className="hidden lg:block">
        <div className="sticky top-28">
          <div className="ur-device mx-auto w-[18.5rem] xl:w-[20rem]">
            <div className="ur-device-screen">
              {steps.map((s, i) => (
                <img key={s.shot} src={shotUrl(s.shot)} alt={i === active ? s.alt : ''} aria-hidden={i !== active}
                  width={430} height={930} loading="lazy" decoding="async" data-on={i === active ? 1 : 0}
                  className="ur-story-shot block object-cover object-top" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <ol className="relative">
        <span aria-hidden className="hidden lg:block absolute left-[7px] top-3 bottom-3 w-px bg-rule-strong opacity-40" />
        <span aria-hidden className="ur-story-rail hidden lg:block absolute left-[7px] top-3 bottom-3 w-px bg-brand"
          style={{ ['--story' as string]: String((active + 1) / steps.length) }} />
        {steps.map(({ t, d, shot, alt, tone }, i) => (
          <li key={t} data-step={i} data-tone={tone} data-on={i === active ? 1 : 0}
            className="ur-story-step relative flex gap-5 items-center py-6 lg:pl-14 lg:min-h-[58vh] lg:py-0 lg:flex-col lg:items-start lg:justify-center">
            <span aria-hidden className="ur-story-dot hidden lg:block absolute left-0 top-1/2 -mt-[7px] w-[15px] h-[15px] rounded-full bg-rule-strong ring-4 ring-[color:var(--tone-bg,var(--surface))]" />
            <div className="lg:hidden w-24 shrink-0 ur-device">
              <div className="ur-device-screen">
                <img src={shotUrl(shot)} alt={alt} width={430} height={930} loading="lazy" decoding="async" />
              </div>
            </div>
            <div>
              <p className="text-[24px] font-bold lg:text-[48px] xl:text-[60px] lg:font-extrabold ur-tone-fg ur-display tracking-[-0.03em] leading-tight">{t}</p>
              <p className="mt-3 lg:mt-5 text-[13px] lg:text-[17px] leading-[1.75] ur-tone-mu max-w-[26em]">{d}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
