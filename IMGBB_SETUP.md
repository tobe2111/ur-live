# ImgBB 무료 이미지 호스팅 설정 가이드

## 1. API 키 발급 (1분)
1. https://imgbb.com 접속
2. 회원가입 (무료)
3. https://api.imgbb.com/ 접속
4. "Get API key" 클릭
5. API 키 복사

## 2. 환경 변수 설정

`.dev.vars` 파일 생성:
```
IMGBB_API_KEY=your-api-key-here
```

## 3. API 코드 (src/index.tsx에 추가)

```typescript
// ImgBB 업로드 프록시 (API 키 숨김)
app.post('/api/upload-imgbb', cors(), async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return c.json({ success: false, error: 'No file' }, 400)
    }
    
    // 파일을 base64로 변환
    const arrayBuffer = await file.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    
    // ImgBB API 호출
    const imgbbFormData = new FormData()
    imgbbFormData.append('image', base64)
    
    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${c.env.IMGBB_API_KEY}`,
      {
        method: 'POST',
        body: imgbbFormData
      }
    )
    
    const data = await response.json()
    
    if (!data.success) {
      throw new Error(data.error.message)
    }
    
    return c.json({
      success: true,
      data: {
        url: data.data.url,
        display_url: data.data.display_url,
        thumb_url: data.data.thumb.url,
        medium_url: data.data.medium.url
      }
    })
  } catch (err) {
    return c.json({
      success: false,
      error: (err as Error).message
    }, 500)
  }
})
```

## 4. 프론트엔드 수정 (SellerProductNewPage.tsx)

```typescript
async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return
  
  setUploading(true)
  
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await axios.post('/api/upload-imgbb', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (e.total) {
          setUploadProgress(Math.round((e.loaded * 100) / e.total))
        }
      }
    })
    
    if (response.data.success) {
      setFormData({
        ...formData,
        image_url: response.data.data.url
      })
    }
  } catch (error) {
    setError('업로드 실패')
  } finally {
    setUploading(false)
  }
}
```

## 5. wrangler.jsonc에 환경 변수 추가

개발 환경:
```jsonc
// .dev.vars 파일에만 작성
IMGBB_API_KEY=your-key-here
```

프로덕션 환경:
```bash
wrangler secret put IMGBB_API_KEY
# 프롬프트에서 API 키 입력
```

## 장점
✅ 완전 무료
✅ 무제한 저장
✅ 무제한 대역폭
✅ CDN 제공
✅ 5분 안에 적용 가능
✅ API 키만 있으면 끝

## 용량 제한
- 파일당 최대: 32MB
- 총 저장: 무제한
- 트래픽: 무제한

## 예상 사용량
- 초기: 100-500개 상품 → 완전 무료
- 성장기: 1,000-10,000개 상품 → 완전 무료
- 확장기: 무제한 → 완전 무료!
