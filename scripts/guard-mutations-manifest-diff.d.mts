/** 주입 하나의 **동일성** 필드가 담긴 최소 형태(전체 주입은 `why` 등을 더 갖는다). */
export interface MutationIdentity {
  name: string
  file?: string
  find?: string
  replace?: string
  test?: string
  [k: string]: unknown
}

/**
 * base·head 주입 목록을 견줘 **이 PR 에서 돌아야 할 이름**을 돌려준다.
 * 새로 생겼거나 `file·find·replace·test` 중 하나가 달라진 것만 — 설명(`why`)만 바뀐 건 제외.
 * `base` 가 null 이면 head 전부(넓은 쪽).
 */
export function changedInjectionNames(
  base: MutationIdentity[] | null | undefined,
  head: MutationIdentity[] | null | undefined,
): Set<string>

/** 러너 소스에서 인라인 매니페스트 구간만 도려낸 나머지. 앵커를 못 찾으면 `null`(= 판정 불가). */
export function stripInlineManifest(src: string): string | null

/** 러너의 **판정 로직**이 바뀌었는가. 판정 불가도 `true`(전수 쪽). */
export function runnerLogicChanged(baseSrc: string, headSrc: string): boolean

/** 테스트 소스가 하위 프로세스를 띄우는가(가드 스크립트를 직접 돌리는 14개를 가려낸다). */
export function testSpawnsSubprocess(src: string): boolean
