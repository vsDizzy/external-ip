export const parseXML = (xmlString: string) => {
  const cleanXML = xmlString
    .replace(/^<\?xml[^?>]*\?>/i, '') // Remove the XML Prolog
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
    .trim()

  // Tokenize the XML into tags and text pieces
  const tokenRegex = /(<\/?[a-zA-Z0-9:-]+[^>]*>|[^<]+)/g
  const tokens = cleanXML
    .match(tokenRegex)!
    .map((t) => t.trim())
    .filter(Boolean)

  const tagMatchRegex = /^<(\/)?([a-zA-Z0-9:-]+)([^>]*?)(\/?)>$/
  const attrRegex = /([a-zA-Z0-9:-]+)="([^"]*)"/g

  // The root container stack
  const stack: any[] = [{}]

  tokens.forEach((token) => {
    const match = token.match(tagMatchRegex)

    // Case 1: It's a text node component, assigned to "_"
    if (!match) {
      const current = stack[stack.length - 1]
      current._ = token
      return
    }

    const [_, isClosing, tagName, attrString, isSelfClosing] = match

    // Case 2: Closing tag
    if (isClosing) {
      stack.pop()
    }
    // Case 3: Opening tag
    else {
      const node: any = {}

      // Attributes assigned to "$"
      if (attrString.trim()) {
        node.$ = {}
        let attrMatch
        while ((attrMatch = attrRegex.exec(attrString)) !== null) {
          node.$[attrMatch[1]] = attrMatch[2]
        }
      }

      const parent = stack[stack.length - 1]

      // Directly assign the element name to the parent object
      if (parent[tagName]) {
        // If it already exists, turn it into an array (or push to it)
        if (!Array.isArray(parent[tagName])) {
          parent[tagName] = [parent[tagName]]
        }
        parent[tagName].push(node)
      } else {
        parent[tagName] = node
      }

      // Push to stack if it expects children/text
      if (!isSelfClosing) {
        stack.push(node)
      }
    }
  })

  return stack[0]
}
