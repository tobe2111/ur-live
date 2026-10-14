// 🪶 axios 대체 클라이언트(2026-10-14) — 되돌려-검증 주입.
const TEST = 'src/tests/unit/http-client-2026-10-14.test.ts'

export default [
  {
    name: '🪶 params 의 쉼표를 인코딩한다(axios 와 캐시 키가 갈린다)',
    file: 'src/lib/http-client.ts',
    find: ".replace(/%2C/gi, ',')",
    replace: '',
    test: TEST,
    why: '엣지 캐시·cron 예열 키가 이 문자열이다 — 한 글자만 달라도 예열을 못 받는다.',
  },
  {
    name: '🪶 요청 인터셉터를 등록 순으로 돌린다(axios 는 역순)',
    file: 'src/lib/http-client.ts',
    find: 'if (h) chain.unshift([h.fulfilled, h.rejected])',
    replace: 'if (h) chain.push([h.fulfilled, h.rejected])',
    test: TEST,
    why: '인증 인터셉터와 FormData 인터셉터의 순서가 뒤집힌다.',
  },
  {
    name: '🪶 데이터 없는 GET 에도 Content-Type 을 보낸다',
    file: 'src/lib/http-client.ts',
    find: "if (body === undefined) deleteHeader(headers, 'Content-Type')",
    replace: 'if (body === undefined) {}',
    test: TEST,
    why: 'axios 는 지운다 — 남기면 서버의 본문 파서·CORS 동작이 달라진다.',
  },
  {
    name: '🪶 시간 초과 코드가 ECONNABORTED 가 아니다',
    file: 'src/lib/http-client.ts',
    find: 'exceeded`, HttpError.ECONNABORTED',
    replace: 'exceeded`, HttpError.ERR_NETWORK',
    test: TEST,
    why: "호출부가 err.code === 'ECONNABORTED' 로 시간 초과 문구를 고른다.",
  },
  {
    name: '🪶 4xx 도 성공으로 넘긴다',
    file: 'src/lib/http-client.ts',
    find: 'validateStatus: (s: number) => s >= 200 && s < 300,',
    replace: 'validateStatus: (s: number) => s >= 200 && s < 500,',
    test: TEST,
    why: '401 인터셉터(토큰 갱신·로그인 이동)가 아예 안 돈다.',
  },
]
