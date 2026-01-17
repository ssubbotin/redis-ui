import { useState, useEffect } from 'react'
import TypeBadge from './TypeBadge'
import StreamView from './StreamView'
import JsonHighlight from './JsonHighlight'

function tryParseJson(str) {
  if (typeof str !== 'string') return str
  try {
    return JSON.parse(str)
  } catch {
    return str
  }
}

// Decode hash from Redis format (values are JSON strings) to display format
function decodeHash(value) {
  const decoded = {}
  for (const [k, v] of Object.entries(value)) {
    decoded[k] = tryParseJson(v)
  }
  return decoded
}

// Encode hash from display format back to Redis format (stringify non-string values)
function encodeHash(decoded) {
  const encoded = {}
  for (const [k, v] of Object.entries(decoded)) {
    encoded[k] = typeof v === 'string' ? v : JSON.stringify(v)
  }
  return encoded
}

function formatValue(value, type) {
  if (value === null || value === undefined) return 'null'

  if (type === 'string') {
    try {
      const parsed = JSON.parse(value)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return value
    }
  }

  if (type === 'hash') {
    return JSON.stringify(decodeHash(value), null, 2)
  }

  if (type === 'zset') {
    const pairs = []
    for (let i = 0; i < value.length; i += 2) {
      pairs.push({ member: value[i], score: value[i + 1] })
    }
    return JSON.stringify(pairs, null, 2)
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value, null, 2)
  }

  return String(value)
}

export default function KeyValue({ data, onSave, onSaveHash, onDelete, loading }) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [parseError, setParseError] = useState(null)

  useEffect(() => {
    if (data) {
      setEditValue(formatValue(data.value, data.type))
      setEditing(false)
      setParseError(null)
    }
  }, [data])

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Select a key to view its value
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading...
      </div>
    )
  }

  const handleSave = () => {
    setParseError(null)

    if (data.type === 'hash') {
      try {
        const parsed = JSON.parse(editValue)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setParseError('Hash value must be a JSON object')
          return
        }
        const encoded = encodeHash(parsed)
        onSaveHash(data.key, encoded)
        setEditing(false)
      } catch (err) {
        setParseError('Invalid JSON: ' + err.message)
      }
    } else {
      onSave(data.key, editValue)
      setEditing(false)
    }
  }

  const isEditable = data.type === 'string' || data.type === 'hash'
  const isJsonDisplay = data.type === 'hash' || (data.type === 'string' && (() => {
    try { JSON.parse(data.value); return true } catch { return false }
  })())

  // Render StreamView for stream type
  if (data.type === 'stream') {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-lg font-medium truncate max-w-md">{data.key}</h2>
            <TypeBadge type={data.type} />
          </div>
          <button
            onClick={() => onDelete(data.key)}
            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <StreamView data={data} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-mono text-lg font-medium truncate max-w-md">{data.key}</h2>
          <TypeBadge type={data.type} />
          {data.ttl > 0 && (
            <span className="text-sm text-gray-500">
              TTL: {data.ttl}s
            </span>
          )}
          {data.ttl === -1 && (
            <span className="text-sm text-gray-500">
              No expiry
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {isEditable && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Edit
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditValue(formatValue(data.value, data.type))
                  setEditing(false)
                  setParseError(null)
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </>
          )}
          <button
            onClick={() => onDelete(data.key)}
            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
      {parseError && (
        <div className="mx-4 mb-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {parseError}
        </div>
      )}
      <div className="flex-1 p-4 overflow-auto">
        {editing ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full h-full font-mono text-sm p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          />
        ) : (
          <pre className="font-mono text-sm bg-gray-50 p-4 rounded-lg overflow-auto">
            {isJsonDisplay ? (
              <JsonHighlight data={formatValue(data.value, data.type)} />
            ) : (
              formatValue(data.value, data.type)
            )}
          </pre>
        )}
      </div>
    </div>
  )
}
