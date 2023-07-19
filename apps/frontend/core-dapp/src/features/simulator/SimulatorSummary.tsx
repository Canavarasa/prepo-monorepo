import { spacingIncrement } from 'prepo-ui'
import styled, { Color } from 'styled-components'
import { observer } from 'mobx-react-lite'
import { formatEther, parseEther } from 'ethers/lib/utils'
import { Range } from '../../types/market.types'
import { Direction } from '../trade/TradeStore'
import SummaryRecord from '../../components/SummaryRecord'
import { displayEth } from '../../utils/number-utils'
import { useRootStore } from '../../context/RootStoreProvider'
import {
  SimulatorEstimatedLoss,
  SimulatorEstimatedProfit,
  SimulatorMaxLoss,
  SimulatorMaxProfit,
} from '../definitions'

type Props = {
  direction: Direction
  payoutRange?: Range
  entryPrice?: number
  exitPrice?: number
  tradeSize?: number
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(8)};
`

const ColoredLabel = styled.span<{ color: keyof Color }>`
  color: ${({ color, theme }): string => theme.color[color]};
`

const Nowrap = styled.span`
  white-space: nowrap;
`

// the first part computes the position's growth %
// e.g. if enter price is $0.3 and exit at $0.6, position is 200%
// the subtract part computes the pnl in percentage
// e.g. with the $0.3 -> $0.6 example, 200% - 100% -> 100% profit
export const getPnlPercentage = (entry?: number, exit?: number): number | undefined => {
  if (entry === undefined || exit === undefined) return undefined
  return (1 / entry) * exit - 1
}

export function getMaxProfitLoss({
  entryPrice,
  payoutRange,
}: {
  entryPrice: number | undefined
  payoutRange: Range | undefined
}): {
  maxProfit: number | undefined
  maxLoss: number | undefined
} {
  const maxProfit = getPnlPercentage(entryPrice, payoutRange?.[1])
  const maxLoss = getPnlPercentage(entryPrice, payoutRange?.[0])

  return {
    maxProfit,
    maxLoss,
  }
}

const ProfitLossParagraph = styled.p`
  color: ${({ theme }) => theme.color.neutral3};
`

export const ProfitLossValue: React.FC<{
  className?: string
  color?: keyof Color
  pnlPercentage?: number
  prefix?: string
  tradeSize: number | undefined
}> = observer(({ className, color, pnlPercentage, prefix, tradeSize }) => {
  const { balancerStore } = useRootStore()

  if (pnlPercentage === undefined)
    return (
      <ProfitLossParagraph className={className}>
        <ColoredLabel color={color ?? 'success'}>???</ColoredLabel>
      </ProfitLossParagraph>
    )

  const pnlAmountInETHBN =
    tradeSize === undefined
      ? undefined
      : balancerStore.getWstEthAmountInEth(
          parseEther(`${Math.abs(tradeSize * pnlPercentage).toFixed(18)}`)
        )

  const pnlAmountInETH = pnlAmountInETHBN === undefined ? undefined : +formatEther(pnlAmountInETHBN)

  const pnlAmount =
    pnlAmountInETH === undefined || pnlAmountInETH === 0 ? '' : `(${displayEth(pnlAmountInETH)})`

  return (
    <ProfitLossParagraph className={className}>
      <ColoredLabel color={color ?? (pnlPercentage >= 0 ? 'success' : 'error')}>
        {prefix ?? (pnlPercentage >= 0 ? '+' : '-')}
        {(Math.abs(pnlPercentage) * 100).toFixed(2)}%
      </ColoredLabel>{' '}
      <Nowrap>{pnlAmount}</Nowrap>
    </ProfitLossParagraph>
  )
})

const SimulatorSummary: React.FC<Props> = ({ payoutRange, entryPrice, exitPrice, tradeSize }) => {
  const estimatedPnl = getPnlPercentage(entryPrice, exitPrice)

  const { maxProfit, maxLoss } = getMaxProfitLoss({
    entryPrice,
    payoutRange,
  })

  const isProfit = (estimatedPnl ?? 0) >= 0

  return (
    <Wrapper>
      <SummaryRecord
        label={`Estimated ${isProfit ? 'Profit' : 'Loss'}`}
        tooltip={isProfit ? <SimulatorEstimatedProfit /> : <SimulatorEstimatedLoss />}
      >
        <ProfitLossValue pnlPercentage={estimatedPnl} tradeSize={tradeSize} />
      </SummaryRecord>
      <SummaryRecord label="Max Profit" tooltip={<SimulatorMaxProfit />}>
        <ProfitLossValue
          color="success"
          pnlPercentage={maxProfit}
          prefix="+"
          tradeSize={tradeSize}
        />
      </SummaryRecord>
      <SummaryRecord label="Max Loss" tooltip={<SimulatorMaxLoss />}>
        <ProfitLossValue color="error" pnlPercentage={maxLoss} prefix="-" tradeSize={tradeSize} />
      </SummaryRecord>
    </Wrapper>
  )
}
export default SimulatorSummary
