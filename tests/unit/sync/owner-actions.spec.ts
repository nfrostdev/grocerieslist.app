import { describe, it, expect, vi, beforeEach } from 'vitest'
import { enableSharing, disableSharing, deleteList, leaveList } from '@/sync'
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

describe('enableSharing', () => {
  it('returns null when list is not synced', async () => {
    expect(await enableSharing('list1')).toBeNull()
    expect(mMintToken).not.toHaveBeenCalled()
  })

  it('returns null when role is editor', async () => {
    setMeta('list1', EDITOR_META)
    expect(await enableSharing('list1')).toBeNull()
  })

  it('returns existing share URL without minting when shareToken already exists', async () => {
    setMeta('list1', { ...OWNER_META, shareToken: 'existing-tok' })
    const url = await enableSharing('list1')
    expect(url).toContain('#join=list1.existing-tok')
    expect(mMintToken).not.toHaveBeenCalled()
  })

  it('returns null when mintToken fails', async () => {
    setMeta('list1', OWNER_META)
    mMintToken.mockResolvedValue({ ok: false, error: { kind: 'network' } })
    expect(await enableSharing('list1')).toBeNull()
  })

  it('returns join URL and persists shareToken to meta', async () => {
    setMeta('list1', OWNER_META)
    mMintToken.mockResolvedValue({ ok: true, data: { token: 'new-tok' } })

    const url = await enableSharing('list1')

    expect(url).toContain('#join=list1.new-tok')
    expect(getMeta('list1')!.shareToken).toBe('new-tok')
  })
})

describe('disableSharing', () => {
  it('returns false when list is not synced', async () => {
    expect(await disableSharing('list1')).toBe(false)
  })

  it('returns false when role is editor', async () => {
    setMeta('list1', EDITOR_META)
    expect(await disableSharing('list1')).toBe(false)
  })

  it('returns false when revokeToken fails', async () => {
    setMeta('list1', { ...OWNER_META, shareToken: 'tok' })
    mRevokeToken.mockResolvedValue({ ok: false, error: { kind: 'network' } })
    expect(await disableSharing('list1')).toBe(false)
    expect(getMeta('list1')!.shareToken).toBe('tok')
  })

  it('returns true and removes shareToken from meta', async () => {
    setMeta('list1', { ...OWNER_META, shareToken: 'tok' })
    mRevokeToken.mockResolvedValue({ ok: true, data: {} as Record<string, never> })

    expect(await disableSharing('list1')).toBe(true)
    expect(getMeta('list1')!.shareToken).toBeUndefined()
    expect(mRevokeToken).toHaveBeenCalledWith('list1', 'owner-tok')
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

describe('leaveList', () => {
  it('calls stopPoller and cleanupListLocally', () => {
    leaveList('list1')
    expect(mStopPoller).toHaveBeenCalledWith('list1')
    expect(mCleanupListLocally).toHaveBeenCalledWith('list1')
  })
})
