import styled from 'styled-components'
import { spacingIncrement } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import DepositButton from './DepositButton'
import DepositCurrencyInput from './DepositCurrencyInput'
import DepositSummary from './DepositSummary'
import DepositLimitWarning from './DepositLimitWarning'
import PageCard from '../../components/PageCard'
import { useRootStore } from '../../context/RootStoreProvider'

const Wrapper = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(16)};
`

const DepositPage: React.FC = () => {
  const {
    depositStore: { depositLimit, setDepositAmount },
  } = useRootStore()

  return (
    <Wrapper>
      <PageCard title="Deposit" backUrl="/portfolio">
        <DepositCurrencyInput />
        <DepositSummary />
        <DepositButton />
        <DepositLimitWarning depositLimit={depositLimit} setDepositAmount={setDepositAmount} />
      </PageCard>
    </Wrapper>
  )
}

export default observer(DepositPage)
