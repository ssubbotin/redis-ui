import { useState, useEffect, useRef } from 'react'
import { getPubSubChannels, subscribeToPubSub, publishToPubSub } from '../api/redis'

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
  const unsubscribeRef = useRef(null)
  const messagesEndRef = useRef(null)

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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
              <div className="flex-1 overflow-auto">
                {messages.length > 0 ? (
                  <div>
                    {messages.map((msg, i) => (
                      <MessageItem key={i} data={msg} />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    Waiting for messages...
                  </div>
                )}
              </div>
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
                {messages.length} messages received
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
