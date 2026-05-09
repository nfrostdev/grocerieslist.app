import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../../_shared/types'
import { handleUpsertItem } from '../../../_shared/handlers'

export const onRequestPost: PagesFunction<Env> = ({ request, env, params }) =>
  handleUpsertItem(env.DB, request, params.id as string, params.itemId as string)
