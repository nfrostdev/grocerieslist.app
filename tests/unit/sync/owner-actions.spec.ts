import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mintEditorToken, revokeEditorToken, deleteList } from '@/sync'
import { mintToken, revokeToken, deleteListRequest } from '@/sync/transport'
import { stopPoller } from '@/sync/poll'
import { cleanupListLocally } from '@/sync/cleanup'
import { getMeta, setMeta } from '@/sync/storage'

vi.mock('@/sync/transport', () => ({
  provisionList: vi.fn(),
  joinList: vi.fn(),
  mintToken: vi.fn(),
  revokeToken: vi.fn(),
  deleteListRequest: vi.fn()
}))
vi.mock('@/sync/poll', () => ({ startPoller: vi.fn(), stopPoller: vi.fn() }))
vi.mock('@/sync/cleanup', () => ({ cleanupListLocally: vi.fn() }))
vi.mock('@/sync/queue', () => ({ startDrainer: vi.fn(), enqueue: vi.fn() }))
vi.mock('@/sync/reconcile', () => ({ applyJoinPayload: vi.fn() }))
vi.mock('@/stores/lists', () => ({ useListsStore: vi.fn() }))

const mMintToken = vi.mocked(mintToken)
const mRevokeToken = vi.mocked(revokeToken)
const mDeleteListRequest = vi.mocked(deleteListRequest)
const mStopPoller = vi.mocked(stopPoller)
const mCleanupListLocally = vi.mocked(cleanupListLocally)

const OWNER_META = { authToken: 'owner-tok', role: 'owner' as const, lastVersion: 1 }
const EDITOR_META = { authToken: 'editor-tok', role: 'editor' as const, lastVersion: 1 }

beforeEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
})

describe('mintEditorToken', () => {
  it('returns null when list is not synced', async () => {
    expect(await mintEditorToken('list1', 'label')).toBeNull()
    expect(mMintToken).not.toHaveBeenCalled()
  })

  it('returns null when role is editor', async () => {
    setMeta('list1', EDITOR_META)
    expect(await mintEditorToken('list1', 'label')).toBeNull()
  })

  it('returns null when mintToken fails', async () => {
    setMeta('list1', OWNER_META)
    mMintToken.mockResolvedValue({ ok: false, error: { kind: 'network' } })
    expect(await mintEditorToken('list1', 'Sarah')).toBeNull()
  })

  it('returns token, hash, joinUrl and persists to editorTokens', async () => {
    setMeta('list1', OWNER_META)
    mMintToken.mockResolvedValue({ ok: true, data: { token: 'new-tok' } })

    const result = await mintEditorToken('list1', 'Sarah')

    expect(result).not.toBeNull()
    expect(result!.token).toBe('new-tok')
    expect(typeof result!.hash).toBe('string')
    expect(result!.hash.length).toBeGreaterThan(10)
    expect(result!.joinUrl).toContain('#join=list1.new-tok')

    const meta = getMeta('list1')!
    expect(meta.editorTokens).toHaveLength(1)
    expect(meta.editorTokens![0]).toMatchObject({ token: 'new-tok', label: 'Sarah' })
  })

  it('appends to existing editorTokens', async () => {
    setMeta('list1', {
      ...OWNER_META,
      editorTokens: [{ token: 'old-tok', hash: 'old-hash', label: 'Old' }]
    })
    mMintToken.mockResolvedValue({ ok: true, data: { token: 'new-tok' } })

    await mintEditorToken('list1', 'New')

    expect(getMeta('list1')!.editorTokens).toHaveLength(2)
  })
})

describe('revokeEditorToken', () => {
  it('returns false when list is not synced', async () => {
    expect(await revokeEditorToken('list1', 'hash1')).toBe(false)
  })

  it('returns false when role is editor', async () => {
    setMeta('list1', EDITOR_META)
    expect(await revokeEditorToken('list1', 'hash1')).toBe(false)
  })

  it('returns false when revokeToken fails', async () => {
    setMeta('list1', OWNER_META)
    mRevokeToken.mockResolvedValue({ ok: false, error: { kind: 'network' } })
    expect(await revokeEditorToken('list1', 'hash1')).toBe(false)
  })

  it('returns true and removes the token from editorTokens', async () => {
    setMeta('list1', {
      ...OWNER_META,
      editorTokens: [
        { token: 'tok-a', hash: 'hash-a', label: 'A' },
        { token: 'tok-b', hash: 'hash-b', label: 'B' }
      ]
    })
    mRevokeToken.mockResolvedValue({ ok: true, data: {} as Record<string, never> })

    expect(await revokeEditorToken('list1', 'hash-a')).toBe(true)

    const tokens = getMeta('list1')!.editorTokens!
    expect(tokens).toHaveLength(1)
    expect(tokens[0].hash).toBe('hash-b')
  })
})

describe('deleteList', () => {
  it('returns false when list is not synced', async () => {
    expect(await deleteList('list1')).toBe(false)
    expect(mDeleteListRequest).not.toHaveBeenCalled()
  })

  it('returns false when role is editor', async () => {
    setMeta('list1', EDITOR_META)
    expect(await deleteList('list1')).toBe(false)
  })

  it('returns false when server returns error', async () => {
    setMeta('list1', OWNER_META)
    mDeleteListRequest.mockResolvedValue({ ok: false, error: { kind: 'network' } })
    expect(await deleteList('list1')).toBe(false)
    expect(mStopPoller).not.toHaveBeenCalled()
  })

  it('returns true and calls stopPoller + cleanupListLocally on success', async () => {
    setMeta('list1', OWNER_META)
    mDeleteListRequest.mockResolvedValue({ ok: true, data: {} as Record<string, never> })

    expect(await deleteList('list1')).toBe(true)
    expect(mDeleteListRequest).toHaveBeenCalledWith('list1', 'owner-tok')
    expect(mStopPoller).toHaveBeenCalledWith('list1')
    expect(mCleanupListLocally).toHaveBeenCalledWith('list1')
  })
})
