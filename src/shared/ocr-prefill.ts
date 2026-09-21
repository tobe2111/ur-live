/**
 * 🔍 가입 앞문이 등록증 사진에서 돌려받는 **초안 값**.
 *
 * 2026-09-16 (대표 참고 시안 ⑤ *"정보를 확인해 주세요"* · 결재 `2026-09-16-ocr-license-automation.md`).
 *
 * ## 이건 판정이 아니라 초안이다
 * 서버는 이 값으로 아무것도 결정하지 않는다 — 승인·반려 0, DB 쓰기 0.
 * 화면은 **빈 칸에만** 채우고, 사장님이 그대로 고칠 수 있어야 한다.
 * (사장님이 이미 친 값을 덮으면, 모델이 잘못 읽은 순간 사장님이 고친 걸 되돌리는 셈이다.)
 *
 * ## 왜 `shared/` 인가
 * 서버(`features/upload/api/upload.routes.ts`)와 화면(`components/BusinessCertUpload.tsx`)이
 * 같은 모양을 봐야 하는데, 화면이 워커 라우트 파일을 import 하면 — `import type` 이라 런타임엔
 * 지워지더라도 — 다음 사람이 값 하나를 무심코 같이 가져오는 순간 **워커 코드가 번들에 딸려 온다.**
 * 그 문을 아예 열지 않는다.
 */
export interface OcrPrefill {
  /** 상호(법인명) */
  bizName: string | null
  /** 사업장 소재지 */
  address: string | null
  /** 대표자 성명 */
  ownerName: string | null
  /** 사업자등록번호 숫자 10자리(하이픈 없음) */
  bizNumber: string | null
  /** 개업연월일 YYYYMMDD */
  permitDate: string | null
  /** 읽힌 비율 0~1 — **정확도가 아니라 충실도다**(읽은 값이 맞다는 뜻이 아니다) */
  fill: number
}
