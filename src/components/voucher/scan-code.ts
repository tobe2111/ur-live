/**
 * QR 값(https://…/v/<code>)·딥링크·raw 코드에서 바우처 코드 추출.
 *
 * 🩸 2026-09-05 (대표 *"매장 계산대 페이지에서 바우처 코드 직접 입력하는게 왜 필요하지?"* 를
 *   파다 드러난 결함): **손으로 친 코드는 거의 항상 실패하고 있었다.**
 *   발급 코드는 `generateVoucherCode` 의 알파벳이 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` 라
 *   **전부 대문자**인데(라이브 실측: 전량 대문자), 서버 조회는 `WHERE code = ?` 라
 *   SQLite 기본 BINARY 대조 — 대소문자를 가린다(실측: 소문자로 조회하면 **0건**).
 *   그런데 이 입력칸은 `autoCapitalize` 가 없어 **폰 키보드가 소문자로 시작한다.**
 *   ⇒ 유효한 바우처인데 "바우처를 찾을 수 없습니다"(404) 가 뜬다. 카메라가 안 될 때 쓰라고
 *     만든 폴백이, 정작 그 상황에서 절반은 실패하는 상태였다.
 *
 * ⚠️ 대문자 정규화는 QR 경로에도 함께 적용된다 — QR 안의 코드도 이미 대문자라 **무해**하고
 *   (idempotent), 손상된 QR 을 부분 판독했을 때도 같은 규칙이 걸린다.
 * 공백은 통째로 지운다 — 사람은 `UR ABCD EFGH` 처럼 띄어 치고, 붙여넣기엔 공백이 딸려 온다.
 */
export function extractCode(raw: string): string | null {
  const v = (raw || '').replace(/\s+/g, '').toUpperCase()
  if (!v) return null
  const m = v.match(/\/V\/([A-Z0-9_-]{4,64})/)
  if (m) return m[1]
  if (/^[A-Z0-9_-]{4,64}$/.test(v)) return v
  return null
}
