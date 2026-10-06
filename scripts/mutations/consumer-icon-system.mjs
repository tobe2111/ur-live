/**
 * 🎨 소비자 아이콘 체계 — 뜻은 유어딜, 조작은 lucide (2026-09-29)
 * 가드: src/tests/unit/consumer-icon-system-2026-09-29.test.ts
 *
 * 되돌리려는 사고는 셋이다 — ① lucide 뜻 아이콘이 슬금슬금 다시 는다 ② 세트를 쓰면서
 * 호출부가 획을 제각기 박아 정체성이 도로 흩어진다 ③ `fill` 로 채우려다 **속 빈 하트**가 된다.
 */
const TEST = 'src/tests/unit/consumer-icon-system-2026-09-29.test.ts'

export default [
  {
    name: '🎨 lucide 뜻 아이콘이 한 건 되돌아온다 (래칫이 실제로 세는가)',
    file: 'src/components/ToastContainer.tsx',
    find: "import { OkIcon, AlertIcon, InfoIcon } from '@/components/icons/urdeal-icons'",
    replace:
      "import { OkIcon, AlertIcon, InfoIcon } from '@/components/icons/urdeal-icons'\n" +
      "import { Gift } from 'lucide-react'\nconst _back = <Gift className=\"w-4 h-4\" />",
    test: TEST,
    why:
      '🩸 **첫 판 주입은 기준값을 184 → 600 으로 올리는 것이었고, 통과해 버렸다** — 당연하다. ' +
      '래칫의 천장을 올리는 건 *느슨해지는* 일이지 *위반* 이 아니라 시험이 빨개질 수가 없다. ' +
      '래칫이 실제로 세는지 보려면 **한 건을 되돌려 놓아야** 한다(184 → 185). ' +
      '천장을 몰래 올리는 쪽은 시험이 아니라 리뷰와 `check-stale-mutation-anchors` 의 몫이다.',
  },
  {
    name: '🎨 호출부가 세트의 획을 다시 덮어쓴다 (1.6 이 열 가지가 된다)',
    file: 'src/components/ToastContainer.tsx',
    find: '<OkIcon className="w-[18px] h-[18px] text-brand-text shrink-0" />',
    replace: '<OkIcon className="w-[18px] h-[18px] text-brand-text shrink-0" strokeWidth={2.5} />',
    test: TEST,
    why:
      'lucide 기본이 2 라 호출부 58곳이 1.5~3 으로 제각기 손보고 있었다. 그림만 우리 것으로 바꾸고 ' +
      '이걸 두면 **획이 열 가지로 남는다** — 세트를 만든 이유가 사라진다.',
  },
  {
    name: '🎨 채우기를 다시 `fill` 로 (하트가 속 빈 채로 뜬다)',
    file: 'src/pages/restaurant-map/SelectedDetailCard.tsx',
    find: "<HeartIcon className=\"w-4 h-4\" filled={favorites.includes(selected.id)} />",
    replace: "<HeartIcon className=\"w-4 h-4\" fill={favorites.includes(selected.id) ? 'currentColor' : 'none'} />",
    test: TEST,
    why:
      'lucide 는 `<svg fill>` 이 path 까지 먹었지만 우리 아이콘은 path 에 `fill="none"` 을 박는다 ' +
      '(면/선을 `filled` 로 가르기 위해서다) ⇒ **표시가 그냥 안 된다.** 찜해도 하트가 안 차는 ' +
      '종류라 에러가 없고 아무도 신고하지 않는다.',
  },
  {
    name: '🎨 조작 목록에 뜻 아이콘을 슬쩍 넣는다 (면제 구멍)',
    file: TEST,
    find: "  'Maximize2', 'Minimize2', 'LucideIcon',",
    replace: "  'Maximize2', 'Minimize2', 'LucideIcon', 'Sparkles', 'Store', 'Gift', 'Heart', 'MapPin',",
    test: TEST,
    why:
      '"조작" 은 *어느 앱에서나 같은 모양* 이라는 뜻이지 *아직 안 옮긴 것* 이라는 뜻이 아니다. ' +
      '여기에 뜻 이름을 더하면 래칫이 그만큼 헐거워지고, 그게 이 체계가 무너지는 가장 쉬운 길이다. ' +
      '🩸 첫 판에서 이 주입도 **통과했다**(면제를 넓히는 건 위반이 아니다) — 그래서 시험에 ' +
      '*"코드모드 대응표에 이미 그려 둔 이름이 조작 목록에 있으면 안 된다"* 는 불변식을 새로 넣었다. ' +
      'Store·Gift·Heart·MapPin 은 전부 그 표에 있으므로 이제 빨간불이 된다.',
  },
  {
    name: '🕳️ 아이콘 검사에서 최상위 페이지가 빠진다 (git `**` 는 최상위를 안 잡는다)',
    file: TEST,
    find: "  \"git ls-files 'src/pages/*.tsx' 'src/pages/**/*.tsx' 'src/components/*.tsx' 'src/components/**/*.tsx'\",",
    replace: "  \"git ls-files 'src/pages/**/*.tsx' 'src/components/**/*.tsx'\",",
    test: TEST,
    why:
      'git pathspec 의 `**` 는 FNM_PATHNAME 이라 **디렉터리를 최소 하나 요구한다** — ' +
      '`src/pages/*.tsx` 734개가 통째로 빠지는데 "몇백 개 검사함" 처럼 보여 아무도 모른다(09-29 실측).',
  },
  {
    /**
     * 🎯 2026-09-30 재조준(지운 것이 아니다). 앵커는 `PaymentSuccessPage` 의 import 였고
     * 결함은 *"잠금 파일에 세트를 밀어 넣는다"* 였는데, **대표 승인으로 잠금표가 이행된 순간
     * 그 결함이 곧 정답이 됐다** — 시험의 단언이 "손대지 않았는가" → "이행됐는가" 로 뒤집혔기 때문이다.
     * ⇒ 주입이 헛돌아 CI 가 잡았다(2026-09-30 head e5784cd, Verify 스텝 19).
     *
     * 이 주입의 `why` 는 원래부터 **코드모드**를 말하고 있었다("코드모드가 잠금 목록을 안 보면…").
     * 그 자리로 옮긴다 — 지키려던 것은 그대로 살아 있다: *다음* 이행이 잠금표를 승인 없이 쓸면 안 된다.
     */
    name: '🔒 코드모드가 잠금표를 기본 실행에서 쓸어 간다 (승인 절차 우회)',
    file: 'scripts/codemods/adopt-urdeal-icons.mjs',
    find: "? LOCK.has(f) || MIRRORS.has(f) : !LOCK.has(f) && !MIRRORS.has(f)",
    replace: "? LOCK.has(f) || MIRRORS.has(f) : !MIRRORS.has(f)",
    test: TEST,
    why:
      'Toss V2·로딩 잠금표 파일은 className 하나를 바꿔도 대표 승인 + audit log 가 필요하다(CLAUDE.md 절대 룰). ' +
      '기본 실행이 그 목록을 안 보면 다음 이행에 조용히 섞여 들어가고, 그러면 잠금 절차가 형해화된다 — ' +
      '에러가 안 나서 아무도 신고하지 않는 클래스다.',
  },
  {
    name: '🔒 잠금표 이행이 되돌아간다 (BottomNav 가 세트를 잃는다)',
    file: 'src/components/main/BottomNav.tsx',
    find: "} from '@/components/icons/urdeal-icons'",
    replace: "} from '@/components/icons/urdeal-icons-REVERTED'",
    test: TEST,
    why:
      '2026-09-02·09-30 승인분이 되돌아가면 하단 탭이 다시 lucide 로 돌아가 획이 2.0 과 1.6 으로 갈린다. ' +
      '단언(`touched >= 5` + BottomNav 포함)이 그 회귀를 잡는지 확인한다 — ' +
      '이행형 단언은 "늘 통과" 하기 쉬워서 반대 방향을 따로 심어야 한다.',
  },
]
