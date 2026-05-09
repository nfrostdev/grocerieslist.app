import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../_shared/types'
import { handleProvision } from '../_shared/handlers'

export const onRequestPost: PagesFunction<Env> = ({ request, env }) =>
  handleProvision(env.DB, request)
