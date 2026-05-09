import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../../_shared/types'
import { handleMintToken } from '../../../_shared/handlers'

export const onRequestPost: PagesFunction<Env> = ({ request, env, params }) =>
  handleMintToken(env.DB, request, params.id as string)
