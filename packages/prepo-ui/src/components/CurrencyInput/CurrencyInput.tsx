import type { InputProps } from 'antd'
import { displayDecimals } from 'prepo-utils'
import styled, { css } from 'styled-components'
import { spacingIncrement } from '../../common-utils'
import { removeUserSelect } from '../../themes/core-dapp'
import Flex from '../Flex'
import Icon from '../Icon'
import { IconName } from '../Icon/icon.types'

export type CurrencyType = { icon: IconName; text: string; onClick?: () => void }

type Props = {
  balance?: string
  balanceNotVisible?: boolean
  isBalanceZero?: boolean
  disabled?: boolean
  onChange?: (e: string) => void
  showBalance?: boolean
  balanceAfterGas?: string
}

const Balance = styled(Flex)`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
`

const MaxButton = styled.button`
  ${({ theme }) =>
    theme.isDarkMode
      ? css`
          color: ${theme.color.darkPrimaryLight};

          :hover {
            color: ${theme.color.white};
          }
        `
      : css`
          color: ${theme.color.primary};

          :hover {
            color: ${theme.color.darkPrimaryLight};
          }
        `};

  align-items: center;
  background: rgba(155, 157, 255, 0.25);
  border: none;
  border-radius: ${({ theme }): string => theme.borderRadius.xs};
  cursor: ${({ disabled }): string => (disabled ? 'not-allowed' : 'pointer')};
  display: flex;
  font-size: ${spacingIncrement(11)};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  height: ${spacingIncrement(16)};
  margin-left: ${spacingIncrement(4)};
  padding: ${spacingIncrement(2)} ${spacingIncrement(6)};
`

const Form = styled(Flex).attrs({
  as: 'form',
})<{ disabled?: boolean }>`
  border: 1px solid ${({ theme }): string => theme.color.neutral12};
  cursor: ${({ disabled }): string => (disabled ? 'not-allowed' : 'auto')};
  :hover {
    border: 1px solid
      ${({ disabled, theme }): string => theme.color[disabled ? 'neutral12' : 'neutral7']};
  }
`

const StyledInput = styled.input<{ disabled?: boolean }>`
  background: transparent;
  border: none;
  color: ${({ theme }): string => theme.color.neutral1};
  cursor: ${({ disabled }): string => (disabled ? 'not-allowed' : 'auto')};
  font-size: ${({ theme }): string => theme.fontSize['2xl']};
  font-weight: ${({ theme }): number => theme.fontWeight.regular};
  min-width: ${spacingIncrement(40)};
  text-overflow: ellipsis;
  &:focus {
    outline: none;
  }
`
const FlexText = styled(Flex)<{ clickable?: boolean; disabled?: boolean }>`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.md};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  ${({ disabled }) => (disabled ? removeUserSelect : css``)}
  ${({ clickable, disabled }) =>
    clickable
      ? css`
          box-shadow: 0 6px 10px rgba(0, 0, 0, 0.08);
          cursor: ${disabled ? 'default' : 'pointer'};
        `
      : css``}
`

const Currency: React.FC<{ disabled?: boolean; currency: CurrencyType }> = ({
  disabled,
  currency,
}) => (
  <FlexText
    disabled={disabled}
    borderRadius={16}
    onClick={currency.onClick}
    p={8}
    pr={12}
    background="neutral13"
    gap={4}
    height={40}
    clickable={currency.onClick !== undefined}
  >
    <Flex gap={8}>
      <Flex borderRadius="24px" overflow="hidden">
        <Icon name={currency.icon} height="24px" width="24px" />
      </Flex>
      {currency.text}
    </Flex>
    {currency.onClick !== undefined && <Icon name="chevron-down" width="12px" height="12px" />}
  </FlexText>
)

const CurrencyInput: React.FC<
  Omit<InputProps, 'onChange'> &
    Props & {
      currency: CurrencyType
      max?: number
    }
> = ({
  balance,
  balanceNotVisible,
  disabled,
  isBalanceZero,
  onFocus,
  onBlur,
  placeholder,
  value,
  onChange,
  currency,
  children,
  showBalance,
  balanceAfterGas = balance, // fallback to balance if not passed, which means 0 gas buffer e.g. for trading and withdrawals
  max = 99_999,
}) => {
  const handleMax = (): void => {
    if (onChange && balanceAfterGas !== undefined) onChange(balanceAfterGas)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    try {
      if (!onChange) return

      const formattedValue = e.target.value.replace(',', '.')
      onChange(formattedValue)
    } catch (error) {
      // invalid input
    }
  }

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>): void => {
    const formattedValue = e.target.value.replace(',', '.')
    if (!Number.isNaN(+formattedValue) && +formattedValue > max && onChange) {
      onChange(max.toString())
      e.target?.setCustomValidity(`Please enter at most ${max} ETH`)
      e.target?.form?.reportValidity()
    } else {
      e.target?.setCustomValidity('')
    }

    onBlur?.(e)
  }

  return (
    <Form
      opacity={disabled ? 0.6 : 1}
      background="neutral12"
      borderRadius={20}
      p={16}
      alignItems="stretch"
      flexDirection="column"
      gap={4}
      disabled={disabled}
    >
      <Flex justifyContent="space-between">
        <StyledInput
          disabled={disabled}
          onFocus={onFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          inputMode="numeric"
        />
        <Currency disabled={disabled} currency={currency} />
      </Flex>
      {showBalance && (
        <Balance alignSelf="flex-end" height={16}>
          {balance !== undefined && !balanceNotVisible && (
            <>
              {`Balance: ${displayDecimals(balance)}`}
              {value !== balanceAfterGas && !isBalanceZero && (
                <MaxButton disabled={disabled} onClick={handleMax}>
                  MAX
                </MaxButton>
              )}
            </>
          )}
        </Balance>
      )}
      {children}
    </Form>
  )
}

export default CurrencyInput
