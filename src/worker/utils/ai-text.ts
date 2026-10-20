/**
 * 🤖 Workers AI 응답에서 텍스트 꺼내기 — SSOT.
 *
 * 2026-09-16. 같은 줄(`result.description || result.response`)이 **세 곳**에 복제돼 있었다:
 * 메뉴 OCR(`routes/ocr.routes.ts`) · 분쟁 분류(`routes/disputes.routes.ts`) · 서류 OCR(`ocr-license.ts`).
 *
 * ## 왜 `unknown` 을 받나
 * Workers AI 는 **모델마다 응답 모양이 다르다**(비전 모델은 `description`, 텍스트 모델은 `response`,
 * 어떤 것은 그냥 문자열). `Env.AI.run` 을 특정 모양으로 좁혀 선언하면 다른 모델을 부르는 순간
 * 타입은 통과하고 런타임에 `undefined` 가 된다 — 에러가 안 나서 아무도 모른다.
 * ⇒ 선언은 정직하게 `Promise<unknown>` 으로 두고, **꺼내는 책임을 이 함수 하나**에 모은다.
 */

/**
 * 모델 응답에서 사람이 읽을 텍스트를 꺼낸다. 못 꺼내면 빈 문자열(예외 없음).
 *
 * ⚠️ 빈 문자열을 "모델이 거절했다" 로 읽지 말 것 — 그냥 모양이 다를 수도 있다.
 * 호출부는 빈 값을 **"못 읽었다"** 로만 다뤄야 한다.
 */
export function aiText(res: unknown): string {
  if (typeof res === 'string') return res.trim()
  if (res && typeof res === 'object') {
    const o = res as Record<string, unknown>
    for (const k of ['response', 'description', 'text', 'output_text'] as const) {
      const v = o[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
  }
  return ''
}
