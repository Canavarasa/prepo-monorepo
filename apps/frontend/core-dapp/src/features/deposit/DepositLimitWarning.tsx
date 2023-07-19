import styled from 'styled-components'
import { Alert as BaseAlert, Icon, spacingIncrement } from 'prepo-ui'
import { displayEth } from '../../utils/number-utils'
import { DepositLimit } from '../../utils/balance-limits'

export const Alert = styled(BaseAlert).attrs({
  color: 'neutral1',
  icon: (
    <Icon
      name="exclamation-circle"
      color="warning"
      width={spacingIncrement(20)}
      height={spacingIncrement(20)}
    />
  ),
  showIcon: true,
  type: 'warning',
})`
  &&& {
    .ant-alert-message {
      font-size: ${({ theme }): string => theme.fontSize.xs};
      font-weight: ${({ theme }): number => theme.fontWeight.medium};
      line-height: ${spacingIncrement(16)};
    }

    .ant-alert-content {
      flex: initial;
      margin-left: ${spacingIncrement(10)};
    }
  }
`

export const InlineTextButton = styled.button`
  all: unset;
  color: ${({ theme }): string => theme.color.primaryLight};
  cursor: pointer;
  text-decoration: underline;
  transition: none;

  :hover,
  :focus {
    color: ${({ theme }): string => theme.color.info};
  }

  :active {
    opacity: 0.8;
  }
`

const DepositLimitWarning: React.FC<{
  depositLimit: DepositLimit
  setDepositAmount: (amount: string) => void
}> = ({ depositLimit, setDepositAmount }) => {
  switch (depositLimit.status) {
    case 'already-exceeded': {
      const cap = displayEth(+depositLimit.capEth)

      return (
        <Alert
          message={
            <p>
              {depositLimit.type === 'global-limit' && <>Global deposit limit reached ({cap})</>}
              {depositLimit.type === 'user-limit' && (
                <>You&apos;ve reached your {cap} deposit limit</>
              )}
            </p>
          }
        />
      )
    }
    case 'exceeded-after-transfer': {
      const formattedRemainingAmount = displayEth(+depositLimit.remainingEth)

      return (
        <Alert
          message={
            <p>
              Deposit limit exceeded. Only{' '}
              <InlineTextButton
                onClick={(): void => {
                  setDepositAmount(depositLimit.remainingEth)
                }}
                aria-label={`Deposit ${formattedRemainingAmount} instead`}
              >
                {formattedRemainingAmount}
              </InlineTextButton>{' '}
              remaining.
            </p>
          }
        />
      )
    }
    default: {
      return null
    }
  }
}

export default DepositLimitWarning
