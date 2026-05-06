import axios from 'axios'

const RUNTIME = typeof window !== 'undefined' && window.__ENV__ ? window.__ENV__ : {}
const AUTH_API = RUNTIME.VITE_AUTH_API || import.meta.env.VITE_AUTH_API || 'http://localhost:5000'
const TRANSIT_API = RUNTIME.VITE_TRANSIT_API || import.meta.env.VITE_TRANSIT_API || 'http://localhost:5001'

export const authClient = axios.create({ baseURL: AUTH_API })
export const transitClient = (token) => axios.create({
  baseURL: TRANSIT_API,
  headers: { Authorization: `Bearer ${token}` }
})
