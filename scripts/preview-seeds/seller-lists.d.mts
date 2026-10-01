/**
 * 🪑 `seller-lists.mjs` 타입 선언 — 시험이 그 모듈을 import 하기 때문에 필요하다.
 *   (이 레포의 다른 `.mjs` 도구들과 같은 방식: `scripts/*.d.mts`.)
 */
export declare const SELLER_LIST_PATHS: readonly string[]

export declare function sellerListResponse(
  path: string,
  mode?: 'full' | 'empty' | string,
): { success: boolean; data: unknown; [k: string]: unknown } | null
