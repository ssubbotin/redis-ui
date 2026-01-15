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
      default:
        value = null
    }

    res.json({ key, type, ttl, value })
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
