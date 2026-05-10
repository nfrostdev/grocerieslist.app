import { describe, it, expect } from 'vitest'
import { hashToken } from '@shared/crypto'

describe('hashToken', () => {
  it('returns a non-empty base64url string', async () => {
    const hash = await hashToken('some-token')
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(10)
    expect(hash).not.toMatch(/[+/=]/)
  })

  it('is deterministic — same input yields same hash', async () => {
    expect(await hashToken('abc')).toBe(await hashToken('abc'))
  })

  it('produces distinct hashes for distinct inputs', async () => {
    expect(await hashToken('token-a')).not.toBe(await hashToken('token-b'))
  })
})
