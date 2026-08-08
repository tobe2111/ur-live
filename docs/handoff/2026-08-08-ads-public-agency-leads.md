# 📣 유어애즈 — 리드 풀에 **공공기관 담당자**가 섞여 있다 (2026-08-08 대표 신고)

> 🚦 **이건 유어애즈 레일이다.** 소비자(유어딜) 세션이 발견해 넘긴 것이고, 그 세션은 손대지 않았다
> (같은 날 아침에 레일을 섞어 보고했다가 대표가 바로잡은 일이 있어서 더 조심했다).
> 소비자 수정분은 별개 PR — 이 파일과 섞지 말 것.

## 대표 신고 원문

> *"B2B에서 나라장터 담당자도 섞여있음. `jeejeehea@naver.com` 은 전라남도중소기업일자리경제진흥원임."*

## 무엇이 문제인가

**전라남도중소기업일자리경제진흥원**은 우리가 제휴 제안을 보낼 **업체가 아니라 공공기관**이다.
나라장터(조달) 수집 경로에서 **발주기관 담당자**와 **실제 입찰 업체**가 구분되지 않고
같은 리드 풀에 들어온 것으로 보인다.

⚠️ 이건 "그 한 건을 지우면 되는" 문제가 아니다. **분류 규칙의 구멍**이라 같은 유형이 계속 들어온다.
그리고 이 DB 의 유일한 성공 지표는 총 인원이 아니라 **"제안 보낼 수 있는 리드 수"** 이므로
(CLAUDE.md 유어애즈 절), 공공기관이 섞이면 그 지표가 **거짓으로 부풀어** 있다.

## 다음 세션 첫 액션

1. **범위 확인** — 진흥원/공사/공단/재단/청/원/센터 류가 얼마나 들어와 있나. 읽기 전용 D1 로:
   ```sql
   SELECT COUNT(*) FROM ad_company_leads
    WHERE merged_into IS NULL
      AND (company_name LIKE '%진흥원%' OR company_name LIKE '%공사%' OR company_name LIKE '%공단%'
           OR company_name LIKE '%재단%' OR company_name LIKE '%청' OR company_name LIKE '%센터%');
   ```
   ⚠️ **패턴을 그대로 배제 규칙으로 쓰지 말 것** — `%센터%` 는 "○○정비센터"·"○○뷰티센터" 같은
   **실제 업체**를 대량으로 삼킨다. 범위 파악용 쿼리와 배제 규칙은 다르다.

2. **어느 경로로 들어왔는지 특정** — 나라장터 수집(`collect-nara-vendor`)이 유력하나 **확인 후 수정**.
   그 레인이 발주기관 필드를 업체로 읽고 있는지, 아니면 별개 경로인지.

3. **규칙 + 소급 정리** — 배제 규칙을 넣고 **`CLASSIFY_RULES_VERSION` 을 +1** 한다.
   🔴 **이 상수를 안 올리면 기존 리드는 옛 판정으로 영구히 굳는다** — 재검사 쿼리에 시간 폴백이
   없기 때문이다(2026-07-27 에 "인천교통공사…특강" 류가 정확히 그렇게 영구 제외됐다).
   가드 `check-rules-version-bump.mjs` 가 이걸 강제하지만, **strict 차단은 classify 만**이다.

4. **가드로 고정** — 같은 유입이 다시 생기면 CI 가 잡게. 이 레포 규율은
   *"규율은 문서가 아니라 테스트로"* 이고, 새 가드는 `check-guard-mutations` 매니페스트에 한 줄
   추가해야 헛돌지 않는다.

## 같이 넘기는 별건 — cron 3개가 CPU 한도로 죽고 있다

같은 날 소비자 세션이 되살린 `cron-stale-watch`(멈춤 감시)가 **처음 일하면서** 잡아낸 것이다.

```
ads:collect-hira       "Worker exceeded CPU time limit"   (13시간 침묵)
ads:collect-storeinfo  "Worker exceeded CPU time limit"
ads:collect-commerce   "Worker exceeded CPU time limit"
ads:collect-nara-vendor                                   (92시간 침묵)
```

**침묵과 실패가 같은 사건**이다 — 매 회차 CPU 한도에서 죽어 실행 기록이 안 남았다.
CLAUDE.md 에 같은 클래스가 이미 있다(*"01:00 에 CPU 한도로 죽은 3개는 전부 B2B"*) — 가드는
`check-ads-dispatch-bypass`. 🔎 **`collect-nara-vendor` 가 92시간 죽어 있다는 점이 위 ①과
무관하지 않을 수 있다** — 그 레인이 반쯤 죽은 채로 부분 수집한 결과일 가능성을 먼저 볼 것.

## 소비자 세션이 확인해 둔 것 (다시 파지 말 것)

- 어드민 읽기 · CF D1 읽기 경로 **살아 있음**(`verify` → active). 토큰은 `platform_settings` 에서 취득.
- `cron_failures` 컬럼명은 `job_name`(‼️ `cron_name` 아님), 잔액은 `users` 가 아니라 `user_points` 테이블.
- 원장 불일치 4명은 **소비자 레일**이고 전부 딜(포인트)·소액이다. 유어애즈와 무관.
