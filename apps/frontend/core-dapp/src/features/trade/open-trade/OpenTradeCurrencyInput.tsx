import { CurrencyInput } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import { useRootStore } from '../../../context/RootStoreProvider'
import CurrencySlideUp from '../../currencies/CurrencySlideUp'
import { Token } from '../../../stores/TokensStore'

const OpenTradeCurrencyInput: React.FC = () => {
  const { openTradeStore, tokensStore, tradeStore, web3Store } = useRootStore()
  const { connected } = web3Store
  const { sortedTradeTokens } = tokensStore
  const {
    paymentToken,
    openingTrade,
    setInput,
    controlledInput,
    tradingBalanceAfterGas,
    tradingBalanceAfterGasBN,
  } = openTradeStore
  const { slideUpContent, selectedMarket } = tradeStore

  const balance = tokensStore.getTokenBalance(paymentToken)

  const handleChangeToken = (token: Token): void => {
    openTradeStore.setPaymentTokenOverride(token)
    tradeStore.setSlideUpContent()
  }

  return (
    <>
      <CurrencyInput
        balance={balance}
        balanceAfterGas={tradingBalanceAfterGas}
        isBalanceZero={tradingBalanceAfterGasBN?.lte(0)}
        disabled={!selectedMarket || openingTrade || selectedMarket.resolved}
        onChange={setInput}
        currency={{
          icon: paymentToken.iconName,
          text: paymentToken.shortName ?? paymentToken.name,
          onClick: (): void => tradeStore.setSlideUpContent('OpenCurrency'),
        }}
        value={controlledInput}
        placeholder="0"
        showBalance
        max={5}
      />
      <CurrencySlideUp
        hideBalance={!connected}
        onChange={handleChangeToken}
        selectedToken={paymentToken}
        tokens={sortedTradeTokens}
        slideUpCard={{
          show: slideUpContent === 'OpenCurrency',
          onClose: tradeStore.setSlideUpContent,
          title: 'Select Payment Method',
        }}
      />
    </>
  )
}

export default observer(OpenTradeCurrencyInput)
