import styled from 'styled-components'
import { mapDistanceToPrice, media, spacingIncrement, Range } from 'prepo-ui'
import { useState } from 'react'
import { SimulatorCard } from './SimulatorCard'
import { SimulatorSettings } from './SimulatorSettings'
import SimulatorSummary from './SimulatorSummary'
import { FormValue, useFormValue } from '../../hooks/useFormValue'

export type RangeValidity = [boolean, boolean]

const Wrapper = styled.div`
  --cta-card-size: ${spacingIncrement(380)};
  --secondary-card-size: ${spacingIncrement(264)};

  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${spacingIncrement(40)};
  justify-content: center;
  margin: 0 auto;

  > div {
    max-width: var(--cta-card-size);
  }

  ${media.desktop`
    display: grid;
    grid-template-columns: 0 var(--cta-card-size) var(--secondary-card-size);

    > div {
      width: 100%;
    }
  `};

  ${media.largeDesktop`
    grid-template-columns: var(--secondary-card-size) var(--cta-card-size) var(--secondary-card-size);
  `};
`

const Header = styled.div`
  display: flex;
  justify-content: center;
  position: relative;
`

const Title = styled.h1`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.xl};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
`

const HeaderActions = styled.div`
  align-items: center;
  display: flex;
  gap: ${spacingIncrement(4)};
  height: 100%;
  position: absolute;
  right: 0;
`

const HeaderComponent: React.FC<{ resetButton: JSX.Element }> = ({ resetButton }) => (
  <Header>
    <Title>Simulator</Title>
    <HeaderActions>{resetButton}</HeaderActions>
  </Header>
)

/**
 * Validates that a user-provided range (i.e. the valuation range) is within
 * a larger range.
 */
function validateRange({
  capRange: [minCap, maxCap],
  max: { value: max },
  min: { value: min },
}: {
  capRange: [number, number]
  max: FormValue<string>
  min: FormValue<string>
}): RangeValidity {
  if (Number.isNaN(+min) || Number.isNaN(+max)) {
    return [Number.isNaN(+min), Number.isNaN(+max)]
  }

  if (+min >= +max) {
    return [false, false]
  }

  return [+min >= minCap && +min <= maxCap, +max >= minCap && +max <= maxCap]
}

const allValid = ([min, max]: RangeValidity): boolean => min && max

const SimulatorPage: React.FC = () => {
  const [direction, setDirection] = useState<'long' | 'short'>('long')

  const entryDistance = useFormValue<number | undefined>(0.5)
  const exitDistance = useFormValue<number | undefined>(1)

  const payoutMax = useFormValue('90')
  const payoutMin = useFormValue('10')
  const valuationMax = useFormValue('50')
  const valuationMin = useFormValue('5')

  const payoutMultiplier = 0.01
  // TODO support Billions/Millions switch
  const valuationMultiplier = 1_000_000_000

  const valuationRangeValidity = validateRange({
    capRange: [0, 1000],
    max: valuationMax,
    min: valuationMin,
  })

  const payoutRangeValidity = validateRange({
    capRange: [0, 100],
    max: payoutMax,
    min: payoutMin,
  })

  const payoutRange: Range = [
    +payoutMin.value * payoutMultiplier,
    +payoutMax.value * payoutMultiplier,
  ]
  const valuationRange: Range = [
    +valuationMin.value * valuationMultiplier,
    +valuationMax.value * valuationMultiplier,
  ]

  const dataValid = allValid(valuationRangeValidity) && allValid(payoutRangeValidity)
  const data = dataValid ? { payoutRange, valuationRange } : undefined

  return (
    <Wrapper>
      <div />
      <SimulatorCard
        data={data}
        direction={direction}
        entryDistance={entryDistance}
        exitDistance={exitDistance}
        HeaderComponent={HeaderComponent}
        onChangeDirection={setDirection}
      >
        <SimulatorSummary
          direction={direction}
          payoutRange={data?.payoutRange}
          entryPrice={mapDistanceToPrice({
            data,
            distance: entryDistance.value,
          })}
          exitPrice={mapDistanceToPrice({ data, distance: exitDistance.value })}
          // TODO support trade size
          tradeSize={undefined}
        />
      </SimulatorCard>
      <SimulatorSettings
        payoutMax={payoutMax}
        payoutMin={payoutMin}
        payoutRangeValidity={payoutRangeValidity}
        valuationMax={valuationMax}
        valuationMin={valuationMin}
        valuationRangeValidity={valuationRangeValidity}
      />
    </Wrapper>
  )
}

export default SimulatorPage
