/** 타입 선언 — 구현·근거는 ci-run.mjs. 유닛시험이 순수 함수 둘을 직접 돌려 잰다. */
export declare const TAIL_CHARS: number
export declare const SUMMARY_CHARS: number
/** 뒤에서 n 자를 남긴다(잘랐으면 그 사실을 본문에 적는다). */
export declare function tail(text: unknown, n: number): string
/** 신호로 죽은 것을 0 으로 읽지 않는다 — 0 이면 래칫이 무력화되는데 CI 가 초록이 된다. */
export declare function exitCodeOf(code: number | null, signal: NodeJS.Signals | string | null): number
