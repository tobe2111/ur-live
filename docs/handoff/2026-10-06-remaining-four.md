## 🟢 2026-10-06 — 남은 네 건 마감: d1-migrate 정직화 · 모바일(무의미 판정) · 인계 목차 추적 끊기 · 컬러 견본 40px

**[E3 배포됨]** (E4 판정 필요분을 아래 §5 에 적었다 — 하나는 **구조상 E4 가 없다**)

대표 *"남은 것도 다 해줘"*. 직전 보고에서 **대표 판단 대기**로 올렸던 네 건을 전부 처리했다.

---

### ① `d1-migrate.yml` — 조용한 거짓 → 정직한 보고 (2단 스위치)

**실측(run 37465121609 잡 로그)**:
```
x [ERROR] Couldn't find DB with name 'ur-live'
! migrations/0289_….sql 실패 (already applied?)
! ADMIN_REPAIR_TOKEN 미설정 — repair-schema 호출 skip
-> job conclusion: success          ← 전부 실패했는데 초록
```
원인이 **둘**이다.
1. `D1_DATABASE_NAME` 시크릿 미설정 → 기본값 `ur-live` 를 찾았는데 **그런 DB 는 없다**
   (본진은 `wrangler.toml` 의 `DB` 바인딩 = `toss-live-commerce-db`).
2. 모든 실패를 `|| echo "실패 (already applied?)"` 가 삼켜 **잡이 초록**이었다.

**수정** — 정직하게 만들되 **프로덕션 쓰기는 켜지 않는다**:
- DB 이름을 **`wrangler.toml` 에서 읽는다**(시크릿 불필요 ⇒ 드리프트 불가).
- **preflight** `wrangler d1 info` — 못 찾으면 `::error` + `exit 1`. **"못 찾음"은 "이미 적용됨"이 아니다.**
- "이미 적용됨"으로 넘기는 것은 `duplicate column|already exists` **뿐**, 그 밖은 전부 실패.
- 기본은 **보고 전용**(파일 수 + 게이트 상태를 step summary 에). 적용은
  **`vars.D1_MIGRATE_APPLY == 'true'`** 일 때만.
- 죽은 참조 제거: `python3 scripts/ci/resolve-d1-name.mjs`(**없는 파일**이고 `.mjs` 를 python 으로 불렀다) ·
  중복 `List pending migrations`(ls) 제거.

🔴 **repair-schema 호출은 여기서 지웠다** — `main.yml` 의 `Auto schema repair after deploy` 가
배포 직후 같은 일을 하고 **실제로 돈다**(어제 주문 85 소급 기록을 그것이 돌렸다). 여기 것은 토큰
미설정으로 한 번도 안 돌았고, **있다는 사실만으로 "자동으로 돈다" 는 거짓 확신을 만들었다**(그 오판을 실제로 했다).

가드 `src/tests/unit/d1-migrate-honesty-2026-10-06.test.ts` 14건 + 주입 4건 **전부 빨간불 확인**.

---

### ② 모바일 네이티브 재빌드 — **무의미(moot)**. 측정으로 기각

