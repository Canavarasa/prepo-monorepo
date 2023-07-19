import { useMemo } from 'react'
import { observer } from 'mobx-react-lite'
import { Button } from 'prepo-ui'
import styled from 'styled-components'
import ConnectButton from '../connect/ConnectButton'
import { useRootStore } from '../../context/RootStoreProvider'

const Wrapper = styled.div`
  position: relative;
`

const DepositButton: React.FC = () => {
  const { depositStore, collateralStore, web3Store } = useRootStore()
  const {
    depositButtonInitialLoading,
    depositDisabled,
    depositButtonLoading,
    insufficientBalance,
  } = depositStore
  const { depositsAllowed } = collateralStore
  const { connected, isNetworkSupported } = web3Store

  const buttonText = useMemo(() => {
    if (depositButtonInitialLoading) return ''
    if (!depositsAllowed) return 'Coming Soon'
    if (insufficientBalance) return 'Insufficient Balance'
    return 'Deposit'
  }, [depositButtonInitialLoading, depositsAllowed, insufficientBalance])

  if (!connected || !isNetworkSupported) return <ConnectButton block />

  const handleClick = async (): Promise<void> => {
    await depositStore.deposit()
  }

  return (
    <Wrapper>
      <Button block onClick={handleClick} loading={depositButtonLoading} disabled={depositDisabled}>
        {buttonText}
      </Button>
    </Wrapper>
  )
}

export default observer(DepositButton)
