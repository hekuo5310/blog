import { marked } from 'marked'

/** Locate real GFM task markers, excluding code, escaped text and ordinary brackets.
 * Temporary text markers preserve source offsets even in nested lists/quotes.
 */
export function todoTasks(body: string) {
  let prefix = 'BLOGTASKMARK'
  while (body.includes(prefix)) prefix += 'Q'
  const candidates: number[] = []
  const tagged = body.replace(/\[([ xX])\](?=[\t \r\n]|$)/g, (match, _state, offset: number) => {
    candidates.push(offset + 1)
    return match + ' ' + prefix + (candidates.length - 1) + 'END '
  })
  const found: number[] = []
  marked.walkTokens(marked.lexer(tagged), token => {
    if (token.type !== 'list_item' || !token.task) return
    const m = token.text.match(new RegExp('^' + prefix + '(\\d+)END '))
    if (m) found.push(candidates[Number(m[1])])
  })
  return found.sort((a,b) => a-b)
}

export function taskMarkup(body: string) {
  const offsets = todoTasks(body)
  let prefix = 'BLOGTASKCONTROL'
  while (body.includes(prefix)) prefix += 'Q'
  let tagged = body
  for (const offset of [...offsets].reverse()) {
    const end = offset + 2
    tagged = tagged.slice(0,end) + ' ' + prefix + offset + 'END ' + tagged.slice(end)
  }
  return { tagged, prefix, offsets }
}
