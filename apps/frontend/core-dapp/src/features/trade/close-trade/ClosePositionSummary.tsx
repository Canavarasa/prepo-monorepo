import { useMemo } from 'react'
import { observer } from 'mobx-react-lite'
import { spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { formatEther } from 'ethers/lib/utils'
import { useRootStore } from '../../../context/RootStoreProvider'
import SummaryRecord from '../../../components/SummaryRecord'
import {
  EstimateYourProfitLoss,
  EstimatedValuation,
  RedemptionFinalPrice,
  SlippageProtection,
  GasCost,
} from '../../definitions'
import { compactNumber, displayEth } from '../../../utils/number-utils'
import { RedText } from '../open-trade/OpenTradeSummary'
import { OperationSummary } from '../../../components/OperationSummary'
import { PriceImpact } from '../../../components/PriceImpactWarning'
import Skeleton from '../../../components/Skeleton'

const Profit = styled.span`
  color: ${({ theme }): string => theme.color.success};
`

const Loss = styled.span`
  color: ${({ theme }): string => theme.color.error};
`

const SummaryWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(8)};
`

const ClosePositionSummary: React.FC = () => {
  const { advancedSettingsStore, closeTradeStore, tradeStore } = useRootStore()
  const { slippageForTrades } = advancedSettingsStore
  const {
    insufficientBalance,
    pnlAmount,
    valuation,
    valueByCostBasis,
    priceImpact,
    withinBounds,
    inputValue,
    value,
    gasCostBN,
  } = closeTradeStore
  const { selectedMarket, selectedPosition } = tradeStore

  const isMarketResolved = !!selectedMarket?.resolved

  const pnlText = useMemo(() => {
    // this line is only to get pass type check
    // the returned value doesn't matter because
    // SummaryRecord will show loading skeleton when closePositionPnlAmount is undefined
    if (pnlAmount === undefined || valueByCostBasis === undefined) return ''

    const pnlPercentage = (pnlAmount / valueByCostBasis) * 100

    // happens when input amount is too small (e.g. dust)
    if (Number.isNaN(pnlPercentage)) return ''
    if (pnlPercentage >= 0) return <Profit>+{pnlPercentage.toFixed(2)}%</Profit>

    return <Loss>{pnlPercentage.toFixed(2)}%</Loss>
  }, [pnlAmount, valueByCostBasis])

  if (!selectedPosition || inputValue === '' || value?.inEthBN.eq(0)) return null

  const loadingPnl =
    pnlAmount === undefined ||
    selectedPosition.totalValueInWstEthBN === undefined ||
    insufficientBalance === undefined

  // Only show PNL if user has a position and sufficient balance, otherwise it will always be inaccurate because costBasis is 0
  const showPnL =
    selectedPosition.totalValueInWstEthBN?.gt(0) && !insufficientBalance && pnlText !== ''

  const renderValueUI = (): React.ReactNode => {
    if (!selectedMarket) return null
    if (valuation === undefined) return <Skeleton height="22px" width="64px" />
    if (withinBounds === false) return <RedText>Unprofitable</RedText>
    const unitPrice = selectedMarket.getUnitPriceString(valuation)
    return `${compactNumber(valuation, {
      showUsdSign: true,
    })} FDV${unitPrice !== undefined ? ` (${unitPrice})` : ''}`
  }

  return (
    <SummaryWrapper>
      <OperationSummary header={renderValueUI()}>
        <SummaryRecord
          label={isMarketResolved ? 'Final Price' : 'Price'}
          loading={valuation === undefined}
          tooltip={isMarketResolved ? <RedemptionFinalPrice /> : <EstimatedValuation />}
        >
          {renderValueUI()}
        </SummaryRecord>
        {isMarketResolved ? null : (
          <SummaryRecord label="Price Impact" loading={priceImpact === undefined}>
            {priceImpact !== undefined && <PriceImpact priceImpact={priceImpact} />}
          </SummaryRecord>
        )}
        {isMarketResolved ? null : (
          <SummaryRecord label="Slippage Protection" tooltip={<SlippageProtection />}>
            {(slippageForTrades * 100).toFixed(2)}%
          </SummaryRecord>
        )}
        {showPnL && (
          <SummaryRecord
            label="PnL"
            loading={loadingPnl}
            tooltip={isMarketResolved ? undefined : <EstimateYourProfitLoss />}
          >
            {pnlText}&nbsp;({displayEth(Math.abs(pnlAmount ?? 0))})
          </SummaryRecord>
        )}

        <SummaryRecord label="Gas Cost" loading={gasCostBN === undefined} tooltip={<GasCost />}>
          {displayEth(+formatEther(gasCostBN ?? 0))}
        </SummaryRecord>
      </OperationSummary>
    </SummaryWrapper>
  )
}

export default observer(ClosePositionSummary)
