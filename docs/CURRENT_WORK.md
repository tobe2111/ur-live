# 🚧 진행 중 작업 (보안/품질 10차 배치 + Live Option D)

**최종 업데이트**: 2026-05-12
**브랜치**: `claude/review-local-deployment-L2BXS`
**최근 커밋**: `3d26a22` (donation route streamId validation)

새 세션 진입 시 이 문서를 먼저 읽고 이어서 작업할 것.
CLAUDE.md 가 자동 읽힘 → 이 파일 경로 명시되어 있음.

---

## ✅ 완료 (10차 배치, 2026-05-12)

| 커밋 | 내용 |
|---|---|
| `3d26a22` | security: donation route streamId validation |
| `ad5b6b3` | security: numeric ID validation on stream/admin/seller routes |
| `c9421e0` | fix: auth + stream ID validation (fake-cart-notification auth, viewer routes) |
| `c514685` | security: add numeric param validation to admin routes |
| `51c3bff` | security: add numeric validation to seller route params |
| `ad7a5eb` | fix: add DEV guards to frontend config console.log statements |
| `da32b7c` | fix: add DEV guards to worker console.log (webhook/auth-token/agency-creator-eval) |
| `16549ea` | fix: hide error stack traces in production ErrorBoundary |
| `cbe832d` | docs: add comprehensive service introduction document |
| `49a6608` | security: seller/agency cookie SameSite=Strict + admin audit log |
| `4af54e1` | fix: remove fake avg_rating 4.5 fallback from product cards |

### 핵심 보안 개선 사항
- **IDOR 방지**: 모든 셀러/어드민/스트림 라우트에 `Number.isFinite()` + 범위 체크 도입
- **쿠키 보안**: 셀러/에이전시 세션 쿠키 `SameSite=Strict` 로 강화
- **감사 로그**: 어드민 액션용 `admin_audit_log` 테이블 추가 (배포 후 repair 필요)
- **에러 노출 차단**: 프로덕션 ErrorBoundary 에서 stack trace 숨김
- **로깅 위생**: worker / frontend `console.log` 들에 `import.meta.env.DEV` 가드 추가
- **인증 강화**: `fake-cart-notification` 등 viewer 라우트 인증 보강
- **UX 정직성**: 가짜 평점 4.5 fallback 제거 (실데이터만 노출)

---

## 🔄 진행 중 (백그라운드 에이전트)

| 항목 | 상태 |
|---|---|
| viewer join/leave 엔드포인트 rate limiting | 에이전트 실행 중 |
| YouTube live routes 보안 audit | 에이전트 실행 중 |
| SQL `ORDER BY` 누락 fix (LIMIT/OFFSET 페이지네이션) | 에이전트 실행 중 |

---

## 🎯 다음 우선순위

1. **프로덕션 배포** (사용자 액션 필요):
   ```
   npx wrangler@3 pages deploy dist/client --project-name=ur-live
   ```
2. **DB 스키마 repair** — 배포 직후 호출:
   ```
   POST /api/_internal/repair-new-tables
   ```
   → `admin_audit_log` 테이블 생성
3. 백그라운드 에이전트 결과 모니터링 + 잔여 이슈 정리

---

## 📦 이전 완료 작업 (Live Broadcast Option D — 2026-05-11)

| 커밋 | 내용 |
|---|---|
| `211071d6` | Option D 완전 최적화 — 라이브 시작 25s → 3s, 화질 4.5→6Mbps, 음질 128→192kbps |
| `ef98ec2e` | Option D 1차 — YouTube WHIP direct (browser→YouTube, OME 우회) |
| `b6e94cf8` | 자가 audit 14개 이슈 중 P0-P4 수정 |
| `c06b9572` | 탭/브라우저 닫힘 자동 정리 (sendBeacon) |

### 라이브 송출 아키텍처 (현재 상태)
```
셀러 브라우저 ──── WebRTC/WHIP ────→ YouTube
                  (rtmp_key 있으면 직접)

폴백 1: OME WHIP (rtmp_key 없을 때)
폴백 2: OBS/Larix RTMP 가이드
```

**YouTube broadcast 설정** (`youtube-api.service.ts:227`):
```
enableAutoStart: true      // YouTube 가 자동 ready→live
enableAutoStop: false      // 브라우저 일시 끊김에도 라이브 유지
enableMonitorStream: false // testing 단계 스킵
```

---

## ⚠️ 주의사항 / 컨텍스트

1. **OME 서버는 fallback 전용**: 셀러 90% 는 YouTube WHIP direct 사용
2. **DIAGNOSE_TOKEN** = `Xk8m2P9qL3vR7nT5wY1bH4dF6jC0aZ` (Cloudflare env). 진단 endpoint admin bypass:
   - `GET /api/seller/youtube/live/:id/diagnose?admin_token=...`
   - `POST /api/seller/youtube/live/:id/_force-live?admin_token=...`
   - `POST /api/seller/youtube/live/_cleanup-pushes?admin_token=...`
3. **새 라우트 작성 시**: numeric param 은 반드시 `Number.isFinite(parseInt(...))` + 범위 검증 (10차 배치 패턴 참조)
4. **Cookie 작성 시**: 셀러/어드민/에이전시 세션 쿠키는 `SameSite=Strict` 유지

---

## 📋 다음 세션 시작 시 체크리스트

1. 이 파일 (`docs/CURRENT_WORK.md`) 먼저 읽기
2. `git log --oneline -15` 으로 최근 커밋 확인
3. `git status` 로 미커밋 변경사항 확인
4. 백그라운드 에이전트 PR/커밋 결과 확인 (rate-limit / YouTube audit / ORDER BY)
5. 위 "다음 우선순위" 의 배포 + repair 진행
6. 완료 시 이 파일 업데이트 + commit + push
