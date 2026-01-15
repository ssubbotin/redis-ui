# Redis UI

A modern, lean web UI for Redis.

## Features

- Browse and search Redis keys
- View values for all data types (string, list, set, sorted set, hash, stream)
- Redis Streams support with consumer groups, consumers, and pending messages
- Edit string values inline
- Delete keys
- Server info display (memory, clients, version)
- Auto-format JSON values

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
