# 2026-08-30 — 디자인 "AI 스러움" 진단 + 1층 수리 (버튼·그림자·포커스)

대표 지시: *"유어딜 디자인 전체적으로 AI 스럽지 않고 세련되고 현대적으로. 서비스 페이지들과 셀러대시보드."*
이어서 구체화: *"버튼들이 AI 스럽다"* → *"버튼의 테두리가 정말 AI스럽고 아이콘들이 AI가 만든 티가 난다"*
→ *"유어샵의 페이지 디자인 및 UI도 모두 재개편 하는 수준으로."*

## 🔑 다음 세션의 첫 액션

**유어샵 개편의 시작점은 `src/pages/seller-public/theme.ts` 한 파일이다.**

```bash
sed -n '17,32p' src/pages/seller-public/theme.ts
```
라이트 모드가 `bg: 'bg-white'` · `card: 'bg-white'` 로 **바탕과 카드가 같은 흰색**이다.
그래서 카드를 구분할 방법이 실선밖에 없고, 대표가 지적한 테두리가 **거기서 나온다**.
`bg` 를 웜 그라운드로 한 단 낮추면 유어샵 전체에서 테두리가 *할 일이 없어진다*.
개편은 이 토큰에서 시작하고, 나머지(커버 제거·헤더 좌정렬·대표 1장 위계)는 그 위에 얹는다.

시안(대표에게 이미 공유): https://claude.ai/code/artifact/bf4f2e95-d72c-416c-a878-f2a85eee890c

⚠️ 유어샵을 만질 때 **건드리면 안 되는 배선** — 가드가 강제한다:
- 소유권 판정 `ownerOverride` 체인 (`check-linkshop-ownership.mjs`)
- `__SSR_INITIAL_CURATOR__` / `__SSR_INITIAL_SELLER__` 동기 소비 + `seller-public-fetch` in-flight 공유 (로딩 잠금)
- 개편은 **보이는 층만**.

## ✅ 완료분 — commit `34dbf1c`

전부 **단일 지점 리매핑 · 마크업 0줄 수정** (브랜드 컬러 롤아웃 2026-07-19 이 검증한 방식).

| 변경 | 파일 | 영향 |
|---|---|---|
| 전역 버튼 transition + `active:scale(.978)` | `src/index.css` | `<button>` **2,606개** |
| `boxShadow` 순수검정 → 잉크 네이비 `#1A2C42` | `tailwind.config.js` | **368자리** |
| `focus-visible` `#6b7280` → 브랜드 로즈 | `src/index.css` | 전역 |
| `fontFamily` 에 `'Pretendard Variable'` 추가 | `tailwind.config.js` | `font-sans` 8곳 |
| shadcn 기본값 버튼 갱신 | `src/components/ui/button.tsx` | 15곳 + 향후 |

검증: tsc 0 · `npm run build` 0 · check-theme-consistency GREEN · check-dashboard-theme 0건.

### 실측 수치 (다음 세션이 다시 세지 않도록)
```
<button> 총 2,606   transition 보유 9(0.3%)   눌림반응 194(7%)   그림자 0
border border-gray-200  1,350곳 · gray-300 447 · gray-100 184 · border 총 9,024회
'테두리+그림자+흰바탕' 동시 보유 파일 65개
lucide-react 531 파일 · 대안 아이콘셋 0
AI 클리셰 아이콘: TrendingUp 90 · Sparkles 80 · Star 48 · Shield 34 · Zap 28 · Crown 12 · Rocket 11
버튼 세로여백 6종(py-1/1.5/2/2.5/3/3.5) · 굵기 3종 · 모서리 4종
```

## ⚠️ 이번에 틀렸던 판단 (같은 오진 반복 방지 — 제일 값진 부분)

1. **"focus 링이 사실상 부재(15곳)"라고 보고했다가 정정.** Tailwind `focus-visible:` 클래스만 센 것이고,
   `src/index.css:7` 에 **전역 `*:focus-visible` 규칙이 이미 있었다.** 접근성 구멍이 아니라 색 잔재였다.
   ⇒ 유틸리티 클래스 개수로 "기능 부재"를 결론내지 말 것. 전역 CSS를 먼저 볼 것.

2. **`duration-160` 을 썼는데 Tailwind 스케일에 없는 값**이었다(0/75/100/150/200/300/500/700/1000).
   생성되지 않고 **조용히 사라지는** 클래스 — 이 레포가 반복해 당한 "실패하지 않는 실패" 클래스다.
   `duration-[160ms]` 로 수정. ⇒ 임의 수치를 쓸 땐 스케일 존재를 먼저 확인하거나 `[..]` 를 쓸 것.

3. **처음 진단 방향이 틀렸다.** 색·타이포를 audit 하고 있었는데 대표가 *"버튼"* 이라고 짚어 줘서
   방향이 바뀌었고, 다시 *"테두리와 아이콘"* 으로 좁혀졌다. 이 앱은 **흔한 AI 지문(보라 그라디언트·
   무지개색)이 이미 없다** — 2026-06-19 에 장식색을 전부 잉크로 중화했기 때문이다.
   ⇒ 이 레포에서 "AI 스럽다"는 **색 문제가 아니다.** 무반응·균일한 실선·기본 아이콘셋이다.

## 🧭 남은 결정 (대표 판단 필요)

1. **아이콘 방향** — 갈림길이다:
   - (a) 세트 통째 교체(Phosphor 등): 빠르고 일관되지만 531 파일 import 변경
   - (b) 핵심 몇 개만 유어딜 전용 SVG(유어샵·동네딜·교환권): 느리지만 차별화 큼
   - 최소한 `Sparkles`(유어샵 나침반 아이콘)는 바꿔야 한다 — **"AI 마법"의 관용 기호**이고
     *내 가게* 라는 뜻이 전혀 없다. 시안에 대안(차양 달린 가게 앞) 그려 뒀다.
2. **테두리 걷어내기 범위** — `border-gray-200` 값을 더 옅게 낮추는 단일 지점 방식으로 갈지,
   겹쳐 쓴 65개 파일을 개별 정리할지.
3. **유어샵 개편 착수 승인** — 시안 확인 후.

## 📎 대표에게 공유한 시안
- 진단(테두리·아이콘·촉감, 버튼 눌러볼 수 있음): https://claude.ai/code/artifact/084fb89a-1ca0-42f3-b679-d43170d6c814
- 유어샵 개편안: https://claude.ai/code/artifact/bf4f2e95-d72c-416c-a878-f2a85eee890c

## 🧩 같은 세션의 별건 (스킬 설치 — 이미 머지됨)
- ur-live `7bfa4171` · revate `8f4983f4` · website `f2f04b93` · margin-calculator `1b44beb9` · insta-story-downloader `69105752`
- 스킬 23개를 `.agents/skills/` + `.claude/skills/` 심볼릭 링크, `.mcp.json` 에 21st MCP(`API_KEY_21ST` 필요).
- **미완**: ListingProject 조직 레포 3개(Diagrams·Listing_App·Listing_FE) — 한 세션에 개인+조직 레포를
  같이 못 붙인다(`cross-tier adds are not supported`). **그 레포로 시작하는 새 세션이 필요하다.**
- **미완**: 계정 전역 적용 — claude.ai Settings→Features 업로드는 세션 도구로 불가(대표가 직접).
  PC 전역은 `npx skills add -g <repo>` 두 줄.
