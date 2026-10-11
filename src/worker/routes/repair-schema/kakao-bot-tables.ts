/**
 * 💬 카카오톡 채널 챗봇 매장 관리 테이블 (2026-10-10) — DDL 은 `utils/kakao-bot-store.ts` SSOT 를 그대로 쓴다.
 *   (런타임 `ensureKakaoBotTables` 와 이 복구 경로가 같은 문장이어야 한다 — 두 벌이면 갈린다.)
 */
import { KAKAO_BOT_DDL } from '../../utils/kakao-bot-store'

export const KAKAO_BOT_REPAIRS: Array<{ name: string; sql: string }> = KAKAO_BOT_DDL.map((d) => ({ name: d.name, sql: d.sql }))
