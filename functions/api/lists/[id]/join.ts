import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../_shared/types'
import { handleJoin } from '../../_shared/handlers'
import { checkRateLimit, clientIp } from '../../_shared/rateLimit'

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const listId = params.id as string
  const limited = await checkRateLimit(env.RATE_LIMIT_JOIN, `join:${clientIp(request)}:${listId}`)
  if (limited) return limited
  return handleJoin(env.DB, request, listId)
}
