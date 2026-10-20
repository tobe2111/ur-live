/**
 * 반품 기능의 **단일 라우터 진입점**.
 *
 * ## 왜 배럴인가
 * ④-c(부분환불 금액 설정)를 별도 파일로 냈는데(`returns.routes.ts` 는 865줄로 동결 + 돈을
 * 내보내는 엔드포인트와 섞지 않으려고), 그걸 `worker/index.ts` 에 **따로 마운트하면
 * 그 god 파일이 또 자란다**(2664줄, 래칫 대상). 여기서 합쳐 내보내면 워커는 **줄이 안 늘어난다.**
 *
 * ⚠️ 순서: 먼저 등록된 쪽이 먼저 매칭된다. 경로가 겹치지 않으므로(`PATCH /:id/amount` vs
 *   기존 `PUT /:id/*`) 현재는 무관하지만, 같은 메서드+경로를 새로 만들면 **앞의 것만 산다.**
 */
import { Hono } from 'hono'
import type { Env } from '../../../worker/types/env'
import { returnsRoutes as coreReturnsRoutes } from './returns.routes'
import { returnAmountRoutes } from './return-amount.routes'

export const returnsRoutes = new Hono<{ Bindings: Env }>()
  .route('/', coreReturnsRoutes)
  .route('/', returnAmountRoutes)
