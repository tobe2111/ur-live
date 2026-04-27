/**
 * PK Battles Tick — Phase 2-7
 *
 * 매 5분 cron 에 합류. 활성 PK 매출 실시간 집계 + 종료 시점 우승자 결정.
 */

import type { Env } from '../types/env';
import { tickPkBattles } from '../../features/agency/api/pk-battles.routes';

export async function handlePkBattlesTick(env: Env): Promise<void> {
  if (!env.DB) return;
  await tickPkBattles(env.DB);
}
