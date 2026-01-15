const API_BASE = '/api'

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error || 'Request failed')
  }
  return res.json()
}

export async function getKeys(pattern = '*') {
  return fetchJson(`${API_BASE}/keys?pattern=${encodeURIComponent(pattern)}`)
}

export async function getKey(key) {
  return fetchJson(`${API_BASE}/key/${encodeURIComponent(key)}`)
}

export async function setKey(key, value, ttl = null) {
  return fetchJson(`${API_BASE}/key/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value, ttl })
  })
}

export async function deleteKey(key) {
  return fetchJson(`${API_BASE}/key/${encodeURIComponent(key)}`, {
    method: 'DELETE'
  })
}

export async function getInfo() {
  return fetchJson(`${API_BASE}/info`)
}
