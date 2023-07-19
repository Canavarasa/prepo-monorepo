import { observer } from 'mobx-react-lite'
import { CurrencyInput, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import ClosePositionButton from './ClosePositionButton'
import ClosePositionSummary from './ClosePositionSummary'
import PositionsSlideUp from './PositionsSlideUp'
import { useRootStore } from '../../../context/RootStoreProvider'
import MarketDetails from '../MarketDetails'

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(16)};
  padding: ${spacingIncrement(8)};
  width: 100%;
`

const CloseTrade: React.FC = () => {
  const { closeTradeStore, tokensStore, tradeStore, web3Store } = useRootStore()
  const { connected } = web3Store
  const { closing, inputValue } = closeTradeStore
  const { selectedPosition, selectedMarket } = tradeStore

  return (
    <Wrapper>
      <PositionsSlideUp />
      <CurrencyInput
        balance={selectedPosition?.totalValueInEth}
        currency={{
          icon: tokensStore.COLLATERAL.iconName,
          text: tokensStore.COLLATERAL.shortName,
        }}
        disabled={!selectedPosition || !connected || closing || !!selectedMarket?.resolved}
        isBalanceZero={selectedPosition?.totalValueInWstEthBN?.eq(0)}
        onChange={closeTradeStore.setInput}
        showBalance
        value={inputValue}
        max={5}
      />
      <ClosePositionSummary />
      <MarketDetails />
      <ClosePositionButton />
    </Wrapper>
  )
}

export default observer(CloseTrade)
