import { observer } from 'mobx-react-lite'
import { spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { formatEther } from 'ethers/lib/utils'
import Skeleton from '../../../components/Skeleton'
import SummaryRecord from '../../../components/SummaryRecord'
import { useRootStore } from '../../../context/RootStoreProvider'
import { compactNumber, displayEth } from '../../../utils/number-utils'
import {
  DepositAndTradePriceImpact,
  EstimatedValuation,
  GasCost,
  MaxLoss,
  MaxProfit,
  SlippageProtection,
  TradePriceImpact,
} from '../../definitions'
import {
  OperationSummary,
  Divider as CollapsableSummaryDivider,
} from '../../../components/OperationSummary'
import {
  getMaxProfitLoss,
  ProfitLossValue as BaseProfitLossValue,
} from '../../simulator/SimulatorSummary'
import { PriceImpact } from '../../../components/PriceImpactWarning'
import { TestId, TestIds } from '../../../components/TestId'

export const RedText = styled.span`
  color: ${({ theme }): string => theme.color.error};
`

const ProfitLossValue = styled(BaseProfitLossValue)`
  color: inherit;
`

const SummaryWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(8)};
`

const OpenTradeSummary: React.FC = () => {
  const { openTradeStore, tradeStore } = useRootStore()
  const {
    amount,
    depositPriceImpactTooHigh,
    paymentToken,
    price,
    priceImpact,
    slippage,
    tradingValuation,
    withinBounds,
    gasCostBN,
  } = openTradeStore
  const { selectedMarket } = tradeStore

  if (!selectedMarket || selectedMarket.resolved || !amount || amount.inEthBN.eq(0)) return null

  const { maxProfit, maxLoss } = getMaxProfitLoss({
    entryPrice: price,
    payoutRange: selectedMarket.payoutRange,
  })

  const loading = tradingValuation === undefined || withinBounds === undefined

  const renderValueUI = (): React.ReactNode => {
    if (loading) return <Skeleton height="22px" width="64px" />
    const unitPrice = selectedMarket.getUnitPriceString(tradingValuation)
    if (withinBounds === false || depositPriceImpactTooHigh) return <RedText>Unprofitable</RedText>
    return `${compactNumber(tradingValuation, {
      showUsdSign: true,
    })} FDV${unitPrice !== undefined ? ` (${unitPrice})` : ''}`
  }

  return (
    <SummaryWrapper>
      <OperationSummary
        key="summary"
        header={<TestId id={TestIds.OpenTradeSummaryHeader}>{renderValueUI()}</TestId>}
      >
        <SummaryRecord label="Price" tooltip={<EstimatedValuation />}>
          {renderValueUI()}
        </SummaryRecord>
        <SummaryRecord
          label="Price Impact"
          tooltip={
            paymentToken.type === 'native' ? <DepositAndTradePriceImpact /> : <TradePriceImpact />
          }
          loading={priceImpact === undefined}
        >
          {priceImpact !== undefined && <PriceImpact priceImpact={priceImpact} />}
        </SummaryRecord>
        <TestId id={TestIds.OpenTradeSummarySlippage}>
          <SummaryRecord label="Slippage Protection" tooltip={<SlippageProtection />}>
            {(slippage * 100).toFixed(2)}%
          </SummaryRecord>
        </TestId>

        <SummaryRecord label="Gas Cost" loading={gasCostBN === undefined} tooltip={<GasCost />}>
          {displayEth(+formatEther(gasCostBN ?? 0))}
        </SummaryRecord>

        <CollapsableSummaryDivider />

        <SummaryRecord
          label="Max Profit"
          loading={!amount || maxProfit === undefined}
          tooltip={<MaxProfit />}
        >
          <ProfitLossValue
            color="success"
            pnlPercentage={maxProfit}
            prefix="+"
            tradeSize={amount.inWstEth}
          />
        </SummaryRecord>
        <SummaryRecord
          label="Max Loss"
          loading={!amount || maxLoss === undefined}
          tooltip={<MaxLoss />}
        >
          <ProfitLossValue
            color="error"
            pnlPercentage={maxLoss}
            prefix="-"
            tradeSize={amount.inWstEth}
          />
        </SummaryRecord>
      </OperationSummary>
    </SummaryWrapper>
  )
}

export default observer(OpenTradeSummary)
