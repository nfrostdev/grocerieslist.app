import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../../_shared/types'
import { handleRevokeToken } from '../../../_shared/handlers'

export const onRequestPost: PagesFunction<Env> = ({ request, env, params }) =>
  handleRevokeToken(env.DB, request, params.id as string)
