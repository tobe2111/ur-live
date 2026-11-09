/**
 * 🏷️ 목록 카드에 붙는 '다녀온 사람들' 수 문구 — 카드(클라)와 서버 첫 화면이 **같은 함수**를 쓴다(글자가 다르면 첫 화면 뒤 줄이 바뀐다).
 * 별점 줄 안에 붙는다(새 줄을 만들지 않는다 — 카드 높이가 그대로라 밀림 0).
 */
export function creatorCountLabel(n: number): string {
  return `SNS 후기 ${n > 99 ? '99+' : n}`
}
