# Redis UI

A modern, lean web UI for Redis.

## Features

- Browse and search Redis keys
- View values for all data types (string, list, set, sorted set, hash)
- Edit string values inline
- Delete keys
- Server info display (memory, clients, version)
- Auto-format JSON values

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **Backend**: Express.js, ioredis

## Quick Start

### Using Docker (recommended)

```bash
# Start with included Redis
docker-compose up -d

# Open http://localhost:3000
```

### Connect to external Redis

```bash
docker run -p 3000:3000 \
  -e REDIS_HOST=your-redis-host \
  -e REDIS_PORT=6379 \
  redis-ui
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
