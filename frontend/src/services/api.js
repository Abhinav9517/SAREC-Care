import axios from 'axios'

import { getToken } from '../utils/auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : ''),
  headers: { 'Content-Type': 'application/json' },
  timeout: 120000,
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token && !config.skipAuth) config.headers.Authorization = `Bearer ${token}`
  delete config.skipAuth
  return config
})

export const getErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  const response = error?.response?.data
  if (response?.details?.length) return response.details.map((detail) => detail.message).join(' ')
  return response?.message || error?.message || fallback
}

export default api
