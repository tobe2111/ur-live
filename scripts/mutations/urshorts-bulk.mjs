/**
 * 🎬 유어쇼츠 여러 개 한 번에 추가 (2026-09-09) — 주입 매니페스트.
 * 가드: src/tests/unit/urshorts-bulk-add.test.ts
 */
export default [
  {
    name: '🎬 대량 추가가 병렬로 던진다 (쿼터를 순간에 태우고 실패가 뒤섞인다)',
    file: 'src/pages/AdminUrShortsPage.tsx',
    find: '    for (const [i, it] of items.entries()) {',
    replace: '    await Promise.all(items.map(async (it) => { const i = 0;',
    test: 'src/tests/unit/urshorts-bulk-add.test.ts',
    why:
      '건당 유튜브 조회 1 unit + D1 왕복 하나다. 서른 개를 동시에 던지면 쿼터를 순간적으로 태우고, ' +
      '실패해도 몇 번째 줄이 왜 실패했는지 말해 줄 수 없다.',
  },
  {
    name: '🎬 한 줄 실패에 나머지가 통째로 날아간다',
    file: 'src/pages/AdminUrShortsPage.tsx',
    find: "      } catch (e) {\n        const detail = (e as { response?: { data?: { error?: string } } })?.response?.data?.error\n        failed.push(`${it.id}: ${detail || '실패'}`)\n      }",
    replace: '      }',
    test: 'src/tests/unit/urshorts-bulk-add.test.ts',
    why: '스물아홉 개가 멀쩡한데 하나 때문에 전부 버리면 사람이 스물아홉 개를 다시 붙여 넣어야 한다.',
  },
  {
    name: '🎬 입력이 한 줄 input 으로 되돌아간다 (붙여 넣어도 뭉친다)',
    file: 'src/pages/AdminUrShortsPage.tsx',
    find: '            <textarea\n              value={url} onChange={(e) => setUrl(e.target.value)}',
    replace: '            <input\n              value={url} onChange={(e) => setUrl(e.target.value)}',
    test: 'src/tests/unit/urshorts-bulk-add.test.ts',
    why: 'input 은 줄바꿈을 못 받는다 — 여러 줄을 붙여 넣어도 한 줄로 뭉쳐 첫 주소만 인식된다.',
  },
  {
    name: '🎬 화면이 자기만의 split 을 만든다 (세는 개수와 보내는 개수가 갈린다)',
    file: 'src/pages/AdminUrShortsPage.tsx',
    find: '  const parsed = useMemo(() => parseYouTubeUrlList(url), [url])',
    replace: "  const parsed = useMemo(() => ({ ok: url.split('\\n').filter(Boolean).map((u) => ({ url: u, id: u, form: 'shorts' as const })), bad: [], dupes: [] }), [url])",
    test: 'src/tests/unit/urshorts-bulk-add.test.ts',
    why: '화면이 "27개"라고 하고 서버엔 다른 개수가 가면, 사람은 왜 개수가 다른지 영영 모른다.',
  },
  {
    name: '🎬 상한을 넘겨 통째로 보낸다',
    file: 'src/pages/AdminUrShortsPage.tsx',
    find: '    const items = parsed.ok.slice(0, URSHORTS_BULK_MAX)',
    replace: '    const items = parsed.ok',
    test: 'src/tests/unit/urshorts-bulk-add.test.ts',
    why: '수백 개를 붙여 넣으면 유튜브 쿼터가 하루치 날아가고 그날 제목·채널 자동 채우기가 통째로 멎는다.',
  },
  {
    name: '🎬 실패한 줄까지 입력칸에서 지운다',
    file: 'src/pages/AdminUrShortsPage.tsx',
    find: "    setUrl(failed.length ? failed.map((f) => f.split(':')[0]).join('\\n') : '')",
    replace: "    setUrl('')",
    test: 'src/tests/unit/urshorts-bulk-add.test.ts',
    why: '실패한 줄이 사라지면 무엇을 다시 넣어야 하는지 알 수 없어 서른 개를 처음부터 다시 붙여 넣게 된다.',
  },
  {
    name: '🎬 진행 표시가 사라진다 (멈춘 줄 안다)',
    file: 'src/pages/AdminUrShortsPage.tsx',
    find: '{progress ? `${progress.done}/${progress.total}` : ',
    replace: '{false ? `` : ',
    test: 'src/tests/unit/urshorts-bulk-add.test.ts',
    why: '서른 개면 수십 초가 걸린다. 아무 변화가 없으면 사람이 버튼을 다시 누르고 중복이 쌓인다.',
  },
]
