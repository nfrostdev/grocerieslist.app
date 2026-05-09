import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from '../../_shared/types'
import { handlePoll, handlePatchList, handleDeleteList } from '../../_shared/handlers'

export const onRequestGet: PagesFunction<Env> = ({ request, env, params }) =>
  handlePoll(env.DB, request, params.id as string)

export const onRequestPatch: PagesFunction<Env> = ({ request, env, params }) =>
  handlePatchList(env.DB, request, params.id as string)

export const onRequestDelete: PagesFunction<Env> = ({ request, env, params }) =>
  handleDeleteList(env.DB, request, params.id as string)
