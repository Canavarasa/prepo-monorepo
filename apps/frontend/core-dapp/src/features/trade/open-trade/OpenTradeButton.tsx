import { observer } from 'mobx-react-lite'
import { Button } from 'prepo-ui'
import { useMemo } from 'react'
import { useRootStore } from '../../../context/RootStoreProvider'
import ConnectButton from '../../connect/ConnectButton'

const OpenTradeButton: React.FC = () => {
  const { openTradeStore, tradeStore, web3Store } = useRootStore()
  const {
    depositPriceImpactTooHigh,
    insufficientBalance,
    initialLoading,
    loading,
    disabled,
    paymentToken,
    withinBounds,
  } = openTradeStore
  const { connected, isNetworkSupported } = web3Store
  const { selectedMarket } = tradeStore

  const buttonText = useMemo(() => {
    if (!selectedMarket) return 'Select a Market'

    if (selectedMarket.resolved) return 'Market Ended'

    if (withinBounds === false) return 'Unprofitable Trade'
    if (depositPriceImpactTooHigh) return 'Insufficient wstETH Liquidity'

    if (connected) {
      if (insufficientBalance) return 'Insufficient Balance'
    }

    // during initial loading states, show only "spinner" and no text
    if (initialLoading) return ''

    if (paymentToken.type === 'native') return 'Deposit And Trade'

    return 'Trade'
  }, [
    connected,
    depositPriceImpactTooHigh,
    initialLoading,
    insufficientBalance,
    paymentToken.type,
    selectedMarket,
    withinBounds,
  ])

  if (!connected || !isNetworkSupported) return <ConnectButton />

  const handleClick = (): void => {
    openTradeStore.openTrade()
  }

  return (
    <Button block disabled={disabled || loading} loading={loading} onClick={handleClick}>
      {buttonText}
    </Button>
  )
}

export default observer(OpenTradeButton)
