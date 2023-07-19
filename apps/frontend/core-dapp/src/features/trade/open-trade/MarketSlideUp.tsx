import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import styled from 'styled-components'
import { spacingIncrement } from 'prepo-ui'
import SlideUpCard from '../SlideUpCard'
import { useRootStore } from '../../../context/RootStoreProvider'
import MarketButton from '../SlideUpButton'
import SlideUpRow from '../SlideUpRow'
import PositionLoadingSkeleton from '../close-trade/PositionLoadingSkeleton'

const SelectedMarket = styled(SlideUpRow)`
  border: none;
  padding: 0;
  :hover {
    background-color: transparent;
  }
`

const SlideUpRowWithPadding = styled(SlideUpRow)`
  padding: ${spacingIncrement(6)} ${spacingIncrement(8)};
`

const MarketSlideUp: React.FC = () => {
  const router = useRouter()
  const { marketStore, tradeStore, portfolioStore } = useRootStore()
  const { unresolvedMarkets } = marketStore
  const { allPositions } = portfolioStore
  const { slideUpContent, selectedMarket, setSlideUpContent, selectedPosition } = tradeStore

  const enabled =
    Object.keys(unresolvedMarkets).length > 1 || !selectedMarket || selectedMarket.resolved

  const handleSelectMarket = (key: string): void => {
    const tradeUrl = tradeStore.setSelectedMarket(key)
    setSlideUpContent(undefined)
    router.push(tradeUrl)
  }

  // close SlideUp when this component is unmounted (e.g. user leaves page)
  useEffect(
    () => () => {
      setSlideUpContent(undefined)
    },
    [setSlideUpContent]
  )

  return (
    <>
      <MarketButton
        showShadow={!selectedMarket}
        onClick={enabled ? () => setSlideUpContent('OpenMarket') : undefined}
      >
        {selectedPosition ? <SelectedMarket position={selectedPosition} /> : 'Select a Market'}
      </MarketButton>
      <SlideUpCard
        show={slideUpContent === 'OpenMarket'}
        onClose={() => setSlideUpContent(undefined)}
        title="Select a Market"
      >
        {selectedPosition && (
          <SlideUpRowWithPadding
            position={selectedPosition}
            onClick={() => handleSelectMarket(selectedPosition.market.urlId)}
            selected
          />
        )}
        {allPositions
          .filter(
            (position) =>
              position.market.urlId !== selectedMarket?.urlId &&
              position.direction === 'long' &&
              !position.market.resolved
          )
          .map((position) =>
            position.market.resolved === undefined ? (
              <PositionLoadingSkeleton key={position.id} />
            ) : (
              <SlideUpRowWithPadding
                key={position.id}
                position={position}
                onClick={() => handleSelectMarket(position.market.urlId)}
              />
            )
          )}
      </SlideUpCard>
    </>
  )
}

export default observer(MarketSlideUp)
