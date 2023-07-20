import { observer } from 'mobx-react-lite'
import { CurrencyInput } from 'prepo-ui'
import WithdrawButton from './WithdrawButton'
import WithdrawSummary from './WithdrawSummary'
import WithdrawWarning from './WithdrawWarning'
import { useRootStore } from '../../context/RootStoreProvider'
import PageCard from '../../components/PageCard'
import { Routes } from '../../lib/routes'

const WithdrawPage: React.FC = () => {
  const { collateralStore, withdrawStore } = useRootStore()
  const { balanceOfSigner, balance } = collateralStore
  const {
    setWithdrawalAmount,
    transactionBundle: { transacting },
    withdrawalAmountInput,
  } = withdrawStore

  return (
    <PageCard backUrl={Routes.Portfolio} title="Withdraw">
      <CurrencyInput
        balance={balance?.inEthString}
        isBalanceZero={balanceOfSigner?.eq(0)}
        currency={{ icon: 'eth', text: 'ETH' }}
        disabled={transacting}
        onChange={setWithdrawalAmount}
        value={withdrawalAmountInput}
        showBalance
      />
      <WithdrawSummary />
      <WithdrawButton />
      <WithdrawWarning />
    </PageCard>
  )
}

export default observer(WithdrawPage)
