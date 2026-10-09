/**
 * 🔔 2026-10-08 (대표 "1,2 모두 진행해줘" — ② 아이폰에서 성공했는지 알려주기).
 *
 * 🩸 종전 신호는 `navigator.vibrate` **하나**였다. 아이폰 사파리에는 그 함수가 **없다** —
 *   그래서 아이폰 계산대에서는 사용 처리가 됐는지 화면 글씨를 다시 들여다봐야만 알았다
 *   (손님 앞에서 폰을 다시 들어 읽는다). 에러가 아니라서 아무도 신고하지 않는 종류다.
 *
 * 세 겹으로 알린다(어느 하나가 막혀도 나머지가 전한다):
 *   ① 화면 전체 색 깜빡임(초록/빨강) — 모든 기기. 무음 모드에서도 보인다. **유일하게 늘 되는 신호.**
 *   ② 짧은 소리(Web Audio) — 성공은 높은 두 음, 실패는 낮은 두 번.
 *   ③ 진동 — 안드로이드(종전 패턴 그대로).
 *
 * ⚠️ 아이폰의 소리는 **사용자 탭 안에서 오디오를 깨워 둬야** 난다(자동재생 정책).
 *   그래서 `primeScanSound()` 를 화면을 누를 때마다(pointerdown) 부른다 — 사장님은 [사용 처리] 를
 *   누르므로 결과가 오기 전에 반드시 한 번은 깨어 있다. 깨우기 전의 결과(첫 스캔의 '없는 코드')는
 *   소리 없이 ①·③ 으로만 알린다.
 * ⚠️ 아이폰 무음 스위치가 켜져 있으면 Web Audio 도 무음이다 — 그래서 ① 이 주 신호다.
 * ⚠️ 오디오 파일을 받지 않는다(합성) — 네트워크 0, 번들 0.
 */

type AudioCtor = typeof AudioContext
let ctx: AudioContext | null = null

/** 사용자 제스처 안에서 부른다. 이미 깨어 있으면 아무것도 안 한다. */
export function primeScanSound(): void {
  try {
    if (!ctx) {
      const C = (window.AudioContext || (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext) as AudioCtor | undefined
      if (!C) return
      ctx = new C()
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  } catch { /* 미지원 — 소리 없이 간다 */ }
}

/** 성공 = 880→1320Hz 두 음(밝게) · 실패 = 220Hz 두 번(낮게). 합계 0.3초 안. */
export const SCAN_TONES: Record<'ok' | 'bad', Array<{ hz: number; at: number; dur: number }>> = {
  ok: [{ hz: 880, at: 0, dur: 0.09 }, { hz: 1320, at: 0.1, dur: 0.12 }],
  bad: [{ hz: 220, at: 0, dur: 0.12 }, { hz: 220, at: 0.17, dur: 0.12 }],
}

function playTones(ok: boolean): void {
  if (!ctx || ctx.state !== 'running') return
  const base = ctx.currentTime
  for (const { hz, at, dur } of SCAN_TONES[ok ? 'ok' : 'bad']) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = ok ? 'sine' : 'square'
    osc.frequency.value = hz
    // 딸깍 소리 없이 — 짧게 올렸다가 지수로 내린다.
    gain.gain.setValueAtTime(0.0001, base + at)
    gain.gain.exponentialRampToValueAtTime(ok ? 0.25 : 0.12, base + at + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, base + at + dur)
    osc.connect(gain).connect(ctx.destination)
    osc.start(base + at)
    osc.stop(base + at + dur + 0.02)
  }
}

/** ②·③ — 소리와 진동. ① 깜빡임은 화면 상태라 컴포넌트가 그린다. */
export function scanSignal(ok: boolean): void {
  try { playTones(ok) } catch { /* ignore */ }
  try { if (navigator.vibrate) navigator.vibrate(ok ? 80 : [60, 60, 60]) } catch { /* ignore */ }
}
