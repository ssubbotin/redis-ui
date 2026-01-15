import TypeBadge from './TypeBadge'

export default function KeyList({ keys, selectedKey, onSelect, loading }) {
  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading keys...
      </div>
    )
  }

  if (keys.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No keys found
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-200">
      {keys.map(({ key, type }) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between gap-2 ${
            selectedKey === key ? 'bg-red-50' : ''
          }`}
        >
          <span className="truncate font-mono text-sm">{key}</span>
          <TypeBadge type={type} />
        </button>
      ))}
    </div>
  )
}
