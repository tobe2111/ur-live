/**
 * 🎟️ **이용권을 매장에서 어떻게 쓰나** (2026-09-04 대표 — *"사용방법을 더 자세히. QR 제시를 할 수도
 * 있고 PIN 입력 요청을 가게에 해야할 수도 있잖아"*).
 *
 * ## 🩸 그전엔 한 줄이었다
 * 상세의 이용 안내에 **`사용 방법: 매장에서 교환권 제시`** 만 있었다. 손님이 매장에 도착해서
 * *무엇을 꺼내 무엇을 눌러야 하는지*를 모른다 — 그 순간의 막힘은 그대로 사장님 응대 부담이 된다.
 *
 * ## 실제로 두 갈래다 (`redemption-settings.ts` · `self-redeem-gate.ts`)
 * | 모드 | 손님이 하는 일 |
 * |---|---|
 * | `scan_only` | QR 을 보여 주고 **직원이 스캔**한다. 손님은 혼자 못 누른다 |
 * | `store_code`(기본) | 손님이 앱에서 누르되 **매장 확인코드(4~6자리)** 를 매장에 물어 입력한다 |
 *
 * 🔑 **두 방식은 양자택일이 아니다.** 직원 QR 스캔(`/:code/use-by-seller`)은 셀프 게이트 **밖**이라
 *   모드와 무관하게 항상 열려 있다(`self-redeem-gate.ts` 주석). 그래서 손님 입장의 1순위는
 *   **언제나 "QR 보여 주기"** 이고, 확인코드는 직원이 스캔을 못 할 때의 길이다.
 *
 * ⚠️ 상세 API 는 상품별 모드를 안 내려준다(`group-buy-public.routes` 는 사용 시점에만 조회).
 *   그래서 **모드와 무관하게 참인 순서**로만 쓴다 — 없는 것을 아는 척하지 않는다.
 *   모드를 내려주게 되면 그때 분기하면 된다.
 *
 * ## 2026-10-11 — 세로 목록 → **STEP 타일 3장** (대표 확정 "D안 + C안의 이용안내 형태, 디자인 고도화")
 * 접힌 세로 목록은 눌러야 보였고, 펼치면 글이 길었다. 손님이 매장 앞에서 보는 건 **세 동작**뿐이라
 * 타일 3장(아이콘 · STEP · 한 줄)으로 늘 펼쳐 두고, 예외(스캔이 안 될 때)는 타일 아래 한 줄로 뺐다.
 * 순서·사실은 그대로다: 1순위는 언제나 QR, 확인코드는 스캔이 안 될 때의 길.
 *
 * ## 2026-10-11 (같은 날) — 타일 → **세로 타임라인** (대표 시안 6종 중 *"1번으로 진행해줘"*)
 * 번호 원을 세로선으로 잇고, "스캔이 안 되면?" 을 **2단계 바로 아래 갈래**로 붙였다 — 예외가 어느
 * 순간의 일인지가 자리로 읽힌다. 3단계 원은 옅게(끝났다는 표시), 1·2는 브랜드 면.
 */

/** 각 단계: 제목(무엇을) + 한 줄(어디서·누가). */
const STEPS: readonly { n: string; t: string; d: string }[] = [
  { n: '1', t: '내 이용권에서 QR 열기', d: '마이 → 내 이용권' },
  { n: '2', t: '직원에게 QR 보여주기', d: '직원이 스캔해요' },
  { n: '3', t: '바로 사용 완료', d: '따로 누를 건 없어요' },
]

/** 스캔이 안 될 때의 길 — 매장 확인코드(4~6자리, `self-redeem-gate`)와 일치. 집에서 미리 쓸 수 없다. */
export const REDEEM_FALLBACK = '직원에게 4~6자리 확인코드를 받아 입력해요. 확인코드는 매장에서만 알려 드려요.'

export default function RedeemHowTo() {
  return (
    <ol className="m-0 p-0 list-none">
      {STEPS.map(({ n, t, d }, i) => {
        const last = i === STEPS.length - 1
        return (
          <li key={n} className="flex gap-4">
            {/* 번호 원 + 다음 단계로 잇는 세로선 */}
            <div className="flex flex-col items-center shrink-0">
              <span
                aria-hidden
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-medium ${last ? 'text-brand-text' : 'bg-brand text-white'}`}
                style={last ? { background: 'var(--gbd-accent-soft)' } : undefined}
              >{n}</span>
              {!last && <span aria-hidden className="w-[2px] flex-1 my-1 rounded-full" style={{ background: 'var(--gbd-accent-soft)' }} />}
            </div>
            <div className={`min-w-0 pt-1 ${last ? '' : 'pb-5'}`}>
              <div className="text-[15px] font-medium" style={{ color: 'var(--gbd-ink)' }}>{t}</div>
              <div className="mt-1 text-[13px]" style={{ color: 'var(--gbd-sub)' }}>{d}</div>
              {/* 🔀 예외는 그 일이 일어나는 단계(2 — 스캔) 바로 아래에 갈래로 */}
              {n === '2' && (
                <div className="mt-3 rounded-xl px-3 py-3 text-[13px] leading-[1.5]" style={{ background: 'var(--gbd-chip)', color: 'var(--gbd-ink2)' }}>
                  <b className="font-medium" style={{ color: 'var(--gbd-ink)' }}>스캔이 안 되면?</b>
                  <br />{REDEEM_FALLBACK}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
