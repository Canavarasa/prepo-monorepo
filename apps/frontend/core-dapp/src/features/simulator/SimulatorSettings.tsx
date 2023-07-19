import { Input as BaseInput, spacingIncrement } from 'prepo-ui'
import { InputContainer, LabelContainer } from 'prepo-ui/src/components/Input'
import styled from 'styled-components'
import { RangeValidity } from './SimulatorPage'
import Card from '../../components/Card'
import { FormValue } from '../../hooks/useFormValue'

const ALLOWED_DECIMAL_SEPARATORS = ['.', ',']

const Wrapper = styled(Card)`
  .ant-card-body {
    display: flex;
    flex-direction: column;
    gap: ${spacingIncrement(18)};
    :after,
    :before {
      display: none;
    }
  }
  width: 100%;
`

const InputGroup = styled.fieldset``

const Label = styled.legend`
  color: ${({ theme }): string => theme.color.neutral2};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  margin-bottom: ${spacingIncrement(4)};
`

const Inputs = styled.div`
  display: flex;
  gap: ${spacingIncrement(8)};
`

const Input = styled(BaseInput).attrs({ size: 'small' })`
  ${InputContainer} {
    border-radius: ${({ theme }): string => theme.borderRadius.xs};
    padding: ${spacingIncrement(8)} ${spacingIncrement(12)};
  }

  ${LabelContainer} {
    display: none;
  }

  && {
    flex: 1;

    .ant-input {
      font-size: ${({ theme }): string => theme.fontSize.sm};
      font-weight: ${({ theme }): number => theme.fontWeight.medium};
      line-height: ${spacingIncrement(20)};
    }

    .ant-input-suffix {
      color: ${({ theme }) => theme.color.neutral1};
    }
  }
`

export const Title = styled.h2`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.base};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
`

const NumberInput: React.FC<{
  isValid: boolean
  max: number
  min: number
  suffix: string
  value: FormValue<string>
}> = ({ isValid, max, min, suffix, value: { value, setValue } }) => (
  <Input
    error={!isValid}
    onChange={(e) => {
      if (!Number.isNaN(+e.target.value)) {
        setValue(e.target.value)
      }
    }}
    onKeyDown={(e) => {
      if (!(e.target instanceof HTMLInputElement)) return

      if (e.key === '-') {
        e.preventDefault()
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const nextValue = +e.target.value + 1
        setValue(`${nextValue <= max ? nextValue : max}`)
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const nextValue = +e.target.value - 1
        setValue(`${nextValue >= min ? nextValue : min}`)
        return
      }

      if (ALLOWED_DECIMAL_SEPARATORS.includes(e.key)) {
        e.preventDefault()
        setValue(`${e.target.value}.`)
      }
    }}
    pattern="[0-9\.,]"
    suffix={suffix}
    type="text"
    value={value}
  />
)

export const SimulatorSettings: React.FC<{
  payoutMax: FormValue<string>
  payoutMin: FormValue<string>
  payoutRangeValidity: RangeValidity
  valuationMax: FormValue<string>
  valuationMin: FormValue<string>
  valuationRangeValidity: RangeValidity
}> = ({
  payoutMax,
  payoutMin,
  payoutRangeValidity: [payoutMinValid, payoutMaxValid],
  valuationMax,
  valuationMin,
  valuationRangeValidity: [valuationMinValid, valuationMaxValid],
}) => (
  <Wrapper>
    <Title>Settings</Title>

    <InputGroup>
      <Label>Valuation Range</Label>
      <Inputs>
        <NumberInput
          isValid={valuationMinValid}
          max={Number.isNaN(valuationMax.value) ? 1000 : +valuationMax.value - 1}
          min={1}
          suffix="B"
          value={valuationMin}
        />
        <NumberInput
          isValid={valuationMaxValid}
          max={1000}
          min={Number.isNaN(valuationMin.value) ? 0 : +valuationMin.value + 1}
          suffix="B"
          value={valuationMax}
        />
      </Inputs>
    </InputGroup>

    <InputGroup>
      <Label>Payout Range</Label>
      <Inputs>
        <NumberInput
          isValid={payoutMinValid}
          max={Number.isNaN(payoutMax.value) ? 100 : +payoutMax.value - 1}
          min={0}
          suffix="%"
          value={payoutMin}
        />
        <NumberInput
          isValid={payoutMaxValid}
          max={100}
          min={Number.isNaN(payoutMin.value) ? 0 : +payoutMin.value + 1}
          suffix="%"
          value={payoutMax}
        />
      </Inputs>
    </InputGroup>
  </Wrapper>
)
