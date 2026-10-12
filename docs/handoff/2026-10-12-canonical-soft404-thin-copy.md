# 2026-10-12 — canonical 중복 · 무한 soft-404 · 얇은 표면 본문 (대표 "응 모두 해줘")

브랜치 `claude/taste-skill-install-n1s63z` (PR #1736 머지 후 `origin/main` 에서 재생성).
커밋 셋 — 롤백이 독립이다.

| | 커밋 | 무엇 |
|---|---|---|
| ① | `7cb9391bb` | canonical 을 문서에 **정확히 하나**로 (`applyCanonical`, 5자리 → 한 길) |
| ② | `5b8e4f48e` | 등록 안 된 경로 **404 + noindex** (`known-routes.ts` SSOT) |
| ③ | `78a30bec7` | 얇은 표면 8개 크롤러 본문 **67~129자 → 141~239자** |

## 1. 다음 세션의 첫 액션 — 배포 후 E4

```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

# ① canonical 이 표면마다 **정확히 1개**인가 (첫 매치만 보지 말 것 — 전수로)
for p in / /vouchers /browse /blog /u/jiwon1228 /pass/2919 /pass/2887 /stays/2887; do
  echo -n "$p  "; curl -sS -A "$UA" "https://urdeal.kr$p" \
    | grep -o 'rel="canonical" href="[^"]*"' | sed 's|.*urdeal.kr||;s|"$||' | tr '\n' ' '; echo
done
# 기대: 전부 1개. `/pass/2887` 은 **`/stays/2887` 하나만**(지금은 `/pass/2887` 과 둘).

# ② 쓰레기 경로 404 **그리고** 멀쩡한 경로 200 — 양방향
for p in /zzz-nonexistent-abc /products /vouchers-typo \
         / /vouchers /pass/2919 /u/jiwon1228 /seller/orders /admin/users /blog; do
  printf '%-24s %s\n' "$p" "$(curl -sS -o /dev/null -w '%{http_code}' -A "$UA" "https://urdeal.kr$p")"
done
# 기대: 앞 셋 404 · 나머지 전부 200. 🔴 뒤쪽이 404 면 즉시 롤백(색인 손실, 복구 수주).

# ③ 본문 길이
for p in /partners /creators /influencer /introduce /new-openings /area-report; do
  printf '%-16s %s자\n' "$p" "$(curl -sS -A "$UA" "https://urdeal.kr$p" | python3 -c "
import sys,re,html
t=' '.join(re.findall(r'<noscript[^>]*>([\s\S]*?)</noscript>',sys.stdin.read()))
t=re.sub(r'<[^>]+>',' ',t); print(len(re.sub(r'\s+',' ',html.unescape(t)).strip()))")"
done
# 기대: 237 · 239 · 234 · 205 · 154 · 141 안팎
```

판정 뒤: CLAUDE.md 의 해당 두 `[UNLOCK_LOADING]` 항목에 `✅ E4 판정 통과(…)` 추가 +
Notion 로그(datasource `571b32b9-cefb-4453-9b84-78928c619451` · 서비스=유어딜 · 유형=결함 수정 · 머니 경로 X).

## 2. 이번에 틀렸던 판단 (같은 오진 반복 방지)

1. **`re.search`(첫 매치)로 canonical 을 읽어 "#18 이 적용 안 됐다" 로 오진할 뻔했다.**
   실제로는 둘이 나가고 있었고 둘째가 우리 것이었다. ⇒ **메타는 전수로 센다.**
2. **`grep -c` 가 센 1건이 제거를 기록한 *주석* 이었다**(#17 E4). 이 세션에서 같은 클래스를
   **다섯 번** 밟았다(grep 개수 ≠ 노드 수 · nonce · `@graph` 중첩 · 시드 크기 · 주석).
3. **②의 첫 설계가 `App.tsx` 하나만 읽으려 했다.** 라우트는 네 파일 327개다 —
   대시보드 ~180개를 404 로 만들 뻔했다.
4. **③의 첫 가드(전역 하한 110자)가 헛돌았다.** 205자 표면에서 한 줄(19자)을 지워도
   통과했다 — 주입이 잡았고 **표면별 래칫**으로 교체했다.
5. **`ur-wholesale` Pages 빨간불을 "일시적" 이라 보고한 것은 맞았다**(오늘 75건 중 5건 실패 = 7%,
   전부 `deploy` 단계 CF 내부 오류). 다만 근거를 숫자로 재기 전엔 단정하지 말 것.

## 3. 남은 것 / 대표 판단 대기

- **`/vouchers/nonexistent-xyz`** — 최상위는 맞고 그 아래가 없는 경로. 엔티티 슬롯의 일이고
  그 API 가 404 대신 **400** 을 준다. 별건.
- **`/refund` 에 다른 서비스 문구** — `RefundPolicyPage.tsx` 에 `제22조 (환불)` · `가. 경기 결제 회원`.
  유어딜엔 없는 개념이고 sitemap 제출 법적 페이지다. **법적 문구라 대표가 문구를 줘야 한다.**
- **`ur-wholesale` Pages 프로젝트** — 서빙 도메인이 없는데 오늘만 75번 빌드. 지우면 빌드 분과
  7% 짜리 가짜 빨간불이 함께 사라진다(플랫폼 변경 = 대표).
- **`/stays/:id` 서버 첫 화면** — `<noscript>` 가 본문은 배달하지만 첫 화면은 안 그린다.
  `StayDetailPage` 히어로 래퍼 구조가 `/pass/:id` 와 달라 박스를 재야 한다. 별건.
- **실제 입점 매장 2곳**(활성 50건 중 48건 데모) — 기술 밖. 이번 작업들은 *실물이 늘어나는 순간
  바로 인용되게* 준비해 두는 몫까지다.
