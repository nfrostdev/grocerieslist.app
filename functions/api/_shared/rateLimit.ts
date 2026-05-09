export interface RateLimitBinding {
  limit: (options: { key: string }) => Promise<{ success: boolean }>
}

// Returns a 429 Response when the request should be throttled, otherwise null.
// Fail-open if the binding is missing so local dev / tests don't break when
// the platform binding isn't wired up.
export async function checkRateLimit (
  limiter: RateLimitBinding | undefined,
  key: string,
  retryAfterSeconds = 60
): Promise<Response | null> {
  if (!limiter) return null
  const { success } = await limiter.limit({ key })
  if (success) return null
  return Response.json(
    { error: 'Too Many Requests' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  )
}

export function clientIp (request: Request): string {
  const cf = request.headers.get('CF-Connecting-IP')
  if (cf) return cf
  const xff = request.headers.get('X-Forwarded-For')
  if (xff) return xff.split(',')[0].trim()
  return 'unknown'
}
