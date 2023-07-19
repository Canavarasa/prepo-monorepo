import { Flex, spacingIncrement, Tooltip } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import { formatEther } from 'ethers/lib/utils'
import Skeleton from '../../components/Skeleton'
import SummaryRecord from '../../components/SummaryRecord'
import { useRootStore } from '../../context/RootStoreProvider'
import { DepositReceived, EthYield, SlippageProtection, GasCost } from '../definitions'
import { displayEth } from '../../utils/number-utils'
import { OperationSummary } from '../../components/OperationSummary'
import LidoApr from '../../components/LidoApr'
import { TestId, TestIds } from '../../components/TestId'

export const SummaryHeader = styled.div`
  color: ${({ theme }) => theme.color.neutral14};
  display: flex;
  justify-content: space-between;
  width: 100%;
`

export const ReceivedAmount = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
`

const DepositYield = styled.div`
  border: 1px solid ${({ theme }) => theme.color.neutral8};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.color.neutral3};
  display: flex;
  font-size: ${({ theme }) => theme.fontSize.sm};
  justify-content: space-between;
  padding: ${spacingIncrement(8)} ${spacingIncrement(12)};
  width: 100%;
`

const SummaryWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(8)};
`

const DepositSummary: React.FC = () => {
  const { depositStore } = useRootStore()
  const { depositAmount, amountOut, gasCostBN, slippage } = depositStore

  // empty input or 0 input
  if (depositAmount === '' || amountOut?.inEth === 0) return null

  return (
    <SummaryWrapper>
      <Flex flexDirection="column" gap={8}>
        <OperationSummary
          header={
            <SummaryHeader>
              <Tooltip overlay={<DepositReceived />}>
                <ReceivedAmount>Deposit Received</ReceivedAmount>
              </Tooltip>

              {amountOut === undefined ? (
                <Skeleton height="22px" width="64px" />
              ) : (
                <TestId id={TestIds.DepositSummaryMinReceived}>
                  {displayEth(amountOut.inEth)}
                </TestId>
              )}
            </SummaryHeader>
          }
          isCollapsible={false}
        >
          <SummaryRecord label="Gas Cost" loading={gasCostBN === undefined} tooltip={<GasCost />}>
            {displayEth(+formatEther(gasCostBN ?? 0))}
          </SummaryRecord>

          <TestId id={TestIds.DepositSummarySlippage}>
            <SummaryRecord label="Slippage Protection" tooltip={<SlippageProtection />}>
              {(slippage * 100).toFixed(2)}%
            </SummaryRecord>
          </TestId>
        </OperationSummary>

        <Tooltip overlay={<EthYield />}>
          <DepositYield>
            <span>Deposit Yield</span>
            <LidoApr />
          </DepositYield>
        </Tooltip>
      </Flex>
    </SummaryWrapper>
  )
}

export default observer(DepositSummary)
