import axios from 'axios'

const RUNTIME = typeof window !== 'undefined' && window.__ENV__ ? window.__ENV__ : {}

const normalizeApiBaseUrl = (value, fallbackPath) => {
  const rawValue = value || ''
  if (!rawValue) return fallbackPath
  if (/^https?:\/\//i.test(rawValue) || rawValue.startsWith('//') || rawValue.startsWith('/')) {
    return rawValue
  }

  return `${window.location.protocol}//${rawValue}`
}

const AUTH_API = normalizeApiBaseUrl(RUNTIME.AUTH_API || import.meta.env.VITE_AUTH_API, 'http://localhost:5000')
const TRANSIT_API = normalizeApiBaseUrl(RUNTIME.TRANSIT_API || import.meta.env.VITE_TRANSIT_API, 'http://localhost:5001')
const ERROR_LOG_API = normalizeApiBaseUrl(RUNTIME.ERROR_LOG_API || import.meta.env.VITE_ERROR_LOG_API, 'http://localhost:5003')

const reportClientError = async ({ service, partOfService, error }) => {
  try {
    await fetch(`${ERROR_LOG_API}/error_log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service,
        partOfService,
        error: typeof error === 'string' ? error : JSON.stringify(error),
      }),
    })
  } catch (e) {
    // ignore logging failures
  }
}

export const authClient = axios.create({ baseURL: AUTH_API })

authClient.interceptors.response.use(
  response => response,
  error => {
    void reportClientError({
      service: 'admin_ui',
      partOfService: 'authClient',
      error: error?.response?.data?.error || error?.message || 'authClient_error',
    })
    return Promise.reject(error)
  }
)

export const transitClient = (token) => {
  const client = axios.create({
    baseURL: TRANSIT_API,
    headers: { Authorization: `Bearer ${token}` }
  })

  // Auto-logout on unauthorized responses to avoid delayed failures
  client.interceptors.response.use(
    response => response,
    error => {
      try {
        const status = error?.response?.status
        if (status === 401 || status === 403) {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          // reload to let App show the Login screen
          if (typeof window !== 'undefined') window.location.reload()
        }
        void reportClientError({
          service: 'admin_ui',
          partOfService: 'transitClient',
          error: error?.response?.data?.error || error?.message || 'transitClient_error',
        })
      } catch (e) {
        // ignore
      }
      return Promise.reject(error)
    }
  )

  return client
}

export const errorLogClient = (token) => axios.create({
  baseURL: ERROR_LOG_API,
  headers: token ? { Authorization: `Bearer ${token}` } : {},
})

export { reportClientError }
