import { useState, useEffect, useRef } from 'react'
import { getPubSubChannels, subscribeToPubSub, publishToPubSub, getConfig } from '../api/redis'

// Helper to get value at a dot-separated path (e.g., "payload.object")
function getValueAtPath(obj, path) {
  if (!path || !obj) return null
  const parts = path.split('.')
  let current = obj
  for (const part of parts) {
    if (current === null || current === undefined) return null
    current = current[part]
  }
  return current
}

function formatTimestamp(ts) {
  return new Date(ts).toLocaleTimeString()
}

function MessageItem({ data }) {
  const [expanded, setExpanded] = useState(false)

  let displayMessage = data.message
  let isJson = false
  try {
    const parsed = JSON.parse(data.message)
    displayMessage = JSON.stringify(parsed, null, 2)
    isJson = true
  } catch {
    // not JSON
  }

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div
        className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
        onClick={() => isJson && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs text-gray-400 shrink-0">{formatTimestamp(data.timestamp)}</span>
          <span className="px-2 py-0.5 text-xs bg-cyan-100 text-cyan-800 rounded shrink-0">
            {data.channel}
          </span>
          {!expanded && (
            <span className="text-sm text-gray-700 truncate">
              {isJson ? data.message.slice(0, 100) + (data.message.length > 100 ? '...' : '') : data.message}
            </span>
          )}
        </div>
        {isJson && (
          <span className="text-xs text-gray-400">{expanded ? '▼' : '▶'}</span>
        )}
      </div>
      {expanded && (
        <pre className="px-3 pb-2 text-xs font-mono bg-gray-50 whitespace-pre-wrap overflow-x-auto">
          {displayMessage}
        </pre>
      )}
    </div>
  )
}

