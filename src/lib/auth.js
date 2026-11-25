import { api } from './api.js'

// Credentials are checked by the server. USERS is only used for the demo quick-fill buttons.
export { USERS } from '../../server/users.js'

const KEY = 'mis.session.v1'

export async function login(username, password) {
  const { token, user } = await api.login(username, password)
  const session = { ...user, token }
  try { localStorage.setItem(KEY, JSON.stringify(session)) } catch { /* ignore */ }
  return session
}

export function getSession() {
  try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null }
}

export function logout() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

export const can = (session, action) => action === 'upload' ? session?.role === 'admin' : !!session
