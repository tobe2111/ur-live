# 이미지 최적화 가이드 (R2 + Workers Image Resizing)

## 개요
- **비용**: $0 추가 (Workers $5/month 플랜에 포함)
- **대안**: Cloudflare Images ($5/month + 종량제) 대신 무료 솔루션
- **기술**: R2 Storage + Cloudflare Workers Image Resizing
- **지원 형식**: WebP, JPEG, PNG, GIF 등

## 1️⃣ Workers Image Resizing 활성화

### Cloudflare 대시보드 설정
1. https://dash.cloudflare.com 접속
2. **Workers & Pages** → 프로젝트 선택 (`ur-live`)
3. **Settings** → **Functions** → **Image Resizing** 활성화
4. **Save** 클릭

### 설정 확인
```bash
# Wrangler CLI로 확인
npx wrangler pages project get ur-live

# Image Resizing 옵션이 활성화되어 있어야 함
```

## 2️⃣ 사용 방법

### 업로드 API
```typescript
// POST /api/seller/upload-image
const response = await api.post('/api/seller/upload-image', {
  image: base64Image,
  filename: 'product.jpg'
})

// 응답 예시
{
  "success": true,
  "url": "/api/images/products/123/abc-def-ghi.jpg",
  "variants": {
    "thumbnail": "/api/images/products/123/abc-def-ghi.jpg?width=200&format=webp",
    "medium": "/api/images/products/123/abc-def-ghi.jpg?width=800&format=webp",
    "large": "/api/images/products/123/abc-def-ghi.jpg?width=1600&format=webp",
    "original": "/api/images/products/123/abc-def-ghi.jpg"
  },
  "storage": "r2"
}
```

### 이미지 조회 (자동 리사이징)
```html
<!-- 썸네일 (200px, WebP) -->
<img src="/api/images/products/123/abc.jpg?width=200&format=webp" />

<!-- 중간 사이즈 (800px, WebP) -->
<img src="/api/images/products/123/abc.jpg?width=800&format=webp" />

<!-- 원본 -->
<img src="/api/images/products/123/abc.jpg" />
```

### Query Parameters
- `width`: 원하는 너비 (픽셀)
- `format`: 출력 형식 (`webp`, `jpeg`, `png`, `gif`)
- `quality`: 품질 (1-100, 기본값 85)

### 예시
```html
<!-- 400px 너비, WebP, 품질 90 -->
<img src="/api/images/products/123/abc.jpg?width=400&format=webp&quality=90" />

<!-- 1200px 너비, JPEG, 품질 80 -->
<img src="/api/images/products/123/abc.jpg?width=1200&format=jpeg&quality=80" />
```

## 3️⃣ React 컴포넌트 예시

### 최적화된 이미지 컴포넌트
```tsx
interface OptimizedImageProps {
  src: string;
  alt: string;
  size?: 'thumbnail' | 'medium' | 'large' | 'original';
  className?: string;
}

function OptimizedImage({ src, alt, size = 'medium', className }: OptimizedImageProps) {
  const sizeMap = {
    thumbnail: 200,
    medium: 800,
    large: 1600,
    original: undefined
  };
  
  const width = sizeMap[size];
  const optimizedSrc = width 
    ? `${src}?width=${width}&format=webp`
    : src;
  
  return (
    <img 
      src={optimizedSrc} 
      alt={alt} 
      className={className}
      loading="lazy"
    />
  );
}

// 사용 예시
<OptimizedImage 
  src="/api/images/products/123/abc.jpg"
  alt="상품 이미지"
  size="medium"
  className="w-full h-auto"
/>
```

### 반응형 이미지 (srcset)
```tsx
function ResponsiveImage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={`${src}?width=800&format=webp`}
      srcSet={`
        ${src}?width=400&format=webp 400w,
        ${src}?width=800&format=webp 800w,
        ${src}?width=1200&format=webp 1200w
      `}
      sizes="(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px"
      alt={alt}
      loading="lazy"
      className="w-full h-auto"
    />
  );
}
```

## 4️⃣ 성능 비교

### Before (원본 JPEG)
- 파일 크기: 2.5MB
- 로딩 시간: 3-5초 (3G)
- CDN 비용: 높음

