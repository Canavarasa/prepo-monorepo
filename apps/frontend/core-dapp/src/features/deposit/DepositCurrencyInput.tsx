import { CurrencyInput } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import { useRootStore } from '../../context/RootStoreProvider'
import { TokensStore } from '../../stores/TokensStore'

const depositToken = TokensStore.NATIVE_ETH

const OpenTradeCurrencyInput: React.FC = () => {
  const { tokensStore, depositStore } = useRootStore()
  const {
    depositAmount,
    depositing,
    isLoadingBalance,
    depositBalanceAfterGasBN,
    depositBalanceAfterGas,
  } = depositStore

  const balance = tokensStore.getTokenBalance(depositToken)

  return (
    <CurrencyInput
      balance={balance}
      balanceAfterGas={depositBalanceAfterGas}
      isBalanceZero={depositBalanceAfterGasBN?.lte(0)}
      disabled={depositing || isLoadingBalance}
      currency={{
        icon: depositToken.iconName,
        text: depositToken.shortName ?? depositToken.name,
      }}
      onChange={depositStore.setDepositAmount}
      value={depositAmount}
      placeholder="0"
      showBalance
    />
  )
}

export default observer(OpenTradeCurrencyInput)
