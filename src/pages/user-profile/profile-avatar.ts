/**
 * 👤 마이 프로필 사진 — 사진이 없거나 못 불러오면 **유달이**(2026-10-18).
 *
 * 왜: 종전엔 사진이 없는 사람에게 `ui-avatars.com`(외부 사이트)의 이니셜 그림을 썼다.
 *   ① 그 요청이 실패하면 `cfImageOnError` 가 그림을 숨겨 **이름 왼쪽이 빈 칸**이 됐다(하네스 실측 — 폰·PC 둘 다)
 *   ② 요청 주소에 **사용자 이름이 그대로** 실려 외부로 나갔다
 *   ③ 유어샵 머리(2026-10-14 대표 확정 A)는 사진이 없으면 유달이다 — 같은 사람이 두 화면에서 다른 얼굴이었다.
 * ⇒ 유어샵과 **같은 그림**(`SHARE_MASCOT_SRC`, 우리 오리진)으로 통일한다.
 */
import { cfImage } from '@/utils/cf-image'
import { SHARE_MASCOT_SRC } from '@/shared/ushop-share-card'

export const PROFILE_FALLBACK_SRC = SHARE_MASCOT_SRC

/** 사진이 있으면 리사이즈한 사진, 없으면 유달이. */
export function profileAvatarSrc(image: string | null | undefined, width: number): string {
  return image ? cfImage(image, { width }) : PROFILE_FALLBACK_SRC
}

/** 리사이즈 실패 → 원본 1회 → 그래도 실패하면 **숨기지 않고** 유달이로 바꾼다(빈 칸 금지). */
export function profileAvatarOnError(img: HTMLImageElement | null | undefined, original?: string | null): void {
  if (!img) return
  const step = img.dataset.avatarFallback
  if (!step && original && img.getAttribute('src') !== original) {
    img.dataset.avatarFallback = '1'
    img.removeAttribute('srcset')
    img.src = original
    return
  }
  if (step !== '2') {
    img.dataset.avatarFallback = '2'
    img.removeAttribute('srcset')
    img.src = PROFILE_FALLBACK_SRC
    img.style.objectFit = 'contain'
  }
}

/** 유달이일 때는 잘리지 않게 contain + 옅은 바탕. */
export function profileAvatarFitCls(image: string | null | undefined): string {
  return image ? 'object-cover' : 'object-contain bg-wash'
}
