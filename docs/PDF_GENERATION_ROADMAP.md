# PDF 생성 — 아키텍처 로드맵 (O3)

> 작성: 2026-04-26
> 배경: M6 정산 송장 — 현재 HTML inline 으로 동작. PDF 가 필요한 경우 (인쇄/이메일 첨부) 옵션 추가.
> 결론: **Cloudflare Browser Rendering API** 권장. 단계별 도입 계획.

---

## 1. 현재 상태 (Phase 0 — 완료)

- 매월 1일 cron 자동 발행 (`agency-monthly-invoices.ts`)
- `agency_settlement_invoices.html_content` 에 HTML inline 저장
- `GET /api/agency/settlement-invoices/:id` → HTML 응답
- 프론트엔드: 새 탭에서 열기 → 사용자가 브라우저 인쇄로 PDF 변환

**한계**:
- 사용자가 매번 인쇄 → PDF 변환 수동
- 이메일 첨부 자동화 불가
- 보관용 표준 양식 X (A4 크기 자동 보장 안 됨)

---

## 2. 옵션 비교

### A. Cloudflare Browser Rendering API ⭐ (권장)

**개요**: Cloudflare 가 Workers 안에서 **Headless Chromium** 실행 → PDF 생성.

**장점**:
- ✅ Workers 환경 그대로 (외부 인프라 추가 X)
- ✅ HTML 그대로 활용 (이미 작성된 템플릿 재사용)
- ✅ 한국어 폰트 / 이미지 / CSS 모두 지원
- ✅ 비용: Workers Paid plan ($5/월) 부터 사용 가능

**단점**:
- ⚠️ Workers Paid plan 필요 (Free 에서는 못 씀)
- ⚠️ 개당 ~1-2초 소요 (cron 에서는 OK, 실시간 요청은 throttle 필요)
- ⚠️ 동시 실행 제한 (10/분)

**사용 패턴**:
```ts
import puppeteer from '@cloudflare/puppeteer'

const browser = await puppeteer.launch(env.MYBROWSER)
const page = await browser.newPage()
await page.setContent(htmlContent)
const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true })
await browser.close()
return pdfBuffer
```

**wrangler.toml 추가**:
```toml
[browser]
binding = "MYBROWSER"
```

### B. 외부 PDF 생성 서비스 (PDFShift / DocRaptor)

**장점**: 구현 간단, 일관된 결과
**단점**: 외부 의존성, 비용 (월 ~$10+), HTML 외부 노출 (시크릿 포함 시 위험)

→ ❌ 비추천 (보안 리스크)

### C. 클라이언트 측 PDF (jsPDF / html2pdf.js)

**장점**: 서버 비용 0
**단점**:
- 한국어 폰트 임베드 필요 (번들 크기 ↑)
- 이미지 / SVG 레이아웃 깨짐
- 사용자가 다운로드 트리거해야 함 (자동화 불가)

→ ❌ cron 자동화 불가능

### D. 서버사이드 라이브러리 (Puppeteer / Playwright + Docker)

**장점**: 풀 컨트롤
**단점**: Workers 에서 실행 불가 → 별도 인프라 (ffmpeg-service 처럼)

→ ⚠️ 가능하지만 별도 서비스 운영 부담

---

## 3. 권장 도입 단계

### Phase 1 (MVP — 1~2일)

목표: 기존 HTML 그대로 PDF 변환 옵션 추가

**작업**:
1. Cloudflare Browser Rendering 활성화
   - Cloudflare Dashboard → Workers Paid plan 확인
   - `wrangler.toml` 에 `[browser] binding = "MYBROWSER"` 추가
   - `npm i @cloudflare/puppeteer`
2. 새 엔드포인트:
   ```ts
   GET /api/agency/settlement-invoices/:id/pdf
   → HTML 본문 → Browser Rendering → A4 PDF 응답
   → Content-Disposition: attachment; filename="INV-...pdf"
   ```
3. UI 버튼 추가:
   - 기존 [열기] 옆에 [PDF 다운로드]
