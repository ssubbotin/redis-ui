import { useState, useEffect, useCallback } from 'react'
import { getKeys, getKey, setKey, setHashFields, deleteKey, getInfo } from './api/redis'
import SearchBar from './components/SearchBar'
import KeyList from './components/KeyList'
import KeyValue from './components/KeyValue'
import ServerInfo from './components/ServerInfo'
import PubSubView from './components/PubSubView'

export default function App() {
  const [activeTab, setActiveTab] = useState('keys')
  const [keys, setKeys] = useState([])
  const [selectedKey, setSelectedKey] = useState(null)
  const [keyData, setKeyData] = useState(null)
  const [serverInfo, setServerInfo] = useState(null)
  const [loading, setLoading] = useState({ keys: false, value: false, info: false })
  const [error, setError] = useState(null)

  const loadKeys = useCallback(async (pattern = '*') => {
    setLoading(prev => ({ ...prev, keys: true }))
    setError(null)
    try {
      const data = await getKeys(pattern)
      setKeys(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(prev => ({ ...prev, keys: false }))
    }
  }, [])

  const loadKeyValue = useCallback(async (key) => {
    setSelectedKey(key)
    setLoading(prev => ({ ...prev, value: true }))
    try {
      const data = await getKey(key)
      setKeyData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(prev => ({ ...prev, value: false }))
    }
  }, [])

  const loadServerInfo = useCallback(async () => {
    setLoading(prev => ({ ...prev, info: true }))
    try {
      const data = await getInfo()
      setServerInfo(data)
    } catch (err) {
      console.error('Failed to load server info:', err)
    } finally {
      setLoading(prev => ({ ...prev, info: false }))
    }
  }, [])

  const handleSave = async (key, value) => {
    try {
      await setKey(key, value)
      await loadKeyValue(key)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSaveHash = async (key, fields) => {
    try {
      await setHashFields(key, fields)
      await loadKeyValue(key)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (key) => {
    if (!confirm(`Delete key "${key}"?`)) return
    try {
      await deleteKey(key)
      setSelectedKey(null)
      setKeyData(null)
      await loadKeys()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleRefresh = () => {
    loadKeys()
    loadServerInfo()
    if (selectedKey) {
      loadKeyValue(selectedKey)
    }
  }

  useEffect(() => {
    loadKeys()
    loadServerInfo()
  }, [loadKeys, loadServerInfo])

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-red-600">Redis UI</h1>
            <nav className="flex gap-1">
              <button
                onClick={() => setActiveTab('keys')}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  activeTab === 'keys'
                    ? 'bg-red-100 text-red-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Keys
              </button>
              <button
                onClick={() => setActiveTab('pubsub')}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  activeTab === 'pubsub'
                    ? 'bg-red-100 text-red-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Pub/Sub
              </button>
            </nav>
            <ServerInfo info={serverInfo} loading={loading.info} />
          </div>
          {activeTab === 'keys' && (
            <button
              onClick={handleRefresh}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Refresh
            </button>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            Dismiss
          </button>
        </div>
      )}

      {/* Main content */}
      {activeTab === 'keys' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <aside className="w-80 border-r border-gray-200 flex flex-col bg-white">
            <div className="p-4 border-b border-gray-200">
              <SearchBar onSearch={loadKeys} loading={loading.keys} />
            </div>
            <div className="flex-1 overflow-auto">
              <KeyList
                keys={keys}
                selectedKey={selectedKey}
                onSelect={loadKeyValue}
                loading={loading.keys}
              />
            </div>
            <div className="p-3 border-t border-gray-200 text-sm text-gray-500 text-center">
              {keys.length} keys
            </div>
          </aside>

          {/* Main panel */}
          <main className="flex-1 bg-white">
            <KeyValue
              data={keyData}
              onSave={handleSave}
              onSaveHash={handleSaveHash}
              onDelete={handleDelete}
              loading={loading.value}
            />
          </main>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden bg-white">
          <PubSubView />
        </div>
      )}
    </div>
  )
}
