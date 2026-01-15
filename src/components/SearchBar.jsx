import { useState } from 'react'

export default function SearchBar({ onSearch, loading }) {
  const [pattern, setPattern] = useState('*')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSearch(pattern || '*')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={pattern}
        onChange={(e) => setPattern(e.target.value)}
        placeholder="Pattern (e.g., user:*)"
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
      />
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Loading...' : 'Search'}
      </button>
    </form>
  )
}
