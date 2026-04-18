import { useAuthStore } from '@/store/auth'

export class ApiError extends Error {
  status: number
  body?: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  auth?: boolean
  skipRefresh?: boolean
}

let refreshPromise: Promise<string | null> | null = null

async function rawRequest<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { body, auth = true, skipRefresh, headers, ...rest } = opts
  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  }
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json'
  if (auth) {
    const token = useAuthStore.getState().accessToken
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(path, {
    ...rest,
    credentials: 'include',
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return undefined as T

  const text = await res.text()
  const data = text ? safeJson(text) : undefined

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'message' in data
        ? Array.isArray((data as { message: unknown }).message)
          ? ((data as { message: string[] }).message).join(', ')
          : String((data as { message: unknown }).message)
        : res.statusText) || 'Request failed'
    throw new ApiError(res.status, message, data)
  }

  return data as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, opts)
  } catch (err) {
    if (
      err instanceof ApiError &&
      err.status === 401 &&
      !opts.skipRefresh &&
      opts.auth !== false
    ) {
      const newToken = await tryRefresh()
      if (newToken) {
        return await rawRequest<T>(path, { ...opts, skipRefresh: true })
      }
    }
    throw err
  }
}

async function tryRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await rawRequest<{ accessToken: string }>('/api/auth/refresh', {
          method: 'POST',
          auth: false,
          skipRefresh: true,
        })
        useAuthStore.getState().setAccessToken(res.accessToken)
        return res.accessToken
      } catch {
        useAuthStore.getState().clear()
        return null
      } finally {
        refreshPromise = null
      }
    })()
  }
  return refreshPromise
}
