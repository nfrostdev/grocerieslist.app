import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../../_shared/types'
import { handleMintToken } from '../../../_shared/handlers'
import { checkRateLimit } from '../../../_shared/rateLimit'

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const listId = params.id as string
  const limited = await checkRateLimit(env.RATE_LIMIT_MINT, `mint:${listId}`)
  if (limited) return limited
  return handleMintToken(env.DB, request, listId)
}
