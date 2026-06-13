import type { ApiError } from '../types/api.js'

const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '/api'

function getToken(): string | null {
  return localStorage.getItem('radar:token')
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as Record<string, unknown>

    if (response.status === 401) {
      // Dispara evento global — AuthContext escuta e faz logout + redirect
      window.dispatchEvent(new CustomEvent('auth:expirado'))
    }

    const error: ApiError = {
      status: response.status,
      erro: (body['erro'] as string | undefined) ?? 'ERRO_INTERNO',
      mensagem: (body['mensagem'] as string | undefined) ?? 'Erro inesperado.',
    }
    throw error
  }

  // 204 No Content — sem body
  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const client = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
