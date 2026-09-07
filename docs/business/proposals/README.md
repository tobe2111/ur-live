# 대외 제안서

원본 파일은 여기가 아니라 **`public/static/proposals/`** 에 있습니다.

| 문서 | 파일 | 어드민 |
|---|---|---|
| 인플루언서 제휴 제안 (16:9, 9장) | `public/static/proposals/influencer-proposal.html` | `/admin/proposals` |
| 대행사 제휴 제안 (16:9, 14장, PowerPoint) | `docs/business/proposals/urdeal-agency-proposal.pptx` (생성기 `urdeal-agency-proposal.build.js`) | 없음. 파일로 전달 |

## 왜 docs/ 가 아니라 public/static/ 인가

처음에는 `docs/business/proposals/` 에 두고 어드민이 `?raw` 로 가져왔습니다
(`AdminPlatformModelPage` 가 SSOT 문서에 쓰는 패턴). 그런데 제안서에 **라이브 화면 캡처를
base64 로 심자** 그 문자열이 그대로 JS 청크가 되어 `AdminProposalsPage` 청크가 **254KB** 로
불었고, `check-bundle-size --budget`(총 raw JS 8.6MB)이 CI 를 세웠습니다.

정적 자산으로 두면 번들에 1바이트도 안 들어가고, 배포마다 자동 최신인 성질은 그대로입니다.

⚠️ **경로는 `/static/` 아래여야 합니다.** `public/_routes.json` 이 그 접두사만 워커에서
제외하고 있어 Pages 가 파일을 직접 서빙합니다. 다른 경로로 옮기면 워커가 SPA 셸을 돌려주고
미리보기가 빈 화면이 됩니다. 이 세 가지는 `src/tests/unit/admin-proposals-asset.test.ts` 가
강제합니다(되돌려-검증 완료).

## 화면 캡처를 다시 찍으려면

```bash
NODE_USE_ENV_PROXY=1 node scripts/capture-proposal-shots.mjs /tmp/shots
```

- 캡처에 **매장 전화번호가 그대로 나옵니다.** 상세 화면은 `a[href^="tel:"]` 를 블러 처리하도록
  잡아 뒀습니다. 대상 화면을 바꾸면 가릴 것이 또 있는지 먼저 보세요. 문서는 돌아다닙니다.
- 유어샵은 `/u/jiwon1228`(대표 계정)을 씁니다. 남의 유어샵을 대외 문서에 넣지 마세요.
- 색은 `src/index.css` 의 `--ink` / `--ink-soft` 를 **복사해 쓰는 구조**라 자동으로 안 따라옵니다.
  서비스 테마가 바뀌면 제안서도 같이 고쳐야 합니다.

## 대행사 제안서 (.pptx) 다시 만들려면

```bash
mkdir -p /tmp/deck && cd /tmp/deck && npm init -y && npm i pptxgenjs sharp react react-dom react-icons
node /path/to/ur-live/docs/business/proposals/urdeal-agency-proposal.build.js ./urdeal-agency-proposal.pptx
```

- 요율(직접 10% / 중개 5%)과 "유어딜은 중개사에게 지급하지 않는다"는 2026-09-04 대표 확정입니다.
  `docs/design/store-operator-model.md` §7 이 SSOT 이고, 바뀌면 5·6·7·14 장을 같이 고쳐야 합니다.
- 숫자 두 개는 라이브 실측입니다. 판매 중 이용권 338건(`/api/group-buy/products?status=active`),
  인플루언서 DB 198,704명·연락 가능 45,725명(`/api/admin/ads/influencer-pool/stats`, 2026-09-07).
  전달 전에 다시 재서 2·10 장을 갱신하세요.
- 글꼴은 맑은 고딕입니다. 리눅스 LibreOffice 렌더는 글꼴이 치환되어 자간이 벌어져 보이지만 PowerPoint 에서는 정상입니다.
