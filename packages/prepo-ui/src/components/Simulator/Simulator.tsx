import { useEffect, useMemo, useRef, useState } from 'react'
import clamp from 'lodash/fp/clamp'
import { calculateValuation } from 'prepo-utils'
import styled, { useTheme } from 'styled-components'
import Handle from './Handle'
import { spacingIncrement } from '../../common-utils'

export type Range = [number, number]

const formatValuation = (valuation: number): string =>
  Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(valuation)

export type SimulatorDataProps = {
  valuationRange: Range
  payoutRange: Range
}

export type SimulatorProps = {
  data: SimulatorDataProps
  direction: 'long' | 'short'
  // Distance is a number between 0-1 that represents the separation of the
  // marker from the least favorable valuation (min valuation for long, and max
  // valuation for short).
  entryDistance: number
  exitDistance: number
  isEntryDistanceDirty: boolean
  isExitDistanceDirty: boolean
  onChangeEntryDistance?: (x: number) => void
  onChangeExitDistance?: (x: number) => void
}

const Wrapper = styled.div`
  padding: ${spacingIncrement(54)} ${spacingIncrement(28)};
  width: 100%;
`

const Track = styled.div`
  background-color: ${({ theme }): string => theme.color.neutral8};
  border-radius: ${spacingIncrement(10)};
  height: ${spacingIncrement(10)};
  position: relative;
  width: 100%;
`

const TrackProgress = styled.div`
  border: solid 2px ${({ theme }): string => theme.color.neutral7};
  border-radius: ${spacingIncrement(10)};
  height: 100%;
  position: absolute;
`

const withinZeroAndOne = clamp(0, 1)

export function mapDistanceToPrice({
  data,
  distance,
}: {
  data: SimulatorDataProps | undefined
  distance: number | undefined
}): number | undefined {
  if (!data || distance === undefined) return undefined
  const { payoutRange } = data
  return distance * (payoutRange[1] - payoutRange[0]) + payoutRange[0]
}

export function mapPriceToDistance({
  data,
  price,
}: {
  data: SimulatorDataProps | undefined
  price: number | undefined
}): number | undefined {
  if (!data || price === undefined) return undefined
  const { payoutRange } = data
  return withinZeroAndOne((price - payoutRange[0]) / (payoutRange[1] - payoutRange[0]))
}

function invertIfShort(value: number | undefined, direction: 'long' | 'short'): number | undefined {
  if (value === undefined) return undefined
  if (direction === 'long') return value
  return 1 - value
}

const Simulator: React.FC<SimulatorProps> = ({
  data,
  direction,
  entryDistance,
  exitDistance,
  isExitDistanceDirty,
  isEntryDistanceDirty,
  onChangeEntryDistance,
  onChangeExitDistance,
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const { color } = useTheme()

  const [trackWidth, setTrackWidth] = useState<number>()

  const getValuationForPrice = (longTokenPrice: number | undefined): number | undefined => {
    if (longTokenPrice === undefined) return undefined
    const { payoutRange, valuationRange } = data
    return calculateValuation({ longTokenPrice, payoutRange, valuationRange })
  }

  const mapPxToDistance = (px: number): number => {
    if (trackWidth === undefined) return 0

    const position = px / trackWidth
    return direction === 'long' ? position : 1 - position
  }

  useEffect(() => {
    const handleTrackResize = (): void => {
      if (trackRef.current) setTrackWidth(trackRef.current.clientWidth)
    }

    handleTrackResize()
    const ro = new ResizeObserver(handleTrackResize)
    if (trackRef.current) ro.observe(trackRef.current)

    return () => {
      ro.disconnect()
    }
  }, [])

  const entryX = invertIfShort(entryDistance, direction)
  const exitX = invertIfShort(exitDistance, direction)

  const entryPrice = mapDistanceToPrice({ data, distance: entryDistance })
  const exitPrice = mapDistanceToPrice({ data, distance: exitDistance })

  const entryLongPrice = invertIfShort(entryPrice, direction)
  const exitLongPrice = invertIfShort(exitPrice, direction)

  const entryValuation = getValuationForPrice(entryLongPrice)
  const exitValuation = getValuationForPrice(exitLongPrice)

  const trackBarPosition = useMemo(() => {
    if (trackWidth === undefined) return {}

    if (
      entryValuation === undefined ||
      exitValuation === undefined ||
      entryX === undefined ||
      exitX === undefined
    )
      return { left: 0, right: 0 }
    // compute the left, right of track's colored bar
    const left = Math.min(entryX, exitX) * trackWidth
    const right = trackWidth - Math.max(entryX, exitX) * trackWidth

    return { left, right }
  }, [entryValuation, entryX, exitValuation, exitX, trackWidth])

  const dynamicColor = useMemo(() => {
    // compute background color of track bar
    // default to green
    if (
      entryValuation === undefined ||
      exitValuation === undefined ||
      entryX === undefined ||
      exitX === undefined
    )
      return 'success'
    const profitableExit = direction === 'short' ? entryX >= exitX : exitX >= entryX

    return profitableExit ? 'success' : 'error'
  }, [direction, entryValuation, entryX, exitValuation, exitX])

  const defaultEntry = direction === 'long' ? 0 : 1

  const defaultExit = direction === 'long' ? 1 : 0

  return (
    <Wrapper>
      <Track ref={trackRef}>
        {trackWidth !== undefined && (
          <>
            <TrackProgress style={{ ...trackBarPosition, backgroundColor: color[dynamicColor] }} />
            <Handle
              x={(entryX ?? defaultEntry) * trackWidth}
              isDirty={isEntryDistanceDirty}
              isEntry
              color="secondary"
              value={
                entryValuation === undefined || Number.isNaN(entryValuation)
                  ? '???'
                  : `$${formatValuation(entryValuation)}`
              }
              onChange={
                onChangeEntryDistance &&
                ((px) => {
                  onChangeEntryDistance(mapPxToDistance(px))
                })
              }
            />
            <Handle
              // exit handle defaults to the right of slider when undefined (indicate max profit)
              x={(exitX ?? defaultExit) * trackWidth}
              isDirty={isExitDistanceDirty}
              color={dynamicColor}
              value={
                exitValuation === undefined || Number.isNaN(exitValuation)
                  ? '???'
                  : `$${formatValuation(exitValuation)}`
              }
              onChange={
                onChangeExitDistance &&
                ((px) => {
                  onChangeExitDistance(mapPxToDistance(px))
                })
              }
            />
          </>
        )}
      </Track>
    </Wrapper>
  )
}

export default Simulator
