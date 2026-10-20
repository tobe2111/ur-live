/**
 * Drizzle Kit 설정 (introspect / generate / studio 용).
 *
 * 실제 production D1 마이그레이션은 별도 시스템 (`scripts/check-schema-refs.sh`,
 * `/api/_internal/repair-schema`) 으로 관리. 본 config 는 schema 정의 검증 +
 * 향후 typed migration 도입 발판으로만 사용.
 */
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
} satisfies Config
