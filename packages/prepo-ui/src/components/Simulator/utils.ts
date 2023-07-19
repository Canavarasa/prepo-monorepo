export const getPositionFromPayoutRange = (
  payoutRange: [number, number],
  price: number
): number => {
  const [floor, ceiling] = payoutRange
  const position = (price - floor) / (ceiling - floor)
  if (position < 0) return 0
  if (position > 1) return 1
  return position
}
