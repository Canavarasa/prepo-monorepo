import { Icon, IconName, spacingIncrement } from 'prepo-ui'
import styled, { Color, css, FlattenSimpleInterpolation } from 'styled-components'
import { removeUserSelect } from 'prepo-ui/src/themes/core-dapp'
import { Direction } from '../features/trade/TradeStore'

type Size = 'lg' | 'sm'

const directions: Direction[] = ['long', 'short']

const Wrapper = styled.div`
  align-items: center;
  display: flex;
  gap: ${spacingIncrement(8)};
`
const RadioButtonWrapper = styled.div<{
  $disabled: boolean
  $selected?: boolean
  $size: Size
}>`
  align-items: center;
  background-color: ${({ $disabled, theme, $selected }): string => {
    if ($disabled) return theme.color.neutral12
    return theme.color[$selected ? 'neutral8' : 'transparent']
  }};
  border: solid 1px ${({ theme }): string => theme.color.neutral8};
  border-radius: ${({ theme }): string => theme.borderRadius.base};
  cursor: ${({ $disabled }): string => ($disabled ? 'not-allowed' : 'pointer')};
  display: flex;
  gap: ${spacingIncrement(8)};
  justify-content: center;
  padding: ${({ $size }) => spacingIncrement($size === 'sm' ? 8 : 16)};
  width: 100%;

  ${({ theme, $disabled, $selected }): FlattenSimpleInterpolation => {
    if ($disabled) {
      return css`
        background-color: ${theme.color.neutral12};
        cursor: not-allowed;
        opacity: 60%;
      `
    }
    return css`
      background-color: ${theme.color[$selected ? 'neutral8' : 'transparent']};
      cursor: pointer;
      :hover {
        border: solid 1px ${theme.color[$selected ? 'neutral8' : 'neutral5']};
      }
    `
  }}
`

const RadioTitle = styled.p<{ $color: keyof Color; $selected: boolean; $size: 'sm' | 'lg' }>`
  color: ${({ theme, $color }): string => theme.color[$color]};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  margin-bottom: 0;
  ${removeUserSelect}

  ${({ $size, $selected, theme }): FlattenSimpleInterpolation => {
    if ($size === 'sm') {
      return css`
        font-size: ${theme.fontSize.sm};
        line-height: ${spacingIncrement(12)};
      `
    }
    return css`
      font-size: ${theme.fontSize[$selected ? 'lg' : 'md']};
      line-height: ${spacingIncrement(24)};
    `
  }}
`
const RadioButton: React.FC<{
  direction: Direction
  disabled: boolean
  onClick: (direction: Direction) => void
  selected: boolean
  size: Size
}> = ({ direction, disabled, onClick, selected, size }) => {
  const name = direction === 'long' ? 'Long' : 'Short'
  const iconName: IconName = direction === 'long' ? 'long' : 'short'

  const handleClick = (): void => {
    onClick(direction)
  }

  return (
    <RadioButtonWrapper
      $disabled={disabled}
      $selected={selected}
      $size={size}
      onClick={handleClick}
    >
      <RadioTitle
        $color={direction === 'long' ? 'success' : 'error'}
        $selected={!disabled && selected}
        $size={size}
      >
        {name}
      </RadioTitle>
      <Icon name={iconName} />
    </RadioButtonWrapper>
  )
}

export const DirectionRadio: React.FC<{
  disabled?: boolean
  direction: Direction
  onChangeDirection: (newDirection: Direction) => void
  size?: Size
}> = ({ disabled = false, direction, onChangeDirection, size = 'lg' }) => (
  <Wrapper>
    {directions.map((value) => (
      <RadioButton
        direction={value}
        disabled={disabled}
        key={value}
        onClick={onChangeDirection}
        selected={direction === value}
        size={size}
      />
    ))}
  </Wrapper>
)
