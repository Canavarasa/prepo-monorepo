import { Button, Simulator, spacingIncrement, SimulatorDataProps } from 'prepo-ui'
import styled, { css } from 'styled-components'
import { ComponentType } from 'react'
import Card from '../../components/Card'
import { FormValue } from '../../hooks/useFormValue'
import { DirectionRadio } from '../../components/DirectionRadio'
import Skeleton from '../../components/Skeleton'

const ResetButton = styled(Button).attrs({ size: 'xs', type: 'ghost' })`
  &&& {
    .ant-btn {
      background-color: ${({ theme }): string => theme.color.purpleStroke};
      border: none;
      border-radius: ${({ theme }): string => theme.borderRadius['3xs']};
      color: ${({ theme }): string => theme.color.primaryLight};

      ${({ theme }) =>
        theme.isDarkMode
          ? css`
              :hover {
                color: ${theme.color.primary};
              }
            `
          : css``}
    }
  }
`

const Wrapper = styled(Card)`
  --simulator-border-radius: ${({ theme }): string => theme.borderRadius.md};

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

const SimulatorWrapper = styled.div`
  align-items: center;
  border: 1px solid ${({ theme }): string => theme.color.neutral7};
  border-radius: var(--simulator-border-radius);
  display: flex;
  justify-content: center;
  min-height: ${spacingIncrement(136)};
  padding: ${spacingIncrement(8)} ${spacingIncrement(4)};
`

const MarketNotAvailable = styled.span`
  color: ${({ theme }): string => theme.color.neutral2};
`

const SimulatorSkeleton = styled(Skeleton).attrs({
  width: '100%',
  height: '136px',
})`
  .react-loading-skeleton {
    border-radius: var(--simulator-border-radius);
  }
`

type FixedOrFormValue<T> = T | FormValue<T>

function wrapAsFormValue<T>(fixedOrForm: FixedOrFormValue<T>): Omit<FormValue<T>, 'setValue'> & {
  setValue: FormValue<T>['setValue'] | undefined
} {
  if (typeof fixedOrForm === 'object' && 'setValue' in fixedOrForm) return fixedOrForm

  return {
    isDirty: false,
    reset: () => {},
    setValue: undefined,
    value: fixedOrForm,
  }
}

export const SimulatorCard: React.FC<{
  className?: string
  data: SimulatorDataProps | undefined
  direction: 'long' | 'short'
  entryDistance: FixedOrFormValue<number | undefined>
  exitDistance: FixedOrFormValue<number | undefined>
  HeaderComponent: ComponentType<{ resetButton: JSX.Element }>
  marketResolved?: boolean
  onChangeDirection?: (newDirection: 'long' | 'short') => void
}> = ({
  className,
  children,
  data,
  direction,
  entryDistance: entryDistanceFormValue,
  exitDistance: exitDistanceFormValue,
  HeaderComponent,
  marketResolved = false,
  onChangeDirection,
}) => {
  const {
    isDirty: isEntryDistanceDirty,
    reset: resetEntryDistance,
    setValue: setEntryDistance,
    value: entryDistance,
  } = wrapAsFormValue(entryDistanceFormValue)
  const {
    isDirty: isExitDistanceDirty,
    reset: resetExitDistance,
    setValue: setExitDistance,
    value: exitDistance,
  } = wrapAsFormValue(exitDistanceFormValue)

  return (
    <Wrapper className={className}>
      <HeaderComponent
        resetButton={
          <>
            {(isEntryDistanceDirty || isExitDistanceDirty) && (
              <ResetButton
                onClick={(): void => {
                  resetEntryDistance()
                  resetExitDistance()
                }}
              >
                Reset
              </ResetButton>
            )}
          </>
        }
      />
      {onChangeDirection && (
        <DirectionRadio direction={direction} onChangeDirection={onChangeDirection} size="sm" />
      )}
      {data === undefined || entryDistance === undefined || exitDistance === undefined ? (
        <SimulatorSkeleton />
      ) : (
        <SimulatorWrapper>
          {marketResolved ? (
            <MarketNotAvailable>Market Ended</MarketNotAvailable>
          ) : (
            <Simulator
              data={data}
              direction={direction}
              entryDistance={entryDistance}
              exitDistance={exitDistance}
              isEntryDistanceDirty={isEntryDistanceDirty}
              isExitDistanceDirty={isExitDistanceDirty}
              onChangeEntryDistance={setEntryDistance}
              onChangeExitDistance={setExitDistance}
            />
          )}
        </SimulatorWrapper>
      )}
      {children}
    </Wrapper>
  )
}
