import { InputProps } from 'antd'
import { SizeType } from 'antd/lib/config-provider/SizeContext'
import { ComponentType, FocusEvent, useState } from 'react'
import styled, { Color, css, FlattenSimpleInterpolation } from 'styled-components'
import dynamic from 'next/dynamic'
import { media, spacingIncrement } from '../../common-utils'
import { fontSize } from '../../themes/core-dapp'

const AInput: ComponentType<InputProps> = dynamic(() => import('antd').then(({ Input }) => Input))

export type Alignment = 'left' | 'center' | 'right'

type CustomStyles = {
  backgroundColor?: keyof Color
  borderColor?: keyof Color
}

type Props = InputProps & {
  alignInput?: Alignment
  customStyles?: CustomStyles
  error?: boolean
  label?: string
  onClear?: () => void
  secondaryLabel?: React.ReactNode
  shadowSuffix?: string
  className?: string
}

type InputSize = {
  fontSize: [keyof typeof fontSize, keyof typeof fontSize]
  padding: [[number, number], [number, number]]
  name: 'lg' | 'md' | 'sm'
}

type InputSizes = {
  large: InputSize
  middle: InputSize
  small: InputSize
}

const inputSizes: InputSizes = {
  large: {
    fontSize: ['md', 'xl'],
    padding: [
      [12, 18],
      [14, 20],
    ],
    name: 'lg',
  },
  middle: {
    fontSize: ['sm', 'base'],
    padding: [
      [10, 16],
      [12, 18],
    ],
    name: 'md',
  },
  small: {
    fontSize: ['xs', 'sm'],
    padding: [
      [8, 14],
      [10, 16],
    ],
    name: 'sm',
  },
}

const formatPadding = (paddingValue: number[] | number): string =>
  typeof paddingValue === 'number'
    ? spacingIncrement(paddingValue)
    : paddingValue.map((padding) => spacingIncrement(padding)).join(' ')

const ClearLabel = styled.span`
  color: ${({ theme }): string => theme.color.error};
  cursor: pointer;
  font-size: ${({ theme }): string => theme.fontSize.xs};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.base};
  `}
`

export const InputContainer = styled.div<{
  customStyles?: CustomStyles
  $isValid: boolean
  size: SizeType
}>`
  background-color: ${({ customStyles, theme }): string =>
    theme.color[customStyles?.backgroundColor || 'neutral9']};
  border: 1px solid
    ${({ customStyles, theme }): string => theme.color[customStyles?.borderColor || 'neutral8']};
  border-radius: ${({ theme, size }) => {
    switch (size) {
      case 'small':
        return theme.borderRadius.sm
      default:
        return theme.borderRadius.base
    }
  }};
  padding: ${spacingIncrement(6)} ${spacingIncrement(12)};
  transition: border 0.3s;
  ${({ size, theme }): FlattenSimpleInterpolation => {
    const inputSize = inputSizes[size ?? 'middle']
    const className = size === 'middle' ? 'ant-input' : `ant-input-${inputSize.name}`
    return css`
      padding: ${formatPadding(inputSize.padding[0])};
      ${media.desktop`
        padding: ${formatPadding(inputSize.padding[1])};
      `}
      &&& {
        .${className} {
          font-size: ${theme.fontSize[inputSize.fontSize[0]]};
          padding: 0;
          ${media.desktop`
            font-size: ${theme.fontSize[inputSize.fontSize[1]]};
          `}
        }
      }
    `
  }}
  :focus-within {
    border: 1px solid ${({ theme }): string => theme.color.primary};
  }

  ${({ $isValid }) =>
    !$isValid &&
    css`
      &,
      :focus-within {
        border-color: ${({ theme }) => theme.color.error};
      }
    `}
`

export const LabelWrapper = styled.span`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
  `}

  margin-bottom: ${spacingIncrement(10)};
`

export const LabelContainer = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
`

const Wrapper = styled.div<{ textAlign: Alignment }>`
  width: 100%;
  && {
    .ant-input {
      background-color: inherit;
      border: none;
      box-shadow: none;
      color: ${({ theme }): string => theme.color.secondary};
      font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
      text-align: ${({ textAlign }): string => textAlign};
      ::placeholder {
        color: ${({ theme }): string => theme.color.neutral5};
      }
      /* Chrome, Safari, Edge, Opera */
      ::-webkit-outer-spin-button,
      ::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      /* Firefox */
      &[type='number'] {
        -moz-appearance: textfield;
      }
    }

    .ant-input-disabled {
      cursor: not-allowed;
    }

    .ant-input-affix-wrapper {
      background-color: inherit;
      border: none;
      padding: 0;
    }

    .ant-input-affix-wrapper-focused {
      box-shadow: none;
    }
  }
`

const Input: React.FC<Props> = ({
  alignInput = 'left',
  customStyles,
  label,
  className,
  error = false,
  onBlur,
  onClear,
  onFocus,
  secondaryLabel,
  shadowSuffix,
  size = 'large',
  type,
  value,
  ...props
}) => {
  const [focus, setFocus] = useState(false)
  const onFocusMiddleware = (e: FocusEvent<HTMLInputElement>): void => {
    setFocus(true)
    if (onFocus) onFocus(e)
  }

  const onBlurMiddleware = (e: FocusEvent<HTMLInputElement>): void => {
    setFocus(false)
    if (onBlur) onBlur(e)
  }

  const showSuffix =
    !focus &&
    shadowSuffix !== undefined &&
    value !== undefined &&
    `${value}`.length > 0 &&
    shadowSuffix.length > 0

  return (
    <Wrapper textAlign={alignInput} className={className}>
      <LabelContainer>
        <LabelWrapper>{label}</LabelWrapper>
        {onClear ? (
          <ClearLabel onClick={onClear}>Clear</ClearLabel>
        ) : (
          <LabelWrapper>{secondaryLabel}</LabelWrapper>
        )}
      </LabelContainer>
      <InputContainer $isValid={!error} customStyles={customStyles} size={size}>
        <AInput
          aria-invalid={!error}
          onFocus={onFocusMiddleware}
          onBlur={onBlurMiddleware}
          size={size}
          type={showSuffix ? 'text' : type}
          value={showSuffix ? `${value} ${shadowSuffix}` : value}
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...props}
        />
      </InputContainer>
    </Wrapper>
  )
}

export default Input
