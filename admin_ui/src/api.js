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

export const authClient = axios.create({ baseURL: AUTH_API })

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
      } catch (e) {
        // ignore
      }
      return Promise.reject(error)
    }
  )

  return client
}
