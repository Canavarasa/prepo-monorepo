import { observer } from 'mobx-react-lite'
import { Button } from 'prepo-ui'
import { useMemo } from 'react'
import { useRootStore } from '../../../context/RootStoreProvider'
import ConnectButton from '../../connect/ConnectButton'

const ClosePositionButton: React.FC = () => {
  const { closeTradeStore, tradeStore, web3Store } = useRootStore()
  const {
    disabled,
    initialLoading,
    insufficientBalance,
    loading,
    transactionBundle: { actionLabel, execute },
  } = closeTradeStore
  const { selectedPosition } = tradeStore
  const { connected, isNetworkSupported } = web3Store

  const buttonText = useMemo(() => {
    if (!selectedPosition) return 'Select a Position'
    if (initialLoading) return ''
    if (insufficientBalance) return 'Insufficient Balance'
    return actionLabel
  }, [selectedPosition, initialLoading, insufficientBalance, actionLabel])

  if (!connected || !isNetworkSupported) return <ConnectButton block />

  return (
    <Button block disabled={disabled} loading={loading} onClick={execute}>
      {buttonText}
    </Button>
  )
}

export default observer(ClosePositionButton)
