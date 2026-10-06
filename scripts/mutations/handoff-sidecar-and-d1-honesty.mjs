/**
 * 되돌려-검증 주입 — ① `d1-migrate` 의 **정직성** · ③ 인계 목차 **사이드카** · ④ 컬러 견본 **40px 박스**
 * (2026-10-06 대표 *"남은 것도 다 해줘"*)
 *
 * 세 처방 모두 **에러 없이 되돌아갈 수 있다**는 공통점이 있다:
 *   · d1-migrate 는 실패를 삼키면 **초록불**이 된다(몇 달간 실제로 그랬다).
 *   · 목차를 추적으로 되돌리면 **다음 머지 때까지** 아무 신호가 없다.
 *   · 견본 색을 버튼으로 되돌리면 팔레트 모양만 바뀌고 **빌드·테스트는 통과**한다.
 * 그래서 전부 주입으로 고정한다.
 */
const WF = '.github/workflows/d1-migrate.yml'
const GEN = 'scripts/generate-handoff-index.mjs'
const HOOKS = 'scripts/install-git-hooks.sh'
const SYNC = 'scripts/check-current-work-sync.mjs'
const STORE = 'src/pages/SellerStoreInfoPage.tsx'

const T_SIDECAR = 'src/tests/unit/handoff-index-sidecar-2026-10-06.test.ts'
const T_RUNG = 'src/tests/unit/seller-rung-40-2026-10-06.test.ts'
const T_D1 = 'src/tests/unit/d1-migrate-honesty-2026-10-06.test.ts'

