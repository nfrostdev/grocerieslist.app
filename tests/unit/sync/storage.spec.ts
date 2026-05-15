import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { getSyncMetaMap, saveSyncMetaMap, getMeta, setMeta, removeMeta } from '@/sync/storage'

const META = { authToken: 'tok', role: 'owner' as const, lastCursor: 1 }

describe('sync/storage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('getSyncMetaMap returns {} when nothing stored', () => {
    expect(getSyncMetaMap()).toEqual({})
  })

  it('getSyncMetaMap returns {} when stored value is invalid JSON', () => {
    localStorage.setItem('syncMeta', 'not-json')
    expect(getSyncMetaMap()).toEqual({})
  })

  it('getSyncMetaMap backs up corrupted blob and warns', () => {
    localStorage.setItem('syncMeta', '{not valid json')
    expect(getSyncMetaMap()).toEqual({})
    expect(console.warn).toHaveBeenCalled()
    const backups = Object.keys(localStorage).filter(k => k.startsWith('syncMeta.corrupted.'))
    expect(backups).toHaveLength(1)
    expect(localStorage.getItem(backups[0])).toBe('{not valid json')
    expect(localStorage.getItem('syncMeta')).toBeNull()
  })

  it('getSyncMetaMap backs up non-object JSON (array or null)', () => {
    localStorage.setItem('syncMeta', '[]')
    expect(getSyncMetaMap()).toEqual({})
    expect(console.warn).toHaveBeenCalled()
    const backups = Object.keys(localStorage).filter(k => k.startsWith('syncMeta.corrupted.'))
    expect(backups).toHaveLength(1)
  })

  it('saveSyncMetaMap round-trips through getSyncMetaMap', () => {
    const map = { abc: META }
    saveSyncMetaMap(map)
    expect(getSyncMetaMap()).toEqual(map)
  })

  it('getMeta returns null when listId absent', () => {
    expect(getMeta('missing')).toBeNull()
  })

  it('getMeta returns the entry when present', () => {
    setMeta('abc', META)
    expect(getMeta('abc')).toEqual(META)
  })

  it('setMeta merges without clobbering other entries', () => {
    const meta2 = { authToken: 't2', role: 'editor' as const, lastCursor: 2 }
    setMeta('id1', META)
    setMeta('id2', meta2)
    expect(getMeta('id1')).toEqual(META)
    expect(getMeta('id2')).toEqual(meta2)
  })

  it('removeMeta deletes the entry', () => {
    setMeta('abc', META)
    removeMeta('abc')
    expect(getMeta('abc')).toBeNull()
  })

  it('removeMeta leaves other entries intact', () => {
    setMeta('keep', META)
    setMeta('gone', META)
    removeMeta('gone')
    expect(getMeta('keep')).toEqual(META)
  })
})
