# 🔭 uptime 감시 외부 이전 — private 전환 시 필요 (준비 문서)

**상태**: 준비만 완료. **아직 이전하지 않았고, `.github/workflows/uptime.yml` 도 그대로 살아 있다.**
대체재가 실제로 도는 것을 확인하기 전에는 절대 먼저 끄지 말 것(감시 공백이 생긴다).

## 왜 필요한가

`uptime.yml` 은 `*/10 * * * *`(10분마다) = **월 4,320회**. GitHub Actions 는 **잡당 분 단위 올림 과금**이라
6초 만에 끝나도 1분으로 계산된다 → **월 ~4,320분**.

| | public (현재) | private |
|---|---|---|
| Actions 분 | **무제한 무료** | **월 2,000분**(Free) |

즉 레포를 private 으로 바꾸면 **이 워크플로 하나만으로 한도의 2배를 초과**한다(PR·배포 0건이어도).
`uptime.yml` 주석에 적힌 `비용 0 (public repo Actions 무료)` 가 이 설계의 전제였고, private 전환은 그 전제를 깬다.

> ⚠️ private 전환을 **하지 않는다면 이 문서는 불필요하다.** 지금 구조가 비용 0 으로 잘 돌고 있다.

## 선택지

| 방식 | 비용 | 이슈 자동화 | 외부 관측성 | 비고 |
|---|---|---|---|---|
| **A. 별도 public 레포로 분리** ⭐ | 0 | **그대로 유지** | 유지 | 워크플로 1개만 담은 레포. 아래 절차 |
| B. 외부 SaaS(UptimeRobot 등) | 0(무료 티어) | 없음(이메일/푸시로 대체) | 유지 + GitHub 장애에도 생존 | POST 점검 등 커스텀은 티어별 제약 |
| C. 주기만 완화(10분→30분) | 월 ~1,440분 | 유지 | 유지 | 여전히 한도의 70% 를 먹는다 — 권장 안 함 |
| D. Cloudflare Worker cron | 0 | 직접 구현 | ❌ **불가** | 사이트가 죽으면 cron 도 같이 죽는다(감시 의미 상실) + 슬롯 5/5 소진 |

**권장 = A.** 비용·자동화·외부성 셋 다 지키는 유일한 방식이다.

## A 절차 (약 5분)

1. GitHub 에서 **public** 레포 생성 — 예: `tobe2111/ur-uptime` (README 만 있어도 됨)
2. 그 레포에 `.github/workflows/uptime.yml` 로 **아래 파일을 그대로** 커밋
3. Actions 탭 → `Uptime Monitor` → **Run workflow** 로 1회 수동 실행 → 초록 확인
4. 일부러 실패시켜 알림 경로 확인(선택): probe URL 하나를 존재하지 않는 주소로 바꿔 1회 실행 → 이슈 생성·이메일 도착 확인 후 되돌리기
5. **그때서야** 본 레포의 `.github/workflows/uptime.yml` 삭제

### ⚠️ 스케줄 워크플로 자동 비활성 (이 방식의 유일한 함정)

GitHub 은 **레포에 활동이 없으면 60일 후 스케줄 워크플로를 자동으로 끈다.** 감시 전용 레포는 커밋이
없으므로 정확히 이 조건에 걸린다. 대응은 둘 중 하나:

- 아래 워크플로에 포함된 **주간 heartbeat 커밋 잡**을 그대로 쓴다(권장 — 자동)
- 또는 두 달에 한 번 아무 커밋이나 하거나 Run workflow 를 눌러준다(수동 — 잊기 쉽다)

### 복사할 워크플로 전문

