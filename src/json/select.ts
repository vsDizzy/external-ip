export function* select(root: any, query: any): Generator<any, void, unknown> {
  if (!root || typeof root !== 'object') {
    return
  }

  // 1. Handle arrays by iterating and delegating down
  if (Array.isArray(root)) {
    for (const item of root) {
      yield* select(item, query)
    }
    return
  }

  const [queryKey] = Object.keys(query)
  const rule = query[queryKey]

  // Helper to unpack XML text node wrappers (._) safely
  const getValue = (obj: any, key: string) => obj?.[key]?._ || obj?.[key]

  // 2. PHASE A: Check if current node is a match for the current key
  if (root[queryKey]) {
    const targetNode = root[queryKey]
    let isMatch = true

    for (const [attrKey, expected] of Object.entries(rule)) {
      if (attrKey === '..') {
        continue
      }

      const actualValue = getValue(targetNode, attrKey)
      const isAllowed = Array.isArray(expected) ? expected.includes(actualValue) : actualValue === expected

      if (!isAllowed) {
        isMatch = false
        break
      }
    }

    if (isMatch) {
      if (rule['..']) {
        // Chain down to the next nested structural rule
        yield* select(targetNode, rule['..'])
      } else {
        // Terminal leaf match reached! Stream the target XML block
        yield targetNode
      }
      return // Stop processing this specific subtree branch globally
    }
  }

  // 3. PHASE B: Global Deep Descent
  for (const key in root) {
    if (Object.prototype.hasOwnProperty.call(root, key) && typeof root[key] === 'object') {
      yield* select(root[key], query)
    }
  }
}
