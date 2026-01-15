const typeColors = {
  string: 'bg-green-100 text-green-800',
  list: 'bg-blue-100 text-blue-800',
  set: 'bg-purple-100 text-purple-800',
  zset: 'bg-orange-100 text-orange-800',
  hash: 'bg-pink-100 text-pink-800',
  none: 'bg-gray-100 text-gray-800'
}

export default function TypeBadge({ type }) {
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${typeColors[type] || typeColors.none}`}>
      {type}
    </span>
  )
}
