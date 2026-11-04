/**
 * 📷 요청 사진 주소 검사 — 공개 공유 뷰(`home-service-share`)가 이것 하나만 필요해서 따로 뺐다(2026-11-04).
 *   `home-service.ts` 를 통째로 끌면 업체 화면 첫 화면이 +1KB(surface-budgets). 정본은 여기, `home-service.ts` 는 다시 내보낸다.
 *
 * 우리 업로드 주소인가 — `/api/upload/image` 가 돌려주는 두 모양(같은 출처 `/api/media/uploads/...` 또는
 * R2 공개 도메인 `https://.../uploads/...`)만. 남의 주소를 끼워 넣어 업체 화면에 띄우지 못하게 한다.
 * 누가 올렸는지는 서버 라우트가 `uploads/user/<본인>/` 으로 따로 본다.
 */
export function isRequestPhotoUrl(u: string): boolean {
  return /^(?:\/api\/media\/|https:\/\/[a-z0-9.-]+\/)uploads\/user\/\d+\/\d{4}-\d{2}\/[A-Za-z0-9_-]+\.(?:jpg|png|webp|gif)$/.test(u) && u.length <= 200
}
