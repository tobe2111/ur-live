/**
 * 🏛️ 어드민에서 네 서비스가 섞이지 않는다 — 주입 매니페스트 (2026-09-16 등록, 원본 2026-08-16 #1149 ⑩⑪).
 * 가드: src/tests/unit/admin-nav-classification.test.ts · src/tests/unit/admin-service-separation.test.ts
 *
 * 🔀 **원 커밋은 이 두 항목을 `check-guard-mutations.mjs` 인라인 배열에 넣었다.** 체리픽하면서
 *    분할 파일로 옮긴다 — CLAUDE.md 2026-09-08 규칙("새 가드를 만들면 주입을 한 줄 추가할 것,
 *    자리는 `scripts/mutations/<도메인>.mjs`")이고, 그 인라인 파일은 한 달 사이 **249번** 바뀐
 *    충돌 다발 지점이라 새 항목을 더 얹을 이유가 없다.
 *
 * 두 항목이 지키는 명제는 하나다: **어드민 화면에서 서비스 경계가 조용히 무너지지 않는다.**
 * 둘 다 회귀해도 화면이 안 깨지고 에러도 경고도 없다 — 사람이 알아챌 신호가 0 인 종류다.
 *
 * 📝 원 커밋이 **일부러 뺀** 세 번째 항목도 그대로 옮겨 적는다(판단을 잃지 않게):
 *   *"도매 API 스코프 가드가 super 전용 화면까지 센다"* 는 결함이
 *   `scripts/check-wholesale-admin-api-scope.mjs` 안에 있는데, 검증자로 지정할 수 있는 vitest 테스트가
 *   그 스크립트를 **실행하지 않는다** → 결함을 심어도 테스트는 통과하고 매니페스트가 자기 항목이
 *   헛돎을 그대로 잡아낸다. 커버리지를 지어내는 대신 뺐다.
 *   ⚠️ 뺀 것이 안전한 이유: 그 회귀는 **오탐(빨강)으로 나타난다** — 시끄럽고 자가교정된다.
 *   매니페스트가 지키는 것은 *조용한* 실패이지 시끄러운 실패가 아니다.
 *   (짝인 `/admin/maker-pool` 의 super-only 지정 자체는 `admin-nav-classification.test.ts` 가 고정한다.)
 */
export default [
  {
    name: '[어드민분리] nav 밴드 판정을 옛 제목매칭 폴백으로 되돌린다(서비스가 조용히 공통 서랍으로)',
    file: 'src/components/admin/admin-nav-config.ts',
    find: 'export const navSectionOf = (g: NavGroup): NavSectionKey => g.section',
    replace: "export const navSectionOf = (g: NavGroup): NavSectionKey => (g.title === '운영' ? 'home' : 'common')",
    test: 'src/tests/unit/admin-nav-classification.test.ts',
    why:
      '어드민 좌측 nav 는 서비스 넷(유어딜·공구 서비스·유어애즈·유통스타트)을 밴드로 가른다. 옛 구현은 그룹 ' +
      '**제목을 문자열로 맞춰보고** 안 맞으면 조용히 `common` 으로 떨어뜨렸다 — 즉 **아무것도 안 하면 공통 ' +
      '서랍으로 빨려 들어가는** 기본값이었고, 실제로 **유어애즈가 서비스인데도 "공통 · 회원·재무·검증·시스템" ' +
      '아래 렌더**되고 있었다(2026-08-16 실측). 라벨은 자주 바뀌므로(8/14 에도, 9/14 에도 바꿨다) 제목 매칭은 ' +
      '**이름을 고치면 밴드가 말없이 이동**하는 2차 취약점도 갖는다. ⚠️ 이 회귀는 화면이 안 깨지고 ' +
      '**메뉴가 다른 헤더 밑에 얌전히 그려질 뿐**이라 에러도 경고도 없다 — 사람이 알아챌 신호가 0.',
  },
  {
    name: '[어드민분리] 상품 목록에서 몰 스코프를 뺀다(남의 가게 상품이 유어딜 목록에 조용히 섞인다)',
    file: 'src/features/admin/api/admin-products.routes.ts',
    find: "${where.join(' AND ')}${scopeP}",
    replace: "${where.join(' AND ')}",
    test: 'src/tests/unit/admin-service-separation.test.ts',
    why:
      '유어딜과 공구 서비스(운영자 몰)는 **같은 테이블·같은 카테고리**를 쓴다. 조건을 명시하지 않으면 ' +
      '운영자 가게 상품이 유어딜 어드민 목록에 그대로 섞이고, **에러가 없어 아무도 모른다**(파일럿 몰의 ' +
      '상품이 0건이라 안 터졌을 뿐이다). ' +
      '🐛 이 항목을 넣은 진짜 이유는 따로 있다 — 이 검사의 **첫 판이 헛돌았다.** 원래 ' +
      '`whereClause = where.length[\\s\\S]{0,120}${scopeP}` 같은 근접 매칭이라, 목록 분기에서 스코프를 빼도 ' +
      '**else 분기에 남은 `${scopeP}`** 가 120자 안에 들어와 초록이 떴다(되돌려-검증에서 발견). ' +
      '느슨한 근접 매칭은 "그 이름이 파일 어딘가에 있다"만 확인한다 — 그래서 분기마다 앵커로 바꿨고, ' +
      '그 교정이 유지되는지를 여기서 계속 확인한다.',
  },
  {
    name: '[어드민nav] 공통 데스크 항목에서 서비스 표시를 뗀다(어느 서비스 인플루언서인지 알 수 없다)',
    file: 'src/components/admin/admin-nav-config.ts',
    find: "label: '유어딜 추천 커미션 송금'",
    replace: "label: '인플루언서 송금'",
    test: 'src/tests/unit/admin-nav-classification.test.ts',
    why:
      '유어딜의 추천 커미션(`influencer_attributions` = 매장영입 + 공구추천)과 ' +
      '유어애즈의 외부 수집 인플루언서 DB 는 **다른 서비스**인데 메뉴 이름이 둘 다 "인플루언서 …" 였다. ' +
      '게다가 둘은 서로 다른 밴드에 있어(하나는 유어애즈, 둘은 공통 머니·CS 데스크) 나란히 보이지도 않는다. ' +
      '머니 데스크는 한 큐로 처리해야 해서 메뉴를 옮기는 것이 답이 아니고 — 대표가 물은 것도 ' +
      '*"어느 서비스냐"* 이지 *"옮겨 달라"* 가 아니었다 — **라벨이 유일한 구분 수단**이다. ' +
      '떼면 에러 없이 "인플루언서 송금" 으로 돌아가고, 잘못 누른 송금은 되돌리기 어렵다.',
  },
]
