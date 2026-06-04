export const toXML = (obj: any, space = null) => {
  // Determine if formatting is turned on
  const hasFormatting = space !== null && space !== undefined && space !== ''
  const newline = hasFormatting ? '\n' : ''

  // This internal helper function does the recursive heavy lifting
  const buildTree = (currentObj: any, currentIndent = '') => {
    let xml = ''

    let nextIndent = ''
    if (hasFormatting) {
      const indentStep = typeof space === 'number' ? ' '.repeat(space) : space
      nextIndent = currentIndent + indentStep
    }

    for (const key in currentObj) {
      if (key === '$' || key === '_') continue

      const value = currentObj[key]

      const buildElement = (node: any) => {
        let attrString = ''

        // 1. Handle Attributes ($)
        if (node && node.$) {
          attrString = Object.entries(node.$)
            .map(([attrKey, attrVal]) => ` ${attrKey}="${attrVal}"`)
            .join('')
        }

        // 2. Handle Text Content (_) or Nested Elements
        let childrenString = ''
        if (node && node._ !== undefined) {
          childrenString = node._
        } else if (typeof node === 'object' && node !== null) {
          childrenString = buildTree(node, nextIndent)
        }

        // 3. Assemble the tag
        if (!childrenString && (!node || node._ === undefined)) {
          return `${currentIndent}<${key}${attrString}/>${newline}`
        }

        if (hasFormatting && childrenString.includes('\n')) {
          return `${currentIndent}<${key}${attrString}>${newline}${childrenString}${currentIndent}</${key}>${newline}`
        }

        return `${currentIndent}<${key}${attrString}>${childrenString}</${key}>${newline}`
      }

      // 4. Handle Arrays vs Single Objects
      if (Array.isArray(value)) {
        value.forEach((item) => {
          xml += buildElement(item)
        })
      } else {
        xml += buildElement(value)
      }
    }

    return xml
  }

  // Compile the final string with the prolog appended to the top
  return `<?xml version="1.0"?>${newline}` + buildTree(obj)
}
