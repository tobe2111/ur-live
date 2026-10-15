/**
 * 🔎 `ci-annotate.mjs` 의 타입 — 유닛시험이 이 모듈을 **직접 돌려** 이스케이프 규칙을 재기 때문에
 *   선언이 필요하다(`allowJs` 가 꺼져 있어 `.mjs` 는 암묵 any 가 된다).
 */
export type AnnotationLevel = 'error' | 'warning' | 'notice'
export interface AnnotationProps {
  title?: string
  file?: string
  line?: number | string
  endLine?: number | string
  col?: number | string
  endColumn?: number | string
}
export declare function escapeData(s: unknown): string
export declare function escapeProp(s: unknown): string
export declare function annotationLine(level: AnnotationLevel, message: string, props?: AnnotationProps): string
export declare function emitAnnotation(
  level: AnnotationLevel,
  message: string,
  props?: AnnotationProps,
  env?: Record<string, string | undefined>,
  out?: (line: string) => void,
): boolean
export declare function appendSummary(
  markdown: string,
  env?: Record<string, string | undefined>,
  fsMod?: { appendFileSync: (p: string, s: string) => void },
): boolean
