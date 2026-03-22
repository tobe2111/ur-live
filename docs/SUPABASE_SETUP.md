# Supabase Storage 무료 이미지 호스팅 설정 가이드

## 1. Supabase 프로젝트 생성 (3분)
1. https://supabase.com 접속
2. 회원가입 (무료)
3. "New Project" 클릭
4. 프로젝트 이름, 비밀번호 설정
5. Region 선택: Northeast Asia (Seoul)
6. 프로젝트 생성 대기 (1-2분)

## 2. Storage 버킷 생성
1. 좌측 메뉴에서 "Storage" 클릭
2. "Create a new bucket" 클릭
3. Name: `products`
4. Public bucket: ✅ 체크 (공개 접근 허용)
5. Create bucket

## 3. API 키 확인
1. Settings > API 메뉴
2. Project URL 복사: `https://xxxxx.supabase.co`
3. anon public 키 복사: `eyJhbG...`

## 4. 환경 변수 설정

`.dev.vars` 파일:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
```

## 5. 백엔드 API (src/index.tsx)

```typescript
// Supabase Storage 업로드
app.post('/api/upload-supabase', cors(), async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return c.json({ success: false, error: 'No file' }, 400)
    }
    
    // 파일명 생성
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(7)
    const extension = file.name.split('.').pop()
    const fileName = `${timestamp}-${randomStr}.${extension}`
    
    // ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer()
    
    // Supabase Storage API 호출
    const response = await fetch(
      `${c.env.SUPABASE_URL}/storage/v1/object/products/${fileName}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${c.env.SUPABASE_ANON_KEY}`,
          'Content-Type': file.type,
        },
        body: arrayBuffer
      }
    )
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(error)
    }
    
    // Public URL 생성
    const publicUrl = `${c.env.SUPABASE_URL}/storage/v1/object/public/products/${fileName}`
    
    return c.json({
      success: true,
      data: {
        url: publicUrl,
        fileName: fileName
      }
    })
  } catch (err) {
    return c.json({
      success: false,
      error: (err as Error).message
    }, 500)
  }
})

// 이미지 삭제
app.delete('/api/upload-supabase/:fileName', cors(), async (c) => {
  try {
    const fileName = c.req.param('fileName')
    
    const response = await fetch(
      `${c.env.SUPABASE_URL}/storage/v1/object/products/${fileName}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${c.env.SUPABASE_ANON_KEY}`,
        }
      }
    )
    
    if (!response.ok) throw new Error('Delete failed')
    
    return c.json({ success: true })
  } catch (err) {
    return c.json({
      success: false,
      error: (err as Error).message
    }, 500)
  }
})
```

## 6. wrangler.jsonc 환경 변수

```jsonc
{
  "vars": {
    "SUPABASE_URL": "https://xxxxx.supabase.co",
    "SUPABASE_ANON_KEY": "eyJhbG..."
  }
}
```

## 무료 플랜 제한
- 저장 공간: 1GB
- 대역폭: 2GB/월
- 파일당 최대: 50MB

## 예상 사용량
- 썸네일 + 상세 3장 = 1.3MB/상품
- 1GB로 약 770개 상품 등록 가능
- 월 2GB 트래픽 = 약 1,538회 이미지 조회

## 장점
✅ 1GB 무료 저장
✅ PostgreSQL DB 포함
✅ 인증 시스템 포함
✅ 실시간 기능
✅ 한국 서버 (빠름)
✅ 쉬운 확장

## 추가 기능
- 이미지 리사이징 (Pro 플랜)
- 이미지 변환
- 버전 관리
- 접근 제어
