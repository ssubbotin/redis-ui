import { useState, useEffect } from 'react'
import { getStreamGroups, getStreamConsumers, getStreamPending } from '../api/redis'

function formatTimestamp(id) {
  const ts = parseInt(id.split('-')[0])
  if (isNaN(ts)) return id
  return new Date(ts).toLocaleString()
}

function formatIdleTime(ms) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
  return `${(ms / 3600000).toFixed(1)}h`
}

function MessageEntry({ id, fields }) {
  const [expanded, setExpanded] = useState(false)
  const fieldPairs = []
  for (let i = 0; i < fields.length; i += 2) {
    fieldPairs.push({ key: fields[i], value: fields[i + 1] })
  }

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
      >
        <span className="font-mono text-xs text-gray-600">{id}</span>
        <span className="text-xs text-gray-400">{formatTimestamp(id)}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 bg-gray-50">
          <table className="w-full text-sm">
            <tbody>
              {fieldPairs.map(({ key, value }) => (
                <tr key={key}>
                  <td className="py-1 pr-4 font-medium text-gray-600 w-1/4">{key}</td>
                  <td className="py-1 font-mono text-gray-800 break-all">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ConsumerGroupCard({ streamKey, group, onSelect, isSelected }) {
  const [consumers, setConsumers] = useState([])
  const [pending, setPending] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isSelected) {
      setLoading(true)
      Promise.all([
        getStreamConsumers(streamKey, group.name),
        getStreamPending(streamKey, group.name)
      ])
        .then(([c, p]) => {
          setConsumers(c)
          setPending(p)
        })
        .finally(() => setLoading(false))
    }
  }, [streamKey, group.name, isSelected])

  return (
    <div className={`border rounded-lg ${isSelected ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
      <button
        onClick={() => onSelect(isSelected ? null : group.name)}
        className="w-full p-3 text-left"
      >
        <div className="flex items-center justify-between">
          <span className="font-medium">{group.name}</span>
          <span className={`px-2 py-0.5 text-xs rounded ${group.pending > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
            {group.pending} pending
          </span>
        </div>
        <div className="mt-1 text-xs text-gray-500 flex gap-4">
          <span>Consumers: {group.consumers}</span>
          <span>Last ID: {group['last-delivered-id']}</span>
        </div>
      </button>

      {isSelected && (
        <div className="border-t border-gray-200 p-3">
          {loading ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : (
            <>
              {/* Consumers */}
              {consumers.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-medium text-gray-500 mb-2">CONSUMERS</h4>
                  <div className="space-y-1">
                    {consumers.map(consumer => (
                      <div key={consumer.name} className="flex items-center justify-between text-sm bg-white p-2 rounded">
                        <span className="font-mono">{consumer.name}</span>
                        <div className="flex gap-3 text-xs text-gray-500">
                          <span>{consumer.pending} pending</span>
                          <span>idle: {formatIdleTime(consumer.idle)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Messages */}
              {pending?.messages?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-2">PENDING MESSAGES</h4>
                  <div className="bg-white rounded overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-2 py-1 text-left">ID</th>
                          <th className="px-2 py-1 text-left">Consumer</th>
                          <th className="px-2 py-1 text-right">Idle</th>
                          <th className="px-2 py-1 text-right">Retries</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pending.messages.map(msg => (
                          <tr key={msg.id} className="border-t border-gray-100">
                            <td className="px-2 py-1 font-mono">{msg.id}</td>
                            <td className="px-2 py-1">{msg.consumer}</td>
                            <td className="px-2 py-1 text-right">{formatIdleTime(msg.idleTime)}</td>
                            <td className="px-2 py-1 text-right">{msg.deliveryCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {pending?.messages?.length === 0 && consumers.length === 0 && (
                <div className="text-sm text-gray-500">No consumers or pending messages</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function StreamView({ data }) {
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('messages')

  useEffect(() => {
    if (data?.type === 'stream') {
      setLoading(true)
      getStreamGroups(data.key)
        .then(setGroups)
        .catch(() => setGroups([]))
        .finally(() => setLoading(false))
    }
  }, [data?.key, data?.type])

  if (!data || data.type !== 'stream') return null

  const { streamInfo, value: messages } = data

  return (
    <div className="h-full flex flex-col">
      {/* Stream Info Header */}
      {streamInfo && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex gap-6 text-sm">
          <div>
            <span className="text-gray-500">Length:</span>{' '}
            <span className="font-medium">{streamInfo.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Groups:</span>{' '}
            <span className="font-medium">{streamInfo.groups}</span>
          </div>
          <div>
            <span className="text-gray-500">First:</span>{' '}
            <span className="font-mono text-xs">{streamInfo['first-entry']?.[0] || '-'}</span>
          </div>
          <div>
            <span className="text-gray-500">Last:</span>{' '}
            <span className="font-mono text-xs">{streamInfo['last-entry']?.[0] || '-'}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 px-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('messages')}
            className={`py-2 px-1 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'messages'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Messages ({messages?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`py-2 px-1 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'groups'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Consumer Groups ({groups.length})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'messages' && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {messages?.length > 0 ? (
              messages.map(([id, fields]) => (
                <MessageEntry key={id} id={id} fields={fields} />
              ))
            ) : (
              <div className="p-4 text-center text-gray-500">No messages in stream</div>
            )}
          </div>
        )}

        {activeTab === 'groups' && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-gray-500">Loading consumer groups...</div>
            ) : groups.length > 0 ? (
              groups.map(group => (
                <ConsumerGroupCard
                  key={group.name}
                  streamKey={data.key}
                  group={group}
                  isSelected={selectedGroup === group.name}
                  onSelect={setSelectedGroup}
                />
              ))
            ) : (
              <div className="text-gray-500">No consumer groups</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
