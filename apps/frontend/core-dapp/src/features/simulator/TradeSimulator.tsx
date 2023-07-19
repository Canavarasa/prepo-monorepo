import { useEffect, useMemo } from 'react'
import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import {
  Button,
  Flex,
  Icon,
  mapDistanceToPrice,
  mapPriceToDistance,
  media,
  Sizes,
  spacingIncrement,
  Tooltip,
} from 'prepo-ui'
import { SimulatorCard } from './SimulatorCard'
import { getPnlPercentage, ProfitLossValue as BaseProfitLossValue } from './SimulatorSummary'
import { useRootStore } from '../../context/RootStoreProvider'
import { useFormValue } from '../../hooks/useFormValue'
import { Simulator as SimulatorDefinition, SimulatorPnl } from '../definitions'
import { ScrollIntoView } from '../../components/ScrollIntoView'
import { useWindowSize } from '../../hooks/useWindowSize'

const PositionedSimulatorCard = styled(SimulatorCard)`
  ${media.largeDesktop`
    right: ${spacingIncrement(-16)};
    position: absolute;
    top: ${spacingIncrement(58)};
    transform: translateX(100%);
    width: ${spacingIncrement(264)};
  `}
`

const Header = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
`

const Title = styled.p`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
`

const ProfitLossValue = styled(BaseProfitLossValue)`
  text-align: center;
`

const HeaderComponent: React.FC<{ resetButton: JSX.Element }> = observer(({ resetButton }) => {
  const { tradeStore } = useRootStore()
  const { toggleSimulatorOpen } = tradeStore

  return (
    <Header>
      <Flex gap={4}>
        <Tooltip overlay={<SimulatorDefinition />}>
          <Title>Profit Simulator</Title>
        </Tooltip>
      </Flex>
      <Flex gap={4}>
        {resetButton}
        <Button
          onClick={toggleSimulatorOpen}
          icon={<Icon name="cross" height="16" width="16" />}
          size="xs"
          type="text"
          customColors={{
            label: 'neutral4',
            hoverLabel: 'neutral1',
          }}
        />
      </Flex>
    </Header>
  )
})

const TradeSimulator: React.FC = () => {
  const windowSize = useWindowSize()
  const isLargeDesktop = (windowSize.width ?? 0) >= Sizes.largeDesktop

  const { closeTradeStore, openTradeStore, tradeStore, web3Store } = useRootStore()
  const { price: closePositionPrice, valueByCostBasis: closePositionValueByCostBasis } =
    closeTradeStore
  const { price, amount } = openTradeStore
  const { action, selectedPosition, showSimulator } = tradeStore
  const { connected } = web3Store

  // for closing, show max profit scenario if user's position is empty
  const emptyPosition =
    selectedPosition?.costBasis !== undefined && selectedPosition?.costBasis <= 0

  const entryPrice = useMemo(() => {
    if (action === 'open') return price ?? selectedPosition?.priceInWstEth
    if (!connected || emptyPosition) return selectedPosition?.priceInWstEth
    return selectedPosition?.costBasis
  }, [
    action,
    connected,
    emptyPosition,
    price,
    selectedPosition?.costBasis,
    selectedPosition?.priceInWstEth,
  ])

  const exitPrice = useMemo(() => {
    if (action === 'open' || !connected || emptyPosition)
      return selectedPosition?.market.payoutRange?.[1]

    return closePositionPrice
  }, [action, closePositionPrice, connected, emptyPosition, selectedPosition?.market.payoutRange])

  const direction = selectedPosition?.direction ?? 'long'

  let simulatorData
  if (selectedPosition && selectedPosition.market) {
    const { valuationRange, payoutRange } = selectedPosition.market
    // only show valuation on simulator if all necessary values are loaded
    if (valuationRange && payoutRange) simulatorData = { valuationRange, payoutRange }
  }

  const entryDistance = mapPriceToDistance({ data: simulatorData, price: entryPrice })
  const exitDistance = useFormValue(mapPriceToDistance({ data: simulatorData, price: exitPrice }), {
    canBecomeDirty: action === 'close',
  })

  const resetExitDistance = exitDistance.reset

  // reset exit handle on simulator when:
  // - switch between open <> close
  // - change direction
  useEffect(() => {
    resetExitDistance()
  }, [action, resetExitDistance, selectedPosition])

  const pnlPercentage = getPnlPercentage(
    mapDistanceToPrice({ data: simulatorData, distance: entryDistance }),
    mapDistanceToPrice({ data: simulatorData, distance: exitDistance.value })
  )

  if (!showSimulator) return null

  return (
    <ScrollIntoView enabled={!isLargeDesktop}>
      <PositionedSimulatorCard
        data={simulatorData}
        direction={direction}
        entryDistance={entryDistance}
        exitDistance={exitDistance}
        HeaderComponent={HeaderComponent}
        marketResolved={!!selectedPosition?.market.resolved}
      >
        {pnlPercentage !== undefined && (
          <Tooltip placement="bottom" overlay={<SimulatorPnl />}>
            <div>
              <ProfitLossValue
                pnlPercentage={pnlPercentage}
                tradeSize={
                  action === 'open' ? amount?.inWstEth ?? 0 : closePositionValueByCostBasis
                }
              />
            </div>
          </Tooltip>
        )}
      </PositionedSimulatorCard>
    </ScrollIntoView>
  )
}

export default observer(TradeSimulator)
