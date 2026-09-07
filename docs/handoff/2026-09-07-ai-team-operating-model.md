# 2026-09-07 — AI 팀 운영 모델 (역할 6 · 결재함 · 완료 판정 E1~E5) + 행위자·베네핏 한 장 지도

브랜치 `claude/yourdeal-automation-strategy-ssmm9j`. 서비스: **공통·인프라**(운영 방식) + 유어딜(행위자 지도).
머니 경로 접촉: **없음**(코드 변경 0 — 문서·역할 파일·테스트·매니페스트만).

## 대표 지시 (그대로)
1. *"각 세계 최고의 전문가 담당자(경영, 기획, 마케팅, 디자인, 개발, 정산) 팀을 빌딩해서 최대한 자동화 운영을 하고 싶은데
   어떻게 하는게 가장 이상적일까? 지금은 내가 수기로 하나하나 다 컨트롤을 하고 있어."*
2. *"응 그렇게 하고, 지금껏 구현을 해오면서 미완성, 에러, 문제들이 곳곳에 숨어있었는데도 완성되었다고 판단을 하는
   경우가 많았어. 너가 권하는 것들로 해서 진작에 문제없는 완벽히 운영할 수 있는 형태로 진행하자."*
3. *"이 서비스를 창업한 나 조차도 지금 구조가 헷갈리는 경우도 많아. 특히 인플루언서 매장, 중개사 간의 역할이
   분명하지 않고, 각각에게 베네핏을 어떻게 줄 것인지 등 말이야 그런게 분명하지 않아."*

## 다음 세션의 첫 액션
1. `docs/decisions/2026-09-07-actor-benefit-conflicts.md` 에 대표 답(Q1~Q5)이 왔는지 본다. 왔으면 **한 말 그대로** `결정` 필드에 옮기고
   `상태: approved`, 그 뒤 `actor-benefit-map.md` §1 확정값 갱신 + 필요한 설정/코드 변경은 **별도 결재**(머니 경로면 단독 세션+staging).
2. 루틴 6개의 첫 실행 결과(handoff `docs/handoff/2026-09-08-*` 예정)를 읽고 소음이 크면 주기를 줄인다(§7 3단계 — 대표 판단).
3. 세션 시작 룰: `bash scripts/install-git-hooks.sh` · `npm view ms version`(이번 세션은 npm 정상).

## 완료분 [E2 → E3 은 PR 머지 후]
- `docs/design/ai-team-operating-model.md` — 운영 SSOT(§0 병목 실측 · §1 원칙 · §2 결정권 A/B/C · §3 역할 · §4 E1~E5 · §5 결재함 · §6 루틴 · §8 못 막는 것)
- `.claude/agents/{ceo-office,planning,marketing,design,dev,finance}.md` — 프론트매터(name/description/tools) + 먼저 읽는다·결정권·하는 일·금지·완료 판정·보고 형식
- `docs/decisions/README.md` · `_template.md` · **첫 항목 `2026-09-07-actor-benefit-conflicts.md`**(Q1~Q5, 기본안, 기한 09-14)
- `docs/design/actor-benefit-map.md` — 취소선 없는 한 장 지도 + 어긋남 5곳
- `src/tests/unit/ai-team-operating-model.test.ts` 35건 pass · 주입 매니페스트 2건 **되돌려-검증 빨강 확인**
- CLAUDE.md 상단 "🤖 AI 팀 운영 모델" 절 · `docs/design/README.md` 표 등록
- Routine: 아래 §루틴 표(ID 는 생성 후 기록)

## 라이브 실측 (2026-09-07, D1 읽기 · `platform_settings`)
- 승인 매장 1(`store_owner`, `store_channel=brokered`) · `seller_operators` operator 1 · `seller_influencer_deals` 0 · 영입 매장 0 · 최근 30일 주문 0
- `fee_channel_rates_enabled=true` · 직접 10 / 중개 5 · `influencer_store_intro_pct=2` · `max_influencer_commission_pct=2` · `influencer_commission_pct=0`
- `affiliate_program_enabled`·`invite_reward_enabled`·`multi_tier_enabled`·`commission_budget_enabled`·`promo_funding_source` 전부 미설정(=OFF/기본)
- Routine 9개 중 반복 1개("System health check", 2026-04 생성, MCP 0, `last_run FAILED`) → 비활성 대상

## 이번에 틀렸던 판단 (다음 세션 반복 금지)
- 마케팅 역할 파일에 사업계획서 경로를 `docs/design/` 으로 적었다(실제 `docs/business/`). **테스트 ③(경로 실재)이 잡았다** — 역할 파일의 경로는 손으로 믿지 말고 테스트가 판정한다.
- 주입 매니페스트 2번의 `find` 를 ceo-office 절 제목 형식으로 적어 dev.md 에 매치가 안 됐다 → 주입이 적용되지 않은 채 "초록" → `check-guard-mutations` 가 **"지키는 척"** 으로 잡아냈다. 매니페스트의 `find` 는 반드시 대상 파일에서 grep 해 확인할 것.

