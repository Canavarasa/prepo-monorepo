import { Tooltip, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'

type Props = {
  priceImpact: number | undefined
  showIfGreaterThan?: number
}

const Wrapper = styled.div`
  align-items: center;
  border: solid 1px ${({ theme }) => theme.color.neutral7};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.color.neutral3};
  display: flex;
  font-size: ${({ theme }) => theme.fontSize.sm};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  justify-content: space-between;
  padding: ${spacingIncrement(8)} ${spacingIncrement(12)};
`

export const PriceImpact: React.FC<{ priceImpact: number }> = ({ priceImpact }) => {
  // similar to Balancer, when price impact is less than 0.01%, we show 0.01%
  const formatValue = (): string => {
    const inPercentage = priceImpact * 100
    if (inPercentage <= 0.01) return '0.01'
    return inPercentage.toFixed(2)
  }

  return <p>{formatValue()}%</p>
}

const PriceImpactWarning: React.FC<Props> = ({ priceImpact, showIfGreaterThan }) => {
  // hidden for any falsy value including 0
  if (!priceImpact || (showIfGreaterThan !== undefined && priceImpact <= showIfGreaterThan))
    return null

  return (
    <Tooltip overlay="Unfavorable pricing expected. Your transaction size is large relative to available liquidity.">
      <Wrapper>
        <p>Price impact warning</p>
        <PriceImpact priceImpact={priceImpact} />
      </Wrapper>
    </Tooltip>
  )
}

export default PriceImpactWarning
