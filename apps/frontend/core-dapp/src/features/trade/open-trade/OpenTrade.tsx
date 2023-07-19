import { spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import OpenTradeCurrencyInput from './OpenTradeCurrencyInput'
import MarketSlideUp from './MarketSlideUp'
import OpenTradeButton from './OpenTradeButton'
import OpenTradeSummary from './OpenTradeSummary'
import TradeDirectionRadio from './TradeDirectionRadio'
import DepositLimitWarning from '../../deposit/DepositLimitWarning'
import { useRootStore } from '../../../context/RootStoreProvider'
import MarketDetails from '../MarketDetails'

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(16)};
  padding: ${spacingIncrement(8)};
`

const OpenTrade: React.FC = () => {
  const {
    openTradeStore: { depositLimit, setInput },
  } = useRootStore()

  return (
    <Wrapper>
      <MarketSlideUp />
      <TradeDirectionRadio />
      <OpenTradeCurrencyInput />
      <OpenTradeSummary />
      <MarketDetails />
      <OpenTradeButton />
      <DepositLimitWarning depositLimit={depositLimit} setDepositAmount={setInput} />
    </Wrapper>
  )
}

export default observer(OpenTrade)