export default [
  // ───────── ① d1-migrate — 조용한 거짓으로 되돌아가는 길들
  {
    name: 'd1-migrate — 모든 실패를 "이미 적용됨" 으로 삼킨다(몇 달간 초록불이던 그 모양)',
    file: WF,
    find: 'if grep -qiE "duplicate column|already exists" /tmp/out.txt; then',
    replace: 'if true; then',
    test: T_D1,
    why: '이 한 줄이 느슨해지면 DB 이름 오류·권한 오류까지 "이미 적용됨" 이 되어 잡이 초록이 된다 — 바로 그 사고다.',
  },
  {
    name: 'd1-migrate — 적용 게이트 제거(main 푸시마다 프로덕션 D1 에 실제로 쓰기 시작한다)',
    file: WF,
    find: "        if: ${{ vars.D1_MIGRATE_APPLY == 'true' }}\n",
    replace: '',
    test: T_D1,
    why: '게이트가 없으면 쌓인 마이그레이션 전부가 다음 main 푸시에 프로덕션 D1 로 나간다 — 대표 판단 없이 켜지는 길.',
  },
  {
    name: 'd1-migrate — DB 이름을 다시 시크릿에서 읽는다(미설정이면 없는 DB 를 찾는다)',
    file: WF,
    find: "          NAME=$(python3 - <<'PYEOF'",
    replace: "          NAME='${{ secrets.D1_DATABASE_NAME }}'; : <<'PYEOF'",
    test: T_D1,
    why: '시크릿 의존으로 되돌리면 미설정 시 빈 이름/기본값이 되어 같은 드리프트가 재발한다(wrangler.toml 이 진실이다).',
  },
  {
    name: 'd1-migrate — preflight 제거(이름이 틀려도 조용히 넘어간다)',
    file: WF,
    find: '            echo "::error::D1 \'$DB_NAME\' 을 못 찾거나 권한이 없다 — 이것은 \'이미 적용됨\' 이 아니다."',
    replace: '            echo "D1 조회 실패 — 계속"',
    test: T_D1,
    why: 'DB 를 못 찾는 것은 "이미 적용됨" 이 절대 아니다 — 이 자리가 사고가 숨어 있던 바로 그 자리다.',
  },

  // ───────── ③ 인계 목차 — 추적으로 되돌아가는 길들
  {
    name: '인계 목차 — 출력을 추적되는 CURRENT_WORK.md 로 되돌린다(머지 충돌 재발)',
    file: GEN,
    find: "const INDEX_FILE = 'docs/handoff/INDEX.local.md'",
    replace: "const INDEX_FILE = 'docs/CURRENT_WORK.md'",
    test: T_SIDECAR,
    why: '모든 브랜치가 같은 생성 블록을 고치게 되어 내용 무관한 머지 충돌이 그대로 돌아온다(하루 10번+ 이력).',
  },
  {
    name: '인계 목차 — .gitignore 에서 사이드카를 뺀다(가장 조용한 회귀)',
    file: '.gitignore',
    find: 'docs/handoff/INDEX.local.md',
    replace: '# docs/handoff/INDEX.local.md',
    test: T_SIDECAR,
    why: '추적이 되살아나면 충돌이 재발하는데, 다음 머지 때까지 아무 신호가 없다.',
  },
  {
    name: '인계 목차 — 링크에 handoff/ 접두사를 되돌린다(사이드카 기준으로 전부 깨진다)',
    file: GEN,
    find: 'out.push(`- [${e.title}](${e.file})`)',
    replace: 'out.push(`- [${e.title}](handoff/${e.file})`)',
    test: T_SIDECAR,
    why: '목차가 handoff/ 안에 있으므로 접두사가 붙으면 모든 링크가 404 인데 생성은 성공한다(에러 0).',
  },
  {
    name: '인계 목차 — pre-commit 이 다시 CURRENT_WORK.md 를 stage 한다',
    file: HOOKS,
    find: '  node scripts/generate-handoff-index.mjs > /dev/null 2>&1 || true',
    replace: '  node scripts/generate-handoff-index.mjs > /dev/null 2>&1 || true\n  git add docs/CURRENT_WORK.md > /dev/null 2>&1 || true',
    test: T_SIDECAR,
    why: 'stage 가 되살아나면 목차가 어디 있든 모든 브랜치가 그 파일을 커밋에 넣어 충돌한다.',
  },
  {
    name: '인계 목차 — 동기화 가드가 CURRENT_WORK.md 손댐을 인계 갱신으로 센다',
    file: SYNC,
    find: 'const isHandoff = (f) => f.startsWith(HANDOFF_DIR)',
    replace: "const HANDOFF_INDEX = 'docs/CURRENT_WORK.md'\nconst isHandoff = (f) => f.startsWith(HANDOFF_DIR) || f === HANDOFF_INDEX",
    test: T_SIDECAR,
    why: '목차가 그 파일에 없는데 손댐을 통과로 세면 가드가 헛돈다(인계 없이도 초록).',
  },

  // ───────── ④ 컬러 견본 — 팔레트 모양을 되돌리는 길들
  {
    name: '컬러 견본 — 색을 다시 버튼이 칠한다(40px 색 원이 되어 팔레트가 달라진다)',
    file: STORE,
    find: `                        <button key={c} type="button" onClick={() => set('brand_color', c)}
                          aria-label={\`색상 \${c}\`}
                          className="grid h-10 w-10 place-items-center rounded-full">`,
    replace: `                        <button key={c} type="button" onClick={() => set('brand_color', c)}
                          aria-label={\`색상 \${c}\`} style={{ background: c }}
                          className="grid h-10 w-10 place-items-center rounded-full">`,
    test: T_RUNG,
    why: '보이는 지름이 28 → 40px 가 되어 색 견본이 버튼 줄처럼 보인다 — 빌드·테스트는 통과하므로 눈으로만 드러난다.',
  },
  {
    name: '컬러 견본 — 박스를 28px 로 되돌린다(폰에서 못 누르는 크기)',
    file: STORE,
    find: 'className="grid h-10 w-10 place-items-center rounded-full">',
    replace: 'className="grid h-7 w-7 place-items-center rounded-full">',
    test: T_RUNG,
    why: '40px 눈금 아래로 내려가 작은 타깃이 다시 7개가 된다.',
  },
  {
    name: '컬러 견본 — tap-reach 로 "통일"(카드가 overflow-hidden 이라 안 닿는다)',
    file: STORE,
    find: 'className="grid h-10 w-10 place-items-center rounded-full">',
    replace: 'className="tap-reach grid h-7 w-7 place-items-center rounded-full">',
    test: T_RUNG,
    why: '선언만 40px 이고 실제로는 안 닿는다 — 감사가 그 자리를 "정상" 으로 세어 더 나쁘다.',
  },
]