```yaml
name: Uptime Monitor

# urdeal.kr 외부 관측 — 사이트가 죽으면 Cloudflare Worker cron 도 같이 죽으므로 반드시 외부에서 봐야 한다.
# 이 레포는 감시 전용 public 레포(메인 레포가 private 이어도 Actions 무료).
on:
  schedule:
    - cron: '*/10 * * * *'
    - cron: '0 3 * * 1'      # 월요일 03:00 UTC — 60일 자동 비활성 방지용 heartbeat
  workflow_dispatch:

permissions:
  issues: write
  contents: write            # heartbeat 커밋용

jobs:
  probe:
    if: github.event.schedule != '0 3 * * 1'
    runs-on: ubuntu-latest
    steps:
      - name: Probe critical endpoints
        id: probe
        run: |
          FAILS=""
          check() {
            local label="$1"; shift
            local code
            code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$@" || echo "000")
            echo "$label → $code"
            # 5xx / 000(타임아웃·연결실패) = 다운. 4xx 는 worker 살아있음(정상 간주).
            case "$code" in
              5*|000) FAILS="${FAILS}${label} (HTTP ${code})\n" ;;
            esac
          }
          # POST /api/version — 캐시 우회(POST) → worker 생존의 진짜 신호
          check "API worker (POST /api/version)" -X POST "https://urdeal.kr/api/version"
          check "교환권/상품 목록" "https://urdeal.kr/api/products?limit=1"
          check "도매 카탈로그" "https://urdeal.kr/api/wholesale/catalog?limit=1"
          check "메인 페이지 HTML" "https://urdeal.kr/"
          if [ -n "$FAILS" ]; then
            echo "down=true" >> "$GITHUB_OUTPUT"
            printf "fails<<EOF\n${FAILS}EOF\n" >> "$GITHUB_OUTPUT"
          else
            echo "down=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Open/close incident issue
        uses: actions/github-script@v7
        env:
          DOWN: ${{ steps.probe.outputs.down }}
          FAILS: ${{ steps.probe.outputs.fails }}
        with:
          script: |
            const down = process.env.DOWN === 'true'
            const fails = process.env.FAILS || ''
            const { data: issues } = await github.rest.issues.listForRepo({
              owner: context.repo.owner, repo: context.repo.repo,
              state: 'open', labels: 'uptime',
            })
            const open = issues[0]
            const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
            if (down) {
              const body = `🔴 **다운 감지** (${now} KST)\n\n실패 endpoint:\n\`\`\`\n${fails}\`\`\`\n10분 뒤 자동 재점검합니다. 복구되면 이 이슈는 자동으로 닫힙니다.\n\n조치 가이드: Cloudflare Dashboard → Workers & Pages → ur-live 배포 상태 / 최근 배포 롤백.`
              if (open) {
                await github.rest.issues.createComment({ owner: context.repo.owner, repo: context.repo.repo, issue_number: open.number, body })
              } else {
                await github.rest.issues.create({
                  owner: context.repo.owner, repo: context.repo.repo,
                  title: `🔴 [장애] urdeal.kr 다운 감지 — ${now}`,
                  body, labels: ['uptime'],
                })
              }
            } else if (open) {
              await github.rest.issues.createComment({
                owner: context.repo.owner, repo: context.repo.repo, issue_number: open.number,
                body: `🟢 **복구 확인** (${now} KST) — 전체 endpoint 정상. 이슈를 닫습니다.`,
              })
              await github.rest.issues.update({ owner: context.repo.owner, repo: context.repo.repo, issue_number: open.number, state: 'closed' })
            }

  # 60일 무활동 시 GitHub 이 스케줄 워크플로를 자동 비활성화하는 것을 막는다(감시 전용 레포는 커밋이 없다).
  heartbeat:
    if: github.event.schedule == '0 3 * * 1'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          date -u +"%Y-%m-%dT%H:%M:%SZ" > .heartbeat
          git config user.name  "uptime-bot"
          git config user.email "uptime-bot@users.noreply.github.com"
          git add .heartbeat
          git commit -m "chore: heartbeat (스케줄 자동 비활성 방지)" || exit 0
          git push
```

## B(외부 SaaS)를 택할 경우 체크리스트

같은 4개를 등록하고, **5xx·타임아웃만 다운으로 취급**(4xx 는 워커 생존 신호라 정상)하도록 맞춘다:

| 대상 | 메서드 | 비고 |
|---|---|---|
| `https://urdeal.kr/api/version` | **POST** | 캐시 우회 — 워커 생존의 진짜 신호. 무료 티어가 POST 를 지원하는지 먼저 확인 |
| `https://urdeal.kr/api/products?limit=1` | GET | |
| `https://urdeal.kr/api/wholesale/catalog?limit=1` | GET | |
| `https://urdeal.kr/` | GET | HTML 셸 |

⚠️ POST 를 못 쓰는 티어라면 `/api/version` 은 GET 으로 두되 **캐시된 응답이 200 을 반환해 죽은 워커를
살아있다고 오판할 수 있다**는 점을 감안할 것(그래서 현재 워크플로가 POST 를 쓴다).
