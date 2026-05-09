import { describe, it, expect } from 'vitest'
import { checkRateLimit, clientIp, type RateLimitBinding } from '../../../functions/api/_shared/rateLimit'

const allow: RateLimitBinding = { limit: async () => ({ success: true }) }
const deny: RateLimitBinding = { limit: async () => ({ success: false }) }

describe('checkRateLimit', () => {
  it('returns null when limiter allows', async () => {
    const res = await checkRateLimit(allow, 'k')
    expect(res).toBeNull()
  })

  it('returns 429 with Retry-After when limiter denies', async () => {
    const res = await checkRateLimit(deny, 'k')
    expect(res).not.toBeNull()
    expect(res!.status).toBe(429)
    expect(res!.headers.get('Retry-After')).toBe('60')
    const body = await res!.json() as { error: string }
    expect(body.error).toBe('Too Many Requests')
  })

  it('honors custom retryAfter', async () => {
    const res = await checkRateLimit(deny, 'k', 30)
    expect(res!.headers.get('Retry-After')).toBe('30')
  })

  it('fails open when binding is undefined', async () => {
    const res = await checkRateLimit(undefined, 'k')
    expect(res).toBeNull()
  })

  it('passes the key through to the limiter', async () => {
    let seen = ''
    const spy: RateLimitBinding = {
      limit: async ({ key }) => { seen = key; return { success: true } }
    }
    await checkRateLimit(spy, 'provision:1.2.3.4')
    expect(seen).toBe('provision:1.2.3.4')
  })
})

describe('clientIp', () => {
  it('reads CF-Connecting-IP first', () => {
    const req = new Request('http://x', {
      headers: { 'CF-Connecting-IP': '1.1.1.1', 'X-Forwarded-For': '2.2.2.2' }
    })
    expect(clientIp(req)).toBe('1.1.1.1')
  })

  it('falls back to first X-Forwarded-For entry', () => {
    const req = new Request('http://x', {
      headers: { 'X-Forwarded-For': '3.3.3.3, 4.4.4.4' }
    })
    expect(clientIp(req)).toBe('3.3.3.3')
  })

  it('returns "unknown" when no IP headers present', () => {
    expect(clientIp(new Request('http://x'))).toBe('unknown')
  })
})
