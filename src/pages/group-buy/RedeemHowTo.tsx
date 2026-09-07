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
 */

const STEPS: readonly { n: string; t: string; d: string }[] = [
  { n: '1', t: '매장에 가서 이용권을 엽니다', d: '마이 → 내 이용권에서 해당 이용권을 여세요. 미리 열어 두면 계산이 빨라요.' },
  { n: '2', t: '직원에게 QR 을 보여 주세요', d: '직원이 스캔하면 바로 사용 처리됩니다. 대부분 여기서 끝나요.' },
  { n: '3', t: '스캔이 안 되면 매장 확인코드를 물어보세요', d: '직원에게 4~6자리 확인코드를 받아 화면에 입력하면 사용됩니다.' },
]

export default function RedeemHowTo() {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--gbd-ink)', marginBottom: 10 }}>
        매장에서 사용하는 방법
      </div>
      <ol style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: 0, padding: 0, listStyle: 'none' }}>
        {STEPS.map((s) => (
          <li key={s.n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span
              aria-hidden
              style={{
                flexShrink: 0, width: 20, height: 20, borderRadius: 999, background: 'var(--gbd-ink)',
                color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center',
                justifyContent: 'center', marginTop: 1,
              }}
            >
              {s.n}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--gbd-ink)', lineHeight: 1.45 }}>{s.t}</div>
              <div style={{ fontSize: 12.5, color: 'var(--gbd-sub)', lineHeight: 1.5, marginTop: 2 }}>{s.d}</div>
            </div>
          </li>
        ))}
      </ol>
      <p style={{ fontSize: 12, color: 'var(--gbd-sub)', lineHeight: 1.5, marginTop: 12 }}>
        ※ 확인코드는 <b>매장에서만</b> 알려 드려요 — 집에서 미리 사용 처리할 수 없습니다.
      </p>
    </div>
  )
}
