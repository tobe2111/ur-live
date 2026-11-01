/** 타입 선언 — 시험이 `first-list-id.mjs` 를 import 할 때 implicit any 를 막는다. */
export type Pick =
  | { id: number; fail?: undefined; empty?: undefined }
  | { empty: true; id?: undefined; fail?: undefined }
  | { fail: string; id?: undefined; empty?: undefined }
export declare function pickFirstId(doc: unknown): Pick
export declare function formatPick(r: Pick): string
