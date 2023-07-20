import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/router'
import { spacingIncrement } from 'prepo-ui'
import { useEffect, useMemo } from 'react'
import styled, { Color } from 'styled-components'
import PositionLoadingSkeleton, { PositionLoadingSkeletons } from './PositionLoadingSkeleton'
import SlideUpCard from '../SlideUpCard'
import { useRootStore } from '../../../context/RootStoreProvider'
import SlideUpButton from '../SlideUpButton'
import SlideUpRow from '../SlideUpRow'
import { PositionEntity } from '../../../stores/entities/Position.entity'

const SelectedPosition = styled(SlideUpRow)`
  border: none;
  padding: 0;
  :hover {
    background-color: transparent;
  }
`

const DirectionWrapper = styled.span`
  color: ${({ theme }): string => theme.color.neutral2};
  display: inline-block;
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  margin-left: ${spacingIncrement(2)};
  vertical-align: bottom;
`

const DirectionText = styled.span<{ color: keyof Color }>`
  color: ${({ color, theme }): string => theme.color[color]};
  text-transform: capitalize;
`

const SlideUpRowWithPadding = styled(SlideUpRow)`
  padding: ${spacingIncrement(6)} ${spacingIncrement(8)};
`

const PositionsSlideUp: React.FC = () => {
  const router = useRouter()
  const { closeTradeStore, portfolioStore, tradeStore, web3Store } = useRootStore()
  const {
    transactionBundle: { transacting },
  } = closeTradeStore
  const { connected } = web3Store
  const { userPositions } = portfolioStore
  const { slideUpContent, setSlideUpContent, selectedPosition } = tradeStore

  const hasNoPosition = userPositions !== undefined && userPositions.length === 0
  // slide up is disabled if:
  // - not connected: button shows "Connect Wallet"
  // - loading positions: loading skeleton in button
  // - user has no position and nothing selected: Show "No Opened Position"
  // - user is closing a position
  const isSlideUpDisabled =
    !connected || userPositions === undefined || hasNoPosition || transacting

  const handleSelectPosition = (position: PositionEntity): void => {
    tradeStore.setSelectedMarket(position.market.urlId)
    tradeStore.setDirection(position.direction)
    tradeStore.setSlideUpContent()
    router.push(tradeStore.tradeUrl)
  }

  // close SlideUp when this component is unmounted (e.g. user leaves page)
  useEffect(() => () => setSlideUpContent(), [setSlideUpContent])

  useEffect(() => {
    // close SlideUp if user SlideUp should be disabled to avoid weird behaviour when switching between addresses
    if (isSlideUpDisabled && slideUpContent === 'ClosePosition') setSlideUpContent()
  }, [isSlideUpDisabled, setSlideUpContent, slideUpContent])

  const buttonContent = useMemo(() => {
    if (selectedPosition)
      return (
        <SelectedPosition
          position={selectedPosition}
          afterName={
            <DirectionWrapper>
              (
              <DirectionText color={selectedPosition.direction === 'long' ? 'success' : 'error'}>
                {selectedPosition.direction}
              </DirectionText>
              )
            </DirectionWrapper>
          }
        />
      )

    if (userPositions === undefined) return <PositionLoadingSkeleton noPadding />

    return connected && userPositions.length === 0 ? 'No Opened Position' : 'Select a Position'
  }, [connected, userPositions, selectedPosition])

  const shouldEnableButton = (): boolean => {
    // If the user doesn't have positions, the button shouldn't be enabled
    if (!userPositions || userPositions.length === 0) return false
    // If the user has more than one position, it should be enabled
    if (userPositions.length > 1) return true
    // If the user has exactly one position, we enable it if the selected
    // position IS NOT the user position (hasPosition = false)
    // This is because the user can select a position that is not theirs by:
    // - Closing 100% of their position (they don't have a position anymore)
    // - Tampering with the URL
    // In that case, we enable the button to allow the user to get out of that
    // state
    return !selectedPosition?.hasPosition
  }

  return (
    <>
      <SlideUpButton
        disabled={isSlideUpDisabled}
        showShadow={!selectedPosition}
        onClick={shouldEnableButton() ? (): void => setSlideUpContent('ClosePosition') : undefined}
      >
        {buttonContent}
      </SlideUpButton>
      <SlideUpCard
        show={slideUpContent === 'ClosePosition' && !isSlideUpDisabled}
        onClose={(): void => setSlideUpContent(undefined)}
        title="Select a Position"
      >
        {userPositions === undefined ? (
          <PositionLoadingSkeletons />
        ) : (
          <>
            {selectedPosition && (
              <SlideUpRowWithPadding
                selected
                onClick={(): void => handleSelectPosition(selectedPosition)}
                position={selectedPosition}
                showBalance
              />
            )}
            {userPositions
              .filter(({ id }) => id !== selectedPosition?.id)
              .map((position) => (
                <SlideUpRowWithPadding
                  key={position.id}
                  onClick={(): void => handleSelectPosition(position)}
                  position={position}
                  showBalance
                />
              ))}
          </>
        )}
      </SlideUpCard>
    </>
  )
}

export default observer(PositionsSlideUp)
