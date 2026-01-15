import express from 'express'
import cors from 'cors'
import Redis from 'ioredis'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(cors())
app.use(express.json())

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
})

redis.on('error', (err) => console.error('Redis connection error:', err))
redis.on('connect', () => console.log('Connected to Redis'))

// Get keys matching pattern
app.get('/api/keys', async (req, res) => {
  try {
    const pattern = req.query.pattern || '*'
    const keys = await redis.keys(pattern)
    const keysWithTypes = await Promise.all(
      keys.slice(0, 1000).map(async (key) => ({
        key,
        type: await redis.type(key)
      }))
    )
    res.json(keysWithTypes)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get key value, type, and TTL
app.get('/api/key/:key(*)', async (req, res) => {
  try {
    const { key } = req.params
    const type = await redis.type(key)
    const ttl = await redis.ttl(key)

    let value
    let streamInfo = null
    switch (type) {
      case 'string':
        value = await redis.get(key)
        break
      case 'list':
        value = await redis.lrange(key, 0, -1)
        break
      case 'set':
        value = await redis.smembers(key)
        break
      case 'zset':
        value = await redis.zrange(key, 0, -1, 'WITHSCORES')
        break
      case 'hash':
        value = await redis.hgetall(key)
        break
      case 'stream':
        // Get stream info and recent messages
        const infoResult = await redis.xinfo('STREAM', key).catch(() => null)
        if (infoResult) {
          streamInfo = {}
          for (let i = 0; i < infoResult.length; i += 2) {
            streamInfo[infoResult[i]] = infoResult[i + 1]
          }
        }
        // Get last 100 messages
        value = await redis.xrange(key, '-', '+', 'COUNT', 100)
        break
      default:
        value = null
    }

    res.json({ key, type, ttl, value, streamInfo })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Set key value
app.put('/api/key/:key(*)', async (req, res) => {
  try {
    const { key } = req.params
    const { value, ttl } = req.body

    await redis.set(key, typeof value === 'string' ? value : JSON.stringify(value))
    if (ttl && ttl > 0) {
      await redis.expire(key, ttl)
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete key
app.delete('/api/key/:key(*)', async (req, res) => {
  try {
    const { key } = req.params
    await redis.del(key)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get stream consumer groups
app.get('/api/stream/:key(*)/groups', async (req, res) => {
  try {
    const { key } = req.params
    const groupsResult = await redis.xinfo('GROUPS', key).catch(() => [])

    const groups = groupsResult.map(group => {
      const obj = {}
      for (let i = 0; i < group.length; i += 2) {
        obj[group[i]] = group[i + 1]
      }
      return obj
    })

    res.json(groups)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get stream consumers for a group
app.get('/api/stream/:key(*)/groups/:group/consumers', async (req, res) => {
  try {
    const { key, group } = req.params
    const consumersResult = await redis.xinfo('CONSUMERS', key, group).catch(() => [])

    const consumers = consumersResult.map(consumer => {
      const obj = {}
      for (let i = 0; i < consumer.length; i += 2) {
        obj[consumer[i]] = consumer[i + 1]
      }
      return obj
    })

    res.json(consumers)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get pending messages for a group
app.get('/api/stream/:key(*)/groups/:group/pending', async (req, res) => {
  try {
    const { key, group } = req.params
    const count = parseInt(req.query.count) || 100

    // Get pending summary
    const pendingSummary = await redis.xpending(key, group).catch(() => null)

    // Get pending messages detail
    const pendingMessages = await redis.xpending(key, group, '-', '+', count).catch(() => [])

    const messages = pendingMessages.map(msg => ({
      id: msg[0],
      consumer: msg[1],
      idleTime: msg[2],
      deliveryCount: msg[3]
    }))

    res.json({
      summary: pendingSummary ? {
        count: pendingSummary[0],
        minId: pendingSummary[1],
        maxId: pendingSummary[2],
        consumers: pendingSummary[3]
      } : null,
      messages
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Pub/Sub: List active channels
app.get('/api/pubsub/channels', async (req, res) => {
  try {
    const pattern = req.query.pattern || '*'
    const channels = await redis.pubsub('CHANNELS', pattern)

    // Get subscriber counts for each channel
    const withCounts = await Promise.all(
      channels.map(async (channel) => {
        const result = await redis.pubsub('NUMSUB', channel)
        return { channel, subscribers: result[1] || 0 }
      })
    )

    res.json(withCounts)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Pub/Sub: Subscribe to channel (SSE)
app.get('/api/pubsub/subscribe/:channel(*)', async (req, res) => {
  const { channel } = req.params

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Create a new Redis connection for subscription
  const subscriber = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  })

  // Handle messages
  subscriber.on('message', (ch, message) => {
    res.write(`data: ${JSON.stringify({ channel: ch, message, timestamp: Date.now() })}\n\n`)
  })

  // Handle pattern messages
  subscriber.on('pmessage', (pattern, ch, message) => {
    res.write(`data: ${JSON.stringify({ pattern, channel: ch, message, timestamp: Date.now() })}\n\n`)
  })

  // Subscribe
  if (channel.includes('*')) {
    await subscriber.psubscribe(channel)
    res.write(`data: ${JSON.stringify({ type: 'subscribed', pattern: channel })}\n\n`)
  } else {
    await subscriber.subscribe(channel)
    res.write(`data: ${JSON.stringify({ type: 'subscribed', channel })}\n\n`)
  }

  // Clean up on disconnect
  req.on('close', () => {
    subscriber.disconnect()
  })
})

// Pub/Sub: Publish message
app.post('/api/pubsub/publish/:channel(*)', async (req, res) => {
  try {
    const { channel } = req.params
    const { message } = req.body

    const subscribers = await redis.publish(channel,
      typeof message === 'string' ? message : JSON.stringify(message)
    )

    res.json({ success: true, subscribers })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get Redis server info
app.get('/api/info', async (req, res) => {
  try {
    const info = await redis.info()
    const parsed = {}
    info.split('\n').forEach(line => {
      const [k, v] = line.split(':')
      if (k && v) parsed[k.trim()] = v.trim()
    })
    res.json(parsed)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')))
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'))
  })
}

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Redis UI server running on http://localhost:${PORT}`)
})
