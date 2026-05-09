import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_shared/types'
import { handleProvision } from '../_shared/handlers'
import { checkRateLimit, clientIp } from '../_shared/rateLimit'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const limited = await checkRateLimit(env.RATE_LIMIT_PROVISION, `provision:${clientIp(request)}`)
  if (limited) return limited
  return handleProvision(env.DB, request)
}
