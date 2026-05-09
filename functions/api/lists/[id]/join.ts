import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../_shared/types'
import { handleJoin } from '../../_shared/handlers'

export const onRequestPost: PagesFunction<Env> = ({ request, env, params }) =>
  handleJoin(env.DB, request, params.id as string)
