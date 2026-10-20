/**
 * Cloudflare Images 최적화
 * 
 * 사용법:
 * 1. 관리자 페이지에서 이미지 업로드 → POST /api/admin/upload
 * 2. 업로드된 imageId를 D1에 저장
 * 3. 프론트엔드에서 ResponsiveImage 컴포넌트 사용
 */

/**
 * Cloudflare Images 변형(Variant) 설정
 * 
 * 변형 종류:
 * - thumbnail: 300x300, WebP, 품질 80, 프로필/썸네일용
 * - medium: 800x800, WebP, 품질 85, 일반 상품 이미지
 * - large: 1200x1200, WebP, 품질 90, 상세 이미지
 * 
 * 변형은 Cloudflare Dashboard에서 미리 생성해야 합니다:
 * https://dash.cloudflare.com/{account_id}/images/variants
 */
export type ImageVariant = 'thumbnail' | 'medium' | 'large' | 'public';

/**
 * Cloudflare Images URL 생성
 * 
 * @param imageId - Cloudflare Images에 저장된 이미지 ID
 * @param variant - 이미지 변형 (thumbnail, medium, large, public)
 * @returns 이미지 URL
 * 
 * @example
 * ```ts
 * const url = getImageUrl('abc123', 'medium');
 * // https://imagedelivery.net/<ACCOUNT_HASH>/abc123/medium
 * ```
 */
export function getImageUrl(imageId: string, variant: ImageVariant = 'public'): string {
  // ACCOUNT_HASH는 Cloudflare Dashboard > Images > Overview에서 확인
  // Vite (browser): import.meta.env.VITE_CLOUDFLARE_IMAGES_ACCOUNT_HASH
  // Worker: globalThis.CLOUDFLARE_IMAGES_ACCOUNT_HASH (env binding)
  // 🛡️ process.env 는 Cloudflare Workers/브라우저 런타임에 존재하지 않아
  //   기존 코드는 항상 'YOUR_ACCOUNT_HASH_HERE' 플레이스홀더로 폴백되어
  //   깨진 URL 을 사용자에게 송출하고 있었다.
  let accountHash: string | undefined;
  try {
    // Vite-injected env (browser bundle)
    accountHash = (import.meta as { env?: Record<string, string | undefined> })
      .env?.VITE_CLOUDFLARE_IMAGES_ACCOUNT_HASH;
  } catch {
    // import.meta 미지원 환경 무시
  }
  if (!accountHash && typeof globalThis !== 'undefined') {
    accountHash = (globalThis as unknown as Record<string, string | undefined>)
      .CLOUDFLARE_IMAGES_ACCOUNT_HASH;
  }
  if (!accountHash) {
    // Cloudflare Images 가 구성되지 않은 경우 깨진 URL 대신 빈 문자열을 반환하여
    // <img src=""> 가 onerror 폴백을 트리거하도록 한다.
    return '';
  }
  return `https://imagedelivery.net/${accountHash}/${imageId}/${variant}`;
}

/**
 * srcSet 생성 (반응형 이미지용)
 * 
 * @param imageId - Cloudflare Images 이미지 ID
 * @returns srcSet 문자열
 * 
 * @example
 * ```jsx
 * <img
 *   src={getImageUrl(imageId, 'medium')}
 *   srcSet={getImageSrcSet(imageId)}
 *   alt="Product"
 * />
 * ```
 */
export function getImageSrcSet(imageId: string): string {
  return `
    ${getImageUrl(imageId, 'thumbnail')} 300w,
    ${getImageUrl(imageId, 'medium')} 800w,
    ${getImageUrl(imageId, 'large')} 1200w
  `.trim().replace(/\s+/g, ' ');
}

/**
 * 비용 계산 (참고용)
 * 
 * Cloudflare Images 가격:
 * - 저장: 이미지 10만 개당 $5/월
 * - 전송: 전송 10만 건당 $1/월
 * - 변형: 무제한 무료
 * 
 * 예상 비용 (월간):
 * - 이미지 1,000개 저장: $0.05
 * - 이미지 10,000개 저장: $0.50
 * - 이미지 100,000개 저장: $5.00
 * - 전송 100,000건: $1.00
 * - 전송 1,000,000건: $10.00
 * 
 * 총 예상 비용 (10,000 이미지 + 100,000 전송):
 * $0.50 (저장) + $1.00 (전송) = $1.50/월
 */
export function estimateMonthlyCost(
  imageCount: number,
  monthlyViews: number
): { storage: number; delivery: number; total: number } {
  const storageRate = 5 / 100000; // $5 per 100k images
  const deliveryRate = 1 / 100000; // $1 per 100k deliveries
  
  const storage = Math.max(0.05, imageCount * storageRate); // 최소 $0.05
  const delivery = monthlyViews * deliveryRate;
  const total = storage + delivery;
  
  return {
    storage: parseFloat(storage.toFixed(2)),
    delivery: parseFloat(delivery.toFixed(2)),
    total: parseFloat(total.toFixed(2))
  };
}
