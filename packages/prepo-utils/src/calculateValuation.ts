type Range = [number, number]

type CalculateValuationProps = {
  longTokenPrice: number
  payoutRange: Range
  valuationRange: Range
}

export const calculateValuation = ({
  longTokenPrice,
  payoutRange,
  valuationRange,
}: CalculateValuationProps): number => {
  const floorPayout = payoutRange[0]
  const ceilingPayout = payoutRange[1]
  const floorValuation = valuationRange[0]
  const ceilingValuation = valuationRange[1]

  const tokenPayoutDiff = longTokenPrice - floorPayout
  const valuationDiff = ceilingValuation - floorValuation
  const payoutDiff = ceilingPayout - floorPayout
  return +(floorValuation + (tokenPayoutDiff / payoutDiff) * valuationDiff).toFixed(2)
}
