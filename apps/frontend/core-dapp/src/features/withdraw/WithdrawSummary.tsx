import { observer } from 'mobx-react-lite'
import { Tooltip, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { formatEther } from 'ethers/lib/utils'
import Skeleton from '../../components/Skeleton'
import SummaryRecord from '../../components/SummaryRecord'
import { useRootStore } from '../../context/RootStoreProvider'
import { GasCost, SlippageProtection, WithdrawReceived } from '../definitions'
import { displayEth } from '../../utils/number-utils'
import { OperationSummary } from '../../components/OperationSummary'
import { ReceivedAmount, SummaryHeader } from '../deposit/DepositSummary'
import { TestId, TestIds } from '../../components/TestId'

const SummaryWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(8)};
`

const WithdrawSummary: React.FC = () => {
  const { withdrawStore } = useRootStore()
  const { withdrawalAmountInput, withdrawalAmount, slippage, gasCostBN } = withdrawStore

  // empty input or 0 input
  const emptyInput = withdrawalAmountInput === '' || +withdrawalAmountInput === 0
  if (emptyInput) return null

  return (
    <SummaryWrapper>
      <OperationSummary
        header={
          <SummaryHeader>
            <Tooltip overlay={<WithdrawReceived />}>
              <ReceivedAmount>ETH Received</ReceivedAmount>
            </Tooltip>

            {withdrawalAmount === undefined ? (
              <Skeleton height="22px" width="64px" />
            ) : (
              <TestId id={TestIds.WithdrawSummaryMinReceived}>
                {displayEth(withdrawalAmount.inEth)}
              </TestId>
            )}
          </SummaryHeader>
        }
        isCollapsible={false}
      >
        <SummaryRecord label="Gas Cost" loading={gasCostBN === undefined} tooltip={<GasCost />}>
          {displayEth(+formatEther(gasCostBN ?? 0))}
        </SummaryRecord>

        <TestId id={TestIds.WithdrawSummarySlippage}>
          <SummaryRecord label="Slippage Protection" tooltip={<SlippageProtection />}>
            {(slippage * 100).toFixed(2)}%
          </SummaryRecord>
        </TestId>
      </OperationSummary>
    </SummaryWrapper>
  )
}

export default observer(WithdrawSummary)
