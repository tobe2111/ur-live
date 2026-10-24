# 새 보안 경보 2건(vite·zod)을 업그레이드할지, 예외로 둘지

상태: approved
등급: C
역할: dev
올린 날: 2026-10-24
기한: 2026-10-31

## 질문
모든 PR 을 막고 있는 보안 경보 2건 중 vite 는 예외로 두고, zod 는 4로 올릴까요(1·2·3 중 선택)?

## 근거 (실측)
- 2026-10-20 이후 새로 공개된 high/critical 경보 7건 때문에 `scripts/check-npm-audit.sh` 가 **모든 PR** 을 막는다(PR #1981 Verify 실패 · job 120903826739).
- 패치 버전으로 해결한 5건: `dompurify` 3.4.13 → 3.4.17(critical 1 · high 1) · `follow-redirects` → 1.16.1(override, high 2) · `undici` override `^7.30.1`(high 1). PR #1981 에 함께 들어간다.
- 남은 2건:
  - **vite** GHSA-587h-7wmj-h5pm(high). 개발 서버(launch-editor) 경로 검사 우회이고 Windows 전용이다. 빌드·개발 도구라 배포 산출물에 없다. 고치려면 vite 6.4.4+ 메이저 업그레이드가 필요하다. 같은 사유의 GHSA-fx2h-pf6j-xcff 는 이미 2026-06-22 에 대표 승인으로 면제돼 있다.
  - **zod** GHSA-mrhx-c7xc-m3w5(high). 제한이 걸린 큰 배열을 검증할 때 메모리를 소진한다. 패치는 zod 4(메이저)뿐이다. 워커의 주문·결제·인증 요청 검증이 zod 3 을 쓰고, 잠금 파일 `payment.routes.ts` 도 import 한다. 완화 요소: 모든 `/api/*` 요청은 `bodyLimitByPath` 로 본문 크기가 제한된다.

## 선택지
1. **vite 예외 + zod 예외(2주 시한)** — 오늘 바로 PR 이 풀린다. zod 위험은 본문 크기 제한으로 묶인다. 머니 접촉 없음.
2. **vite 예외 + zod 4 업그레이드** — zod 위험이 사라진다. 대신 잠금 파일(`payment.routes.ts`)을 import 하는 검증 코드가 바뀌므로 잠금 해제 승인과 staging 실결제 1회가 필요하다. 하루 이상 걸린다.
3. **둘 다 업그레이드(vite 6 + zod 4)** — 가장 깨끗하다. 빌드 체인 전체 회귀 위험이 있어 가장 오래 걸린다.

## 기본안 (답이 없을 때 권하는 것 — 자동 실행되지 않는다)
1번. 지금 모든 PR 이 막혀 있다. 예외는 기한을 걸어 두고, zod 4 이행은 별도 작업으로 한다.

## 롤백
`.audit-allowlist.json` 에서 해당 GHSA 두 줄 삭제.

## 결정 (대표가 한 말 그대로)
"1번 승인할게." (2026-10-24)

## 반영 커밋