- `npm audit` critical **0** (`@capacitor` 는 `a06dda665`(#1619)에서 이미 올라갔다).
- `app-ios.yml` **실행 이력 0회**.
- 런북 §1 에 스토어 계정이 **아직 안 만들어져 있다**.

⇒ **재빌드할 출시본이 없다.** 직전 보고에 "모바일 재빌드 필요"로 올린 것은 제 오판이다.
스토어 등록을 시작할 때 처음부터 빌드하면 된다(그때 `@capacitor` 는 이미 안전한 버전이다).

---

### ③ 인계 목차 — **추적을 끊었다**(머지 충돌의 근본 해소)

2026-07-29 는 "사람이 공유 파일을 편집하지 않게" 만들었지만 **생성물은 여전히 추적**했다.
그게 남은 절반이고, 어제 하루에 세 번 충돌한 원인이다. 그리고 그 대가가 "머지 못 함" 보다 나쁘다 —
GitHub 이 머지 커밋을 못 만들면 `pull_request` 워크플로가 **디스패치되지 않아** `Verify` 가
실패도 아니고 **부재**로 남고 auto-merge 가 조용히 멎는다(어제 PR 셋이 그 모양).

| | 전 | 후 |
|---|---|---|
| 목차 위치 | `docs/CURRENT_WORK.md` 안(추적 + pre-commit stage) | `docs/handoff/INDEX.local.md`(**`.gitignore`**) |
| `CURRENT_WORK.md` | 모든 브랜치가 고친다 | **안 바뀌는 문서**(옛 기록 5,048줄 보존 + 안내) |
| 찾는 법 | 그 파일 열기 | `ls docs/handoff/ \| sort -r \| head -5` 또는 생성기 1회 |

**네 조각이 쌍이다**(하나만 되돌아가도 조용히 망가진다): 출력 경로 · `.gitignore` ·
pre-commit 이 stage 안 함 · `check-current-work-sync` 가 그 파일 손댐을 "인계 갱신"으로 세지 않음.
②가 빠지면 **다음 머지 때까지 아무 신호 없이** 충돌이 돌아온다.

가드 `handoff-index-sidecar-2026-10-06.test.ts` 14건 + 주입 5건 **전부 빨간불 확인**.

---

### ④ 브랜드 컬러 견본 — 눌리는 박스 40px / **보이는 원은 28px 그대로**

`seller-rung-40-2026-10-06.test.ts` 머리말이 *"40×40 이면 팔레트 모양이 실제로 달라진다"* 며
대표 판단 대기로 남겨 둔 자리. 기법이 **셋째**였다 — **색을 버튼이 아니라 안쪽 span 이 칠한다.**
버튼은 투명한 40px 박스, 자식 span 이 28px 원 + 선택 링. `tap-reach` 는 못 쓴다
(`DashboardCard` 가 `overflow-hidden` 이라 `::after` 밴드가 잘려 **히트 테스트까지 죽는다**).

**측정(재빌드 후 `--phone-audit`)**: `/seller/store` 작은타깃 **7 → 1**, `reachDead: 0`, 🟢 깨끗.
남은 1 = `사업자 정보` **13px 인라인 링크** — #1621 이 **일부러 남긴 자리**(문장 속 inline 박스라
40px 선언이 실제로 안 닿는다. 선언만 남기면 감사가 그 자리를 "정상"으로 세어 더 나쁘다).

가드: 같은 파일에 `🎨 컬러 견본` describe 5건 + 주입 3건 **전부 빨간불 확인**.

---

### 🩸 이번에 틀렸던 판단 (제일 값진 부분)

1. **테스트가 생성기를 레포에서 돌려 5,048줄을 날렸다.**
   `execFileSync('node', [GEN])` 를 그냥 호출했는데, **이 시험 자신의 주입**(출력 경로를
   `CURRENT_WORK.md` 로 되돌리는 것)이 걸린 상태에서 그 호출이 돌자 생성기가 그 파일을 통째로
   덮어써 **5,957 → 470줄**이 됐다. 주입 러너는 **자기가 고친 소스만** 되돌린다 — 테스트가 쓴
   파일은 안 되돌린다. ⇒ **부작용 있는 스크립트는 합성 트리에서 돌릴 것**(지금 그렇게 고쳐 뒀다).
   복구는 `git checkout HEAD -- docs/CURRENT_WORK.md` 후 편집 재적용.
2. **가드가 헛돌았다 — `/<button[^>]*style=…/`.** 그 사이의 `onClick={() => …}` 에 `>` 가 있어
   부정 문자열이 **화살표에서 끊긴다**. 주입이 통과하는 것으로 확인했고, 줄 단위 검사로 재조준했다.
3. **거짓 빨간불 — 워크플로 전문 검사.** 머리말이 옛 안티패턴(`|| echo "… already applied?"`)을
   **그대로 인용**하는데 전문을 보니 "되살아났다"고 빨간불이 났다. `#` 줄을 떼고 **실행되는 줄**만 본다.
   (그리고 YAML 에 `readCode`(JS 주석 제거기)를 쓰면 `https://` 의 `//` 에서 줄이 잘린다 — `readRaw`.)
4. **②(모바일)를 "해야 할 일"로 올린 것 자체가 오판**이었다(위 §② — 출시본이 없다).

---

### 5. 다음 세션의 첫 액션 / 남은 것

- **①의 E4 는 구조상 없다.** 이 워크플로는 `migrations/**` 푸시 때만 돌고, 기본이 **보고 전용**이라
  "라이브에서 의도한 효과"가 *아무 쓰기도 안 하는 것*이다. 확인할 것은 하나:
  다음에 `migrations/` 를 건드리는 PR 이 머지되면 그 run 의 step summary 에
  `대상 DB: toss-live-commerce-db` + `적용 게이트: OFF` 가 찍히는지. `workflow_dispatch` 로 당겨 볼 수도 있다
  (**보고 전용이라 프로덕션 쓰기 0**).
  ```
  gh api repos/tobe2111/ur-live/actions/workflows --jq '.workflows[]|select(.name=="D1 Migration Auto-Apply")|.id'
  ```
- 🔴 **대표 판단 대기 — `vars.D1_MIGRATE_APPLY` 를 켤지.** 켜면 **main 푸시마다 프로덕션 D1 에
  마이그레이션이 실제로 적용되기 시작한다**(지금까지 한 번도 안 돌았으므로 `migrations/*.sql` **전체**가
  첫 대상이다). 세션은 플랫폼 쓰기를 하지 않으므로 **대표가 대시보드에서** 켠다.
  ⚠️ 켜기 전에: 쌓인 분이 재실행 안전한지(= 전부 `IF NOT EXISTS`/중복 컬럼 형태인지) 먼저 볼 것.
  **지금 당장 켤 이유는 없다** — 스키마 수선은 `main.yml` 의 `repair-schema/auto` 가 실제로 하고 있다.
- ③④ 는 코드가 곧 판정이다(가드 + 측정). ③ 은 다음 머지에서 `CURRENT_WORK.md` 충돌이
  **안 나는지**가 실물 확인이다.
- `TECHNICAL_DEBT.md` TD-001: 원인(이름 ≠ 권한)과 심각도(repair-schema 는 `main.yml` 과 중복이라
  피해 0, 진짜 죽은 것은 `migrations/*.sql` 적용뿐)은 어제 정정해 뒀다.
