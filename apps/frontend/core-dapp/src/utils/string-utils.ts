export function enumerate(...words: readonly string[]): string {
  if (words.length === 0) return ''
  if (words.length === 1) return words[0]
  if (words.length === 2) return words.join(' and ')

  const firstWords = words.slice(0, -1)
  const lastWord = words.at(-1)
  return `${firstWords.join(', ')} and ${lastWord}`
}
