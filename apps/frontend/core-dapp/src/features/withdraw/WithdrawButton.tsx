import { observer } from 'mobx-react-lite'
import { Button } from 'prepo-ui'
import { useMemo } from 'react'
import { useRootStore } from '../../context/RootStoreProvider'
import ConnectButton from '../connect/ConnectButton'

const WithdrawButton: React.FC = () => {
  const { web3Store, withdrawStore } = useRootStore()
  const { connected, isNetworkSupported } = web3Store
  const {
    insufficientBalance,
    priceImpactTooHigh,
    withdrawalDisabled,
    withdrawButtonInitialLoading,
    withdrawUILoading,
  } = withdrawStore

  const buttonText = useMemo(() => {
    if (withdrawButtonInitialLoading) return ''
    if (priceImpactTooHigh) return 'Price Impact Too High'
    if (insufficientBalance) return 'Insufficient Balance'
    return 'Withdraw'
  }, [insufficientBalance, priceImpactTooHigh, withdrawButtonInitialLoading])

  if (!connected || !isNetworkSupported) return <ConnectButton block />

  return (
    <Button
      block
      disabled={withdrawalDisabled}
      loading={withdrawUILoading}
      onClick={withdrawStore.withdraw}
    >
      {buttonText}
    </Button>
  )
}

export default observer(WithdrawButton)