4. R2 캐싱 (옵션):
   - 한 번 생성한 PDF 는 R2 에 저장 → 재요청 시 R2 그대로 응답
   - 키: `invoices-pdf/YYYY-MM/INV-*.pdf`

### Phase 2 (cron 자동화 — 1일)

목표: 매월 1일 cron 이 PDF 까지 같이 생성

**작업**:
1. `agency-monthly-invoices.ts` 확장:
   - HTML 생성 후 → Browser Rendering → PDF buffer
   - R2 (BACKUP_BUCKET) 에 PDF 도 업로드 (`r2_pdf_key` 별도 컬럼)
2. 실패 시 graceful fallback (HTML 만 저장)
3. 어드민 UI: PDF 생성 실패 카운트 모니터링

### Phase 3 (이메일 첨부 — 1일)

목표: 매월 정산 송장 이메일 자동 발송

**작업**:
1. Resend / SendGrid 통합
2. 에이전시 이메일로 PDF 첨부 발송
3. 사용자 환경 설정 (`agency_email_preferences` 테이블) 으로 ON/OFF

---

## 4. 마이그레이션 (Phase 1 시 추가)

```sql
-- 0220_settlement_invoice_pdf.sql
ALTER TABLE agency_settlement_invoices ADD COLUMN r2_pdf_key TEXT;
ALTER TABLE agency_settlement_invoices ADD COLUMN pdf_generated_at DATETIME;
ALTER TABLE agency_settlement_invoices ADD COLUMN pdf_size_bytes INTEGER;
```

---

## 5. API 설계 (Phase 1)

```ts
// GET /api/agency/settlement-invoices/:id/pdf
// Response: application/pdf, A4
//
// 1. invoice 조회 + 권한 검증 (자기 에이전시인지)
// 2. r2_pdf_key 있으면 R2 에서 응답 (캐시)
// 3. 없으면 HTML → Browser Rendering → PDF buffer
//    - R2 에 저장 (옵션, BACKUP_BUCKET 있을 때만)
//    - r2_pdf_key, pdf_generated_at 갱신
// 4. PDF buffer 응답 (Content-Disposition: attachment)

import puppeteer from '@cloudflare/puppeteer'

async function renderPdf(env: Env, html: string): Promise<ArrayBuffer> {
  const browser = await puppeteer.launch(env.MYBROWSER)
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
  })
  await browser.close()
  return pdf
}
```

---

## 6. 비용 추정

**현재 에이전시 수**: 가정 ~10개

**매월 PDF 생성**:
- 10개 에이전시 × 1회/월 = 10 PDF/월
- Browser Rendering: ~1-2초 × 10 = 20초 CPU
- Workers Paid plan 의 일반 사용량 안에서 처리 가능 (별도 비용 없음)

**ad-hoc 다운로드** (사용자가 [PDF] 클릭):
- 캐시 hit 면 R2 read (0.36원 / GB)
- 캐시 miss 면 한 번 더 생성

**예상 월 비용**: $5 (Workers Paid plan) — 다른 기능과 공유

---

## 7. 보안 고려

- ✅ HTML 본문은 이미 inline 저장 — XSS 위험 0 (자체 템플릿)
- ✅ `setContent` 사용 (URL 로딩 X) → SSRF 위험 0
- ⚠️ PDF 안에 이미지 URL 있다면 → 외부 호출 발생 → 화이트리스트 권장
- ✅ 권한 검증 — 본인 에이전시 송장만 다운로드

---

## 8. 결론

**도입 결정 트리거**:
- 사용자/에이전시가 "PDF 첨부 못 받아서 불편" 피드백 → Phase 1 즉시
- 그 전까지 HTML 충분 → 도입 보류

**대안**:
- 사용자가 직접 인쇄 → "PDF로 저장" (Chrome/Safari 내장)
- 이메일 발송 시 HTML body 그대로 (PDF 없이)

**현재 권장**: Phase 0 (HTML) 유지, 사용자 피드백 후 Phase 1.
