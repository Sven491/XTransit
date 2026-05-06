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
export const transitClient = (token) => axios.create({
  baseURL: TRANSIT_API,
  headers: { Authorization: `Bearer ${token}` }
})
