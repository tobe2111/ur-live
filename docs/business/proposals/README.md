# 대외 제안서

원본 파일은 여기가 아니라 **`public/static/proposals/`** 에 있습니다.

| 문서 | 파일 | 어드민 |
|---|---|---|
| 인플루언서 제휴 제안 (16:9, 9장) | `public/static/proposals/influencer-proposal.html` | `/admin/proposals` |
| 대행사 제휴 제안 (16:9, 16장, PowerPoint, 매장 모집 실행서) | `docs/business/proposals/urdeal-agency-proposal.pptx` + 같은 이름 `.pdf` (생성기 `urdeal-agency-proposal.build.mjs`) | 없음. 파일로 전달 |

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
node /path/to/ur-live/docs/business/proposals/urdeal-agency-proposal.build.mjs ./urdeal-agency-proposal.pptx
```

- 요율(직접 10% / 중개 5%)과 "유어딜은 중개사에게 지급하지 않는다"는 2026-09-04 대표 확정입니다.
  `docs/design/store-operator-model.md` §7 이 SSOT 이고, 바뀌면 1·2·4·5·6·16 장을 같이 고쳐야 합니다.
- 숫자 두 개는 라이브 실측입니다. 판매 중 이용권 338건(`/api/group-buy/products?status=active`),
  인플루언서 DB 198,704명·연락 가능 45,725명(`/api/admin/ads/influencer-pool/stats`, 2026-09-07).
  전달 전에 다시 재서 3·10 장을 갱신하세요.
- 5·6 장의 단위 경제(판매가 2만원, 월 60건, 보수 10%, 재료비 35%)와 14 장의 파일럿 목표는 **가정·제안**입니다. 슬라이드에도 그렇게 적혀 있습니다.
- 글꼴은 **Pretendard** 입니다(v3, 대표 지시). PowerPoint 로 여는 PC 에 Pretendard 가 없으면 대체 글꼴로 보이므로
  **대외 전달은 PDF 로** 하세요. 리눅스에서 뽑으려면 `~/.fonts` 에 Pretendard OTF 를 넣고 `fc-cache -f`.
- **라이브 모바일 캡처**(`shots/home·detail·use·shop.jpg`, 390×844)가 1·3·7·9·15 장에 들어갑니다.
  다시 찍으려면 아래 캡처 절차 그대로. 캡처 폴더를 `SHOTS_DIR` 로 넘기면 되고, 없으면 빈 슬롯으로 그립니다.
- ⚠️ **셀러 대시보드 화면(8·10·11 장)은 캡처가 없습니다.** 셀러 로그인이 필요한데 이 환경엔 셀러 테스트
  계정이 없습니다. 계정이 생기면 `/seller/stores`·`/seller/influencers`·`/seller/operating` 을 같은 규격으로
  찍어 `shots/` 에 넣고 생성기의 해당 장에 `phone()` 슬롯을 추가하세요.

### PDF 로 뽑으려면 (리눅스)
`libreoffice-impress` + `fonts-nanum` + `python3-uno` 가 있어야 합니다. 맑은 고딕을 나눔고딕으로
매핑하는 fontconfig alias 를 두고, `export-pptx-to-pdf.py <in.pptx> <out.pdf>` 를 돌립니다.
이 스크립트가 LibreOffice 의 "아시아/비아시아 문자 간 자동 여백" 문단 속성을 꺼서 "월 12 만원" 처럼
벌어지는 표시를 없앱니다(PowerPoint 원본엔 없는 현상). 차트 안 글자는 별도 객체라 여백이 남습니다.
