# 2026-10-15 — `www.urdeal.kr` 연결 + 소개 귀속 레일 실측 (코드 변경 0)

대표 지시: *"내가 해야하는거야? 어떻게 해야하는건데? 이제 SEO, GEO 할 건 더 없어?"*
→ 라이브 전수 재측정 후 **대표가 직접 해야 하는 것 하나**(www DNS)를 안내하고 대표가 수행 완료.

---

## ✅ 완료 — `www.urdeal.kr` (작업 #54, E4 통과)

**대표가 Cloudflare 대시보드에서 수행**(세션은 플랫폼 쓰기를 하지 않는다 — CLAUDE.md):
Pages 프로젝트 `ur-live` → Custom domains → `www.urdeal.kr` 추가.

판정:
- CF API 실측 — `domains: ['ur-live.pages.dev','urdeal.kr','www.urdeal.kr']` · www `status=active, cert=active`
- 대표 브라우저 실측 — `www.urdeal.kr` → **`https://urdeal.kr/` 로 301** (의도대로)
- 반대 방향 — 본진 6경로(`/`·`/vouchers`·`/pass/2919`·`/u/jiwon1228`·`/sitemap.xml`·`/robots.txt`) 전부 **200** 유지

코드는 원래부터 준비돼 있었다(`worker/index.ts:2597` — `host === 'www.urdeal.kr'` 면 GET/HEAD 비-API 를 apex 로 301, 경로·쿼리 보존). **빠져 있던 것은 도메인 연결 하나뿐**이었다.

### 🪤 다음 세션이 밟기 쉬운 함정 셋 (이번에 실제로 겪었다)

1. **계정에 `ur-live` 가 두 개다.**
   | | 정체 | 도메인 |
   |---|---|---|
   | **Pages 프로젝트 `ur-live`** | 라이브 서비스 | `urdeal.kr` · `www.urdeal.kr` · `ur-live.pages.dev` |
   | **Worker `ur-live`** | **cron 4개**(`0 18 * * *` · `0 19 * * *` · `2,17,32,47 * * * *` · `*/5 * * * *`) | 없음 |

   대표가 처음 연 화면이 **Worker** 쪽이었다(탭이 Overview/Metrics/Deployments/Observability/Issues/**Domains**/Access/Settings, `ur-live.jiwon-1a2.workers.dev` 표시). 거기에 www 를 붙이면 www 가 **라이브와 다른 코드**로 간다. 🔴 그 워커를 **지우지 말 것** — 정산 성숙·payout cron 이 거기 걸려 있다.
   구분법: **Pages 쪽은 탭이 `Custom domains` 이고 `ur-live.pages.dev` + `urdeal.kr` 가 보인다.**

2. **이 세션 환경은 `www.urdeal.kr` 로 나갈 수 없다.**
   `curl` → `CONNECT tunnel failed, response 403`(프록시 **정책 거부** — `__agentproxy/status` 의 `recentRelayFailures` 에 `21st.dev`·`dns.google` 과 같은 종류로 찍힌다. **기다려도 안 풀린다**) · `WebFetch` → `ENOTFOUND`.
   ⚠️ 이걸 *"www 가 죽었다"* 로 오진하지 말 것. `urdeal.kr`·`live.ur-team.com` 은 멀쩡히 통과한다.
   ⚠️ 그리고 *"DNS 전파 기다리면 된다"* 도 **틀렸다** — 첫 판에 제가 그렇게 말했다가 재시도에서 정책 거부임을 확인하고 정정했다. 두 실패(`ENOTFOUND` / `CONNECT 403`)는 **경로도 원인도 다르다.**

3. **대시보드의 "48시간" 안내는 일반 문구다.** `urdeal.kr` 존이 같은 CF 계정에 있어(zone 목록 실측: `urdeal.kr`·`ur-team.com`·`patanjalikorea.com`) CNAME 을 CF 가 즉시 만들었고 몇 분 만에 Active 가 됐다. 화면 아래 *"Log into your DNS provider"* 블록은 외부 DNS 용이라 무시해도 된다.