### After (WebP + Resizing)
- 파일 크기: 150-300KB (80-90% 감소)
- 로딩 시간: 0.3-0.5초 (3G)
- CDN 비용: 낮음
- 자동 캐싱: 31536000초 (1년)

## 5️⃣ 비용 분석

### Cloudflare Images (유료)
- 기본: $5/month (최대 100,000 이미지)
- 추가: $1/1,000 이미지
- 트래픽: $1/GB (무료 100GB 초과 시)
- **월 예상 비용**: $5-20

### Workers Image Resizing (무료)
- 비용: $0 (Workers $5/month 플랜에 포함)
- 이미지 수: 무제한
- 트래픽: R2 egress 무료 (Cloudflare CDN 사용 시)
- **월 예상 비용**: $0

### 절감액
- **월 $5-20 절감** (100% 무료)

## 6️⃣ 제한사항

### Workers Image Resizing 제한
- 최대 입력 크기: 50MB
- 최대 출력 크기: 50MB
- 지원 형식: JPEG, PNG, GIF, WebP, SVG
- 처리 시간: ~100-300ms (첫 요청)
- 캐싱: 자동 CDN 캐싱 (이후 5-10ms)

### R2 Storage 제한
- 무료 티어: 10GB 저장소, 1M Class A, 10M Class B
- 초과 시: $0.015/GB (저장), $0.36/1M (Class A), $0.36/10M (Class B)
- Egress: Cloudflare CDN 사용 시 무료

## 7️⃣ 모범 사례

### 1. 항상 WebP 사용
```html
<!-- ✅ 권장 -->
<img src="/api/images/product.jpg?width=800&format=webp" />

<!-- ❌ 비권장 (큰 파일 크기) -->
<img src="/api/images/product.jpg" />
```

### 2. 적절한 사이즈 선택
```tsx
// 썸네일: 200-400px
<img src={`${url}?width=200&format=webp`} />

// 제품 상세: 800-1200px
<img src={`${url}?width=800&format=webp`} />

// 확대 이미지: 1600-2400px
<img src={`${url}?width=1600&format=webp`} />
```

### 3. Lazy Loading 활용
```html
<img 
  src="/api/images/product.jpg?width=800&format=webp" 
  loading="lazy"
  alt="상품 이미지"
/>
```

### 4. 캐시 헤더 확인
```bash
# 캐시 헤더 확인
curl -I https://live.ur-team.com/api/images/products/123/abc.jpg

# 예상 응답
Cache-Control: public, max-age=31536000
```

## 8️⃣ 트러블슈팅

### 이미지가 리사이징되지 않음
1. Cloudflare 대시보드에서 Image Resizing 활성화 확인
2. 캐시 무효화: `?width=800&format=webp&v=2`
3. 브라우저 캐시 삭제

### 느린 로딩 속도
1. CDN 캐싱 확인 (첫 요청은 느릴 수 있음)
2. R2 공개 URL 확인
3. Query parameter 올바른지 확인

### 이미지 깨짐
1. 원본 이미지 형식 확인 (JPEG, PNG, WebP만 지원)
2. 파일 크기 확인 (50MB 이하)
3. Content-Type 헤더 확인

## 9️⃣ 다음 단계

### 즉시 적용
1. ✅ Cloudflare 대시보드에서 Image Resizing 활성화
2. ✅ 기존 이미지 컴포넌트에 `?width=800&format=webp` 추가
3. ✅ 모든 이미지에 `loading="lazy"` 추가

### 추후 개선
- [ ] Progressive JPEG 지원
- [ ] AVIF 형식 지원 (더 높은 압축률)
- [ ] 이미지 CDN 도메인 분리 (예: images.ur-live.com)
- [ ] 스마트 크롭 (얼굴 인식 등)

## 📚 관련 문서
- Cloudflare Workers Image Resizing: https://developers.cloudflare.com/workers/examples/image-resizing/
- R2 Storage: https://developers.cloudflare.com/r2/
- WebP 형식: https://developers.google.com/speed/webp

## 💰 비용 절감 요약
- **Cloudflare Images 대비**: 월 $5-20 절감
- **Sharp + 별도 서버 대비**: 월 $10-50 절감 (서버 비용)
- **총 절감액**: 연간 $60-240 절감
