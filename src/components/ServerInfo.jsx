export default function ServerInfo({ info, loading }) {
  if (loading || !info) {
    return null
  }

  const formatBytes = (bytes) => {
    const num = parseInt(bytes)
    if (isNaN(num)) return bytes
    if (num < 1024) return `${num} B`
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`
    if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`
    return `${(num / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  return (
    <div className="flex items-center gap-4 text-sm text-gray-600">
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
        Redis {info.redis_version}
      </span>
      <span>Memory: {formatBytes(info.used_memory)}</span>
      <span>Clients: {info.connected_clients}</span>
      <span>Keys: {info.db0?.split(',')[0]?.split('=')[1] || '0'}</span>
    </div>
  )
}
