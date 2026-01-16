# Redis UI

A modern, lean web UI for Redis.

## Features

### Keys Browser
- Browse and search Redis keys
- View values for all data types (string, list, set, sorted set, hash, stream)
- Edit string values inline
- Delete keys
- Auto-format JSON values in hashes

### Redis Streams
- View stream messages with expandable details
- Consumer groups with pending message counts
- Consumers list with idle time
- Pending messages table

### Pub/Sub
- Subscribe to channels (supports patterns with `*`)
- Real-time message display via SSE
- Auto-pause when scrolling to examine messages
- "New messages" indicator when paused
- Publish messages to any channel
- Group messages by JSON path (optional)

### General
- Server info display (memory, clients, version)
- Responsive UI with tabs for Keys and Pub/Sub

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **Backend**: Express.js, ioredis

## Quick Start

### Using Docker Hub (recommended)

```bash
docker run -p 3000:3000 \
  -e REDIS_HOST=your-redis-host \
  -e REDIS_PORT=6379 \
  ssubbotin/redis-ui
```

Open http://localhost:3000

### Using Docker Compose

```yaml
services:
  redis-ui:
    image: ssubbotin/redis-ui:latest
    ports:
      - "3000:3000"
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
```

### Local Development

```bash
# Install dependencies
npm install

# Start dev server (frontend + proxy)
npm run dev

# Open http://localhost:5173
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis server hostname |
| `REDIS_PORT` | `6379` | Redis server port |
| `PORT` | `3000` | Server port (production) |
| `PUBSUB_GROUP_BY_PATH` | - | JSON path to group Pub/Sub messages (e.g., `payload.object`) |

### Pub/Sub Message Grouping

When `PUBSUB_GROUP_BY_PATH` is set, messages are grouped into virtual queues based on the value at that JSON path.

Example with `PUBSUB_GROUP_BY_PATH=payload.object`:

```json
{"payload": {"object": "wsr", "data": "..."}, "type": "status"}
{"payload": {"object": "radar", "data": "..."}, "type": "status"}
```

These messages will appear in separate tabs: `wsr` and `radar`.

## Project Structure

```
redis-ui/
├── src/                  # React frontend
│   ├── components/       # UI components
│   └── api/              # API client
├── server/
│   └── proxy.js          # Express proxy (~100 lines)
├── Dockerfile
└── docker-compose.yml
```

## License

MIT
