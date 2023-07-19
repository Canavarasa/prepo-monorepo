import { observer } from 'mobx-react-lite'
import { Flex } from 'prepo-ui'
import { useRootStore } from '../../context/RootStoreProvider'
import { displayEth } from '../../utils/number-utils'
import { Alert, InlineTextButton } from '../deposit/DepositLimitWarning'
import { formatDuration } from '../../utils/date-utils'

const WithdrawWarning: React.FC = () => {
  const {
    withdrawStore: { withdrawLimit, setWithdrawalAmount },
  } = useRootStore()

  switch (withdrawLimit.status) {
    case 'already-exceeded': {
      const cap = displayEth(+withdrawLimit.capEth)

      return (
        <Alert
          message={
            <>
              <p>Global withdrawal limit reached ({cap})</p>
              <br />
              {withdrawLimit.resetsIn !== undefined && (
                <p>Resets in {formatDuration(withdrawLimit.resetsIn)}</p>
              )}
            </>
          }
        />
      )
    }
    case 'exceeded-after-transfer': {
      const formattedRemainingAmount = displayEth(+withdrawLimit.remainingEth)

      return (
        <Alert
          message={
            <Flex flexDirection="column" gap={8} alignItems="start">
              <p>
                Withdrawal limit exceeded. (
                <InlineTextButton
                  onClick={(): void => {
                    setWithdrawalAmount(withdrawLimit.remainingEth)
                  }}
                  aria-label={`Withdraw ${formattedRemainingAmount} instead`}
                >
                  {formattedRemainingAmount}
                </InlineTextButton>{' '}
                remaining)
              </p>
              {withdrawLimit.resetsIn !== undefined && (
                <p>Resets in {formatDuration(withdrawLimit.resetsIn)}</p>
              )}
            </Flex>
          }
        />
      )
    }
    default: {
      return null
    }
  }
}

export default observer(WithdrawWarning)
