// JSON syntax highlighter component
export default function JsonHighlight({ data }) {
  const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2)

  // Tokenize and colorize JSON
  const colorize = (str) => {
    return str.split('\n').map((line, i) => {
      // Process each line
      const parts = []
      let remaining = line
      let key = 0

      // Match patterns in order
      const patterns = [
        { regex: /^\s+/, className: '' }, // leading whitespace
        { regex: /^"([^"\\]|\\.)*"(?=\s*:)/, className: 'text-purple-600' }, // keys
        { regex: /^:\s*/, className: 'text-gray-600' }, // colon
        { regex: /^"([^"\\]|\\.)*"/, className: 'text-green-600' }, // string values
        { regex: /^(true|false)/, className: 'text-orange-600' }, // booleans
        { regex: /^null/, className: 'text-gray-400' }, // null
        { regex: /^-?\d+\.?\d*([eE][+-]?\d+)?/, className: 'text-blue-600' }, // numbers
        { regex: /^[{}\[\],]/, className: 'text-gray-500' }, // brackets and commas
      ]

      while (remaining.length > 0) {
        let matched = false
        for (const { regex, className } of patterns) {
          const match = remaining.match(regex)
          if (match && match[0].length > 0) {
            parts.push(
              <span key={key++} className={className}>
                {match[0]}
              </span>
            )
            remaining = remaining.slice(match[0].length)
            matched = true
            break
          }
        }
        if (!matched) {
          // No pattern matched, take one character
          parts.push(<span key={key++}>{remaining[0]}</span>)
          remaining = remaining.slice(1)
        }
      }

      return (
        <div key={i}>
          {parts}
        </div>
      )
    })
  }

  return <>{colorize(json)}</>
}
