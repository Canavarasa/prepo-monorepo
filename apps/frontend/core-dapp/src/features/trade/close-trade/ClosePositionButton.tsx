import { observer } from 'mobx-react-lite'
import { Button } from 'prepo-ui'
import { useMemo } from 'react'
import { useRootStore } from '../../../context/RootStoreProvider'
import ConnectButton from '../../connect/ConnectButton'
import { fraction, toPercent } from '../../../utils/fraction-utils'

const ClosePositionButton: React.FC = () => {
  const { closeTradeStore, tradeStore, web3Store } = useRootStore()
  const { loading, disabled, initialLoading, insufficientBalance, value } = closeTradeStore
  const { selectedPosition, selectedMarket } = tradeStore
  const { connected, isNetworkSupported } = web3Store

  const selectedMarketResolved = !!selectedMarket?.resolved

  const buttonText = useMemo(() => {
    if (!selectedPosition) return 'Select a Position'
    if (initialLoading) return ''
    if (insufficientBalance) return 'Insufficient Balance'

    const verb = selectedMarketResolved ? 'Redeem' : 'Close'

    if (
      value !== undefined &&
      value.inEthBN.gt(0) &&
      selectedPosition.totalValueInEthBN !== undefined
    ) {
      const percentage = toPercent(
        fraction(value.inEthBN.mul(100), selectedPosition.totalValueInEthBN)
      )
      return `${verb} Position (${percentage > 0.01 ? percentage.toFixed(2) : '<0.01'}%)`
    }

    return `${verb} Position`
  }, [selectedPosition, initialLoading, insufficientBalance, selectedMarketResolved, value])

  if (!connected || !isNetworkSupported) return <ConnectButton block />

  const handleClick = (): void => {
    closeTradeStore.closeOrRedeemPosition()
  }
  return (
    <Button block disabled={disabled} loading={loading} onClick={handleClick}>
      {buttonText}
    </Button>
  )
}

export default observer(ClosePositionButton)
