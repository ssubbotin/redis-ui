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

export async function setHashFields(key, fields) {
  return fetchJson(`${API_BASE}/hash/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ fields })
  })
}

export async function getInfo() {
  return fetchJson(`${API_BASE}/info`)
}

export async function getConfig() {
  return fetchJson(`${API_BASE}/config`)
}

// Stream-specific API
export async function getStreamGroups(key) {
  return fetchJson(`${API_BASE}/stream/${encodeURIComponent(key)}/groups`)
}

export async function getStreamConsumers(key, group) {
  return fetchJson(`${API_BASE}/stream/${encodeURIComponent(key)}/groups/${encodeURIComponent(group)}/consumers`)
}

export async function getStreamPending(key, group, count = 100) {
  return fetchJson(`${API_BASE}/stream/${encodeURIComponent(key)}/groups/${encodeURIComponent(group)}/pending?count=${count}`)
}

// Pub/Sub API
export async function getPubSubChannels(pattern = '*') {
  return fetchJson(`${API_BASE}/pubsub/channels?pattern=${encodeURIComponent(pattern)}`)
}

export function subscribeToPubSub(channel, onMessage, onError) {
  const eventSource = new EventSource(`${API_BASE}/pubsub/subscribe/${encodeURIComponent(channel)}`)

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch (err) {
      onError?.(err)
    }
  }

  eventSource.onerror = (err) => {
    onError?.(err)
  }

  return () => eventSource.close()
}

export async function publishToPubSub(channel, message) {
  return fetchJson(`${API_BASE}/pubsub/publish/${encodeURIComponent(channel)}`, {
    method: 'POST',
    body: JSON.stringify({ message })
  })
}