---

## 📏 소개(affiliate) 귀속 레일 — 실측

0.5% 레퍼럴 제거(PR #1861)의 **E4 ②**(실구매 귀속)를 왜 아직 못 쟀는지의 근거:

| 측정 | 값 |
|---|---|
| `affiliate_earnings` | **0행** |
| `order_referrer_intents` | **테이블 자체가 없음** — `CREATE TABLE IF NOT EXISTS`(`affiliate-credit.ts:463`)로 **첫 기록 때 생성**된다 |
| `influencer_attributions` | 1행, `source='broker_share'`(2026-10-07) — 소개 링크 레일이 아니다 |
| `point_transactions` type in (referral_bonus, invite_reward) | **0행** |
| `referral_enabled=1` 활성 상품 | **2,622건**(대표 핀 6개 전부 포함, `referral_commission_rate` 는 전부 NULL) |
| 요율 | `platform_settings.affiliate_commission_rate` **키 없음** → `DEFAULT_AFFILIATE_RATE` **2%** |
| cron `affiliate-mature` | 정상 실행 중 |

⇒ **고장이 아니라 "한 번도 안 쓰임"** 이다(라이브 주문 자체가 2026-10-12 이후 0건).

### 재려면 — 계정이 둘 필요하다
`affiliate-credit.ts:152` 가 `referrerId === order.user_id` 를 `SELF_REFERRAL` 로 차단한다(정상). 대표 혼자서는 구조적으로 못 잰다.
절차: ⓐ 다른 카카오 계정 B 로그인 ⓑ 어드민 `POST /api/admin/users/<B>/gift-deal` 로 B 에게 딜 선물(카드 안 씀) ⓒ 대표 유어샵 핀의 공유 링크를 B 에게 ⓓ B 가 **딜로** 결제 ⓔ `affiliate_earnings` 행 확인.

### 권하는 쪽은 "감시 신설"
*소개 의도가 기록된 확정 주문인데 적립 행이 0이면 어드민 알림.* 읽기 전용이라 머니 경로를 안 건드리고, 첫 실구매 때 **자동으로** 판정된다. **대표 답 대기.**

---

## 🔎 SEO·GEO 전수 재측정 (Googlebot UA · 37표면)

**코드 쪽은 닫혔다**: canonical **전 표면 정확히 1개** · robots 적절(noindex 7개 전부 의도 — `/terms/group-buy`·`/terms/influencer` 는 2026-10-13 "법무 검토 전 초안" 결정) · 빵부스러기·JSON-LD 완비(홈만 없고 루트라 의도).

**얄팍한 본문은 전부 데이터였다**(코드 결함 아님 — 확인함):
- `/pass/2919` 115자 ← 그 상품 `description` 이 **9자**(`달빛한스푼 이용권`). 설명이 제대로 있는 이용권은 **211~216자**(`/pass/2505`·`2504`·`2503` 실측) — `buildDetailNoscript` 는 멀쩡히 설명을 싣는다.
- `/browse` 42자 · `/products/2917` 29자 ← **쇼핑 활성 상품이 1개**이고 그 1개 설명이 0자.
- 이용권 359건 중 **24건**이 설명 없음/20자 미만.

⇒ 남은 SEO 작업은 **콘텐츠**다(설명 백필). 코드 처방 없음.

---

## 다음 세션의 첫 액션
1. 대표가 "감시 만들어라" 라고 하면 → 소개 귀속 감시(위 §) 신설.
2. 서버 레일 `referral-bonus.ts` + `group-buy.routes:903` 삭제는 **등급 C 결재** — 결재문 상정부터.
3. **내일 04:20 KST** `trig_01DsifhCXUKqmev9UiuRroEZ` — #1854 cron 거짓 경보 E4(04시 배치 `blocked:*` 15 → 0). 건드리지 말 것.