## 남은 결정/대기
- 결재함 첫 항목 Q1~Q5 (기한 09-14)
- 루틴 첫 주 소음 조정(§7-3) · `/admin/system-monitoring` 역할 지표 탭(§7-5, 선택)
- handoff 98건의 "대표 판단" → `docs/decisions/` 이관은 planning 루틴이 주당 10건씩(자동)

## 루틴 (생성 결과 — 전부 fresh-session, 이 환경 상속)
| 이름 | 주기(KST) | ID |
|---|---|---|
| [dev] 개발 일일 판정 | 매일 08:00 | `trig_01UFXwaZeQRETq4EYJagCR6r` |
| [finance] 정산 일일 판정 | 매일 08:30 | `trig_017WKb6pgeyaC6bD5nsfFeMc` |
| [ceo-office] 결재함 브리핑 | 매일 09:00 (푸시+이메일) | `trig_01GLQWtco1oXr2ZwMafcdKUZ` |
| [planning] 기획 주간 정합 | 월 09:30 | `trig_01TwdCNThxLzVxd6WLKT3DPm` |
| [marketing] 마케팅 주간 | 화 09:30 | `trig_01Mac6jT8N7CayQ78qFXz89p` |
| [design] 디자인 주간 | 수 09:30 | `trig_01TPoqu3NDox96ETDrk7qUnh` |
| [executor] 승인 결재 실행기 | 4시간마다(:56) · 승인 0건이면 무동작 | `trig_01LkzCCq5UD56vsY1yHVKjv7` |
| [connector-proxy] 커넥터 대리인 | 4시간마다(:26, 실행기 30분 뒤) · **이 세션에 바인딩**(GitHub·Notion 보유) · 루틴 브랜치 draft PR 생성 + 머지분 Notion 미러 | `trig_01HeNMX1hE9gx7s2wn1WPtLm` |

### 🔴 대표가 직접 해야 하는 것 — 2026-09-07 17:0x 재정리 (대표 *"내가 할 일 너가 최대한 하거나 자동화 해주면 안돼?"*)
| 항목 | 자동화 시도 | 결과 | 남는 것 |
|---|---|---|---|
| 옛 "System health check" 끄기 | `update_trigger` → 거부(http_api 생성) · `fire_trigger` 로 자기-비활성 지시 → **not found** | 에이전트는 이 루틴에 손댈 수 없다 | ✅ **해결 — 대표가 2026-09-07 17:1x KST 직접 삭제**(*"옛 health-check는 내가 그냥 세션을 삭제했어"*) |
| 루틴에 GitHub·Notion 커넥터 | fresh-session 루틴엔 못 넘김 → **커넥터 대리인 루틴**을 이 세션(둘 다 보유)에 바인딩해 PR 생성·Notion 미러를 대신 | 첫 회차 18:26 KST 에 실제로 도구가 있는지 판정된다(생성 응답의 warning 이 세션-바인딩에도 붙어 확언 불가) | 대리인이 안 되면 그때 UI 에서 붙인다. 이 세션이 아카이브되면 대리인도 죽는다 — 그때도 UI |
| 결재함 답하기 · staging 실결제 · 머니 스위치 ON | 자동화 대상 아님(결정권 C — 대표만) | — | **대표** (실결제는 카드가 필요하고, 스위치는 사람이 켠다는 것이 이 모델의 1원칙) |

(아래 원문은 재정리 전 기록)
### 🔴 대표가 직접 해야 하는 것 2가지 (세션이 권한상 못 한다)
1. **죽은 "System health check" 비활성화** — 2026-04 에 `http_api` 로 만들어져 에이전트가 수정할 수 없다
   (`update_trigger` 거부 실측: *"created via http_api, not by an agent"*). claude.ai Routines UI 에서 끄거나 지운다.
   ID `trig_01RurtKfqhcn85ZaRkN87WzC`. 켜 둔 채면 매일 21:00 KST 에 실패 1건이 계속 쌓인다.
2. **루틴 6개에 커넥터 연결** — 이 세션이 넘길 수 있는 커넥터가 없어 **MCP 0** 으로 생성됐다(생성 응답의 warning).
   git push · curl · D1 읽기(CF 토큰은 `platform_settings`) · 어드민 API 는 커넥터 없이 동작하므로 **판정 자체는 돈다.**
   못 하는 것: `mcp__github__*`(PR 생성 — 브랜치 푸시까지는 됨) · `mcp__Notion__*`(개발 로그 미러).
   Routines UI 에서 각 루틴에 **GitHub · Notion** 을 붙이면 PR 생성·Notion 미러까지 자동이 된다. 붙이기 전까지 ceo-office 는
   브리핑을 푸시/이메일로만 보내고 handoff 에 "Notion 미기록" 을 남긴다.
