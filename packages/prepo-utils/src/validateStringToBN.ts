export const validateStringToBN = (input: string): boolean => {
  // empty string is treated as 0
  if (input === '') return true
  // valid strings can't have spaces
  if (input !== input.trim()) return false
  return !Number.isNaN(+input)
}
