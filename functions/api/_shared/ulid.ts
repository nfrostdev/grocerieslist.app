const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/

export function isUlid (value: unknown): value is string {
  return typeof value === 'string' && ULID_PATTERN.test(value)
}

export function generateUlid (): string {
  const chars: string[] = new Array(26)

  let t = Date.now()
  for (let i = 9; i >= 0; i--) {
    chars[i] = ENCODING[t % 32]
    t = Math.floor(t / 32)
  }

  const bytes = crypto.getRandomValues(new Uint8Array(10))
  let rand = 0n
  for (const b of bytes) rand = (rand << 8n) | BigInt(b)
  for (let i = 25; i >= 10; i--) {
    chars[i] = ENCODING[Number(rand % 32n)]
    rand /= 32n
  }

  return chars.join('')
}

export function generateToken (): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