export default function PubSubView() {
  const [channels, setChannels] = useState([])
  const [subscribeChannel, setSubscribeChannel] = useState('')
  const [activeSubscription, setActiveSubscription] = useState(null)
  const [messages, setMessages] = useState([])
  const [publishChannel, setPublishChannel] = useState('')
  const [publishMessage, setPublishMessage] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState(null)
  const [paused, setPaused] = useState(false)
  const [newMessageCount, setNewMessageCount] = useState(0)
  const [groupByPath, setGroupByPath] = useState('')
  const [activeGroup, setActiveGroup] = useState(null) // null means "All"
  const unsubscribeRef = useRef(null)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const isNearBottomRef = useRef(true)

  // Load config
  useEffect(() => {
    getConfig().then(config => {
      setGroupByPath(config.pubsubGroupByPath || '')
    }).catch(err => {
      console.error('Failed to load config:', err)
    })
  }, [])

  // Load active channels
  const loadChannels = async () => {
    try {
      const data = await getPubSubChannels()
      setChannels(data)
    } catch (err) {
      console.error('Failed to load channels:', err)
    }
  }

  useEffect(() => {
    loadChannels()
    const interval = setInterval(loadChannels, 5000)
    return () => clearInterval(interval)
  }, [])

  // Check if scrolled near bottom
  const checkIfNearBottom = () => {
    const container = messagesContainerRef.current
    if (!container) return true
    const threshold = 100
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold
  }

  // Handle scroll - pause when user scrolls up
  const handleScroll = () => {
    const nearBottom = checkIfNearBottom()
    isNearBottomRef.current = nearBottom

    if (!nearBottom && !paused) {
      setPaused(true)
      setNewMessageCount(0)
    } else if (nearBottom && paused) {
      setPaused(false)
      setNewMessageCount(0)
    }
  }

  // Auto-scroll to bottom when not paused
  useEffect(() => {
    if (!paused && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    } else if (paused) {
      setNewMessageCount(prev => prev + 1)
    }
  }, [messages.length])

  // Resume and scroll to bottom
  const handleResume = () => {
    setPaused(false)
    setNewMessageCount(0)
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Clean up subscription on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [])

  const handleSubscribe = (channel) => {
    if (!channel) return

    // Unsubscribe from previous
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
    }

    setMessages([])
    setActiveSubscription(channel)
    setError(null)
    setPaused(false)
    setNewMessageCount(0)

    const unsubscribe = subscribeToPubSub(
      channel,
      (data) => {
        if (data.type === 'subscribed') {
          // Subscription confirmed
          return
        }
        setMessages(prev => [...prev.slice(-999), data]) // Keep last 1000 messages
      },
      (err) => {
        setError('Connection error')
        console.error('Subscription error:', err)
      }
    )

    unsubscribeRef.current = unsubscribe
  }

  const handleUnsubscribe = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    setActiveSubscription(null)
  }

  const handlePublish = async (e) => {
    e.preventDefault()
    if (!publishChannel || !publishMessage) return

    setPublishing(true)
    try {
      const result = await publishToPubSub(publishChannel, publishMessage)
      setPublishMessage('')
      // Refresh channels list
      loadChannels()
    } catch (err) {
      setError(err.message)
    } finally {
      setPublishing(false)
    }
  }

  // Compute groups and filtered messages
  const messagesWithGroups = groupByPath
    ? messages.map(msg => {
        try {
          const parsed = JSON.parse(msg.message)
          const group = getValueAtPath(parsed, groupByPath)
          return { ...msg, group: group != null ? String(group) : '_unknown' }
        } catch {
          return { ...msg, group: '_unknown' }
        }
      })
    : messages.map(msg => ({ ...msg, group: null }))

  const groups = groupByPath
    ? [...new Set(messagesWithGroups.map(m => m.group))].sort()
    : []

  const filteredMessages = activeGroup === null
    ? messagesWithGroups
    : messagesWithGroups.filter(m => m.group === activeGroup)

  // Reset active group when subscription changes
  useEffect(() => {
    setActiveGroup(null)
  }, [activeSubscription])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-medium">Pub/Sub</h2>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Channels & Publish */}
        <div className="w-72 border-r border-gray-200 flex flex-col">
          {/* Subscribe */}
          <div className="p-3 border-b border-gray-200">
            <label className="text-xs font-medium text-gray-500 block mb-2">SUBSCRIBE</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={subscribeChannel}
                onChange={(e) => setSubscribeChannel(e.target.value)}
                placeholder="channel or pattern*"
                className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <button
                onClick={() => handleSubscribe(subscribeChannel)}
                disabled={!subscribeChannel}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Go
              </button>
            </div>
          </div>

          {/* Active Channels */}
          <div className="flex-1 overflow-auto">
            <div className="p-3">
              <label className="text-xs font-medium text-gray-500 block mb-2">
                ACTIVE CHANNELS ({channels.length})
              </label>
              {channels.length > 0 ? (
                <div className="space-y-1">
                  {channels.map(({ channel, subscribers }) => (
                    <button
                      key={channel}
                      onClick={() => {
                        setSubscribeChannel(channel)
                        handleSubscribe(channel)
                      }}
                      className={`w-full px-2 py-1.5 text-left text-sm rounded flex items-center justify-between ${
                        activeSubscription === channel
                          ? 'bg-red-100 text-red-800'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <span className="truncate font-mono">{channel}</span>
                      <span className="text-xs text-gray-500">{subscribers}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No active channels</div>
              )}
            </div>
          </div>

          {/* Publish */}
          <div className="p-3 border-t border-gray-200">
            <label className="text-xs font-medium text-gray-500 block mb-2">PUBLISH</label>
            <form onSubmit={handlePublish} className="space-y-2">
              <input
                type="text"
                value={publishChannel}
                onChange={(e) => setPublishChannel(e.target.value)}
                placeholder="Channel"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <textarea
                value={publishMessage}
                onChange={(e) => setPublishMessage(e.target.value)}
                placeholder="Message (text or JSON)"
                rows={3}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 resize-none font-mono"
              />
              <button
                type="submit"
                disabled={!publishChannel || !publishMessage || publishing}
                className="w-full px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </form>
          </div>
        </div>

        {/* Right: Messages */}
        <div className="flex-1 flex flex-col">
          {activeSubscription ? (
            <>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-sm font-medium">Subscribed to:</span>
                  <code className="text-sm bg-gray-200 px-2 py-0.5 rounded">{activeSubscription}</code>
                </div>
                <button
                  onClick={handleUnsubscribe}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Unsubscribe
                </button>
              </div>
              {/* Group tabs */}
              {groupByPath && groups.length > 0 && (
                <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-2 overflow-x-auto">
                  <span className="text-xs text-gray-500 shrink-0">Groups:</span>
                  <button
                    onClick={() => setActiveGroup(null)}
                    className={`px-2 py-1 text-xs rounded shrink-0 ${
                      activeGroup === null
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All ({messages.length})
                  </button>
                  {groups.map(group => {
                    const count = messagesWithGroups.filter(m => m.group === group).length
                    return (
                      <button
                        key={group}
                        onClick={() => setActiveGroup(group)}
                        className={`px-2 py-1 text-xs rounded shrink-0 ${
                          activeGroup === group
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {group === '_unknown' ? '(unknown)' : group} ({count})
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="flex-1 overflow-auto relative" ref={messagesContainerRef} onScroll={handleScroll}>
                {filteredMessages.length > 0 ? (
                  <div>
                    {filteredMessages.map((msg, i) => (
                      <MessageItem key={i} data={msg} />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    {messages.length > 0 ? 'No messages in this group' : 'Waiting for messages...'}
                  </div>
                )}
                {/* New messages indicator */}
                {paused && newMessageCount > 0 && (
                  <button
                    onClick={handleResume}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-600 text-white text-sm rounded-full shadow-lg hover:bg-red-700 flex items-center gap-2"
                  >
                    <span>{newMessageCount} new message{newMessageCount > 1 ? 's' : ''}</span>
                    <span>↓</span>
                  </button>
                )}
              </div>
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
                <span>
                  {activeGroup !== null
                    ? `${filteredMessages.length} of ${messages.length} messages`
                    : `${messages.length} messages received`}
                </span>
                {paused && (
                  <span className="text-yellow-600 flex items-center gap-1">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                    Paused - scroll down to resume
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Subscribe to a channel to see messages
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
