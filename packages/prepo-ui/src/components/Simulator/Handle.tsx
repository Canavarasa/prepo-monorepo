import styled, { Color } from 'styled-components'
import Draggable from 'react-draggable'
import { spacingIncrement } from '../../common-utils'
import Flex from '../Flex'

type Props = {
  x: number
  value: string
  color: keyof Color
  onChange?: (x: number) => void
  isDirty: boolean
  isEntry?: boolean
}

const Wrapper = styled.div<{ $isEntry?: boolean; $disabled: boolean }>`
  ${({ $isEntry }): string => ($isEntry ? 'bottom: 0' : 'top: 0')};
  cursor: ${({ $disabled }) => ($disabled ? 'initial' : 'grab')};
  position: absolute;
  transform: translateX(-50%);
`

const Label = styled.p`
  font-size: ${({ theme }): string => theme.fontSize.xs};
`

const Value = styled.p`
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
`

const Pin = styled.div<{ $color: keyof Color }>`
  background-color: ${({ $color, theme }): string => theme.color[$color]};
  border: solid 2px ${({ theme }): string => theme.color.purpleStroke};
  border-radius: ${spacingIncrement(10)};
  height: ${spacingIncrement(20)};
  position: relative;
  width: ${spacingIncrement(8)};
  z-index: 1;
`

const DoughnutBorder = styled.div<{ $isEntry?: boolean }>`
  background-color: ${({ theme }): string => theme.color.purpleStroke};
  border-radius: ${spacingIncrement(16)};
  cursor: grab;
  ${({ $isEntry }): string => ($isEntry ? 'bottom: 0' : 'top: 0')};
  height: ${spacingIncrement(18)};
  left: 50%;
  position: absolute;
  transform: translateX(-50%)
    ${({ $isEntry }): string => ($isEntry ? 'translateY(-5px)' : 'translateY(5px)')};
  width: ${spacingIncrement(18)};
  z-index: 0;
`

const Doughnut = styled.div<{ $color: keyof Color; $isEntry?: boolean }>`
  background-color: ${({ theme }): string => theme.color.neutral9};
  border: solid 4px ${({ $color, theme }): string => theme.color[$color]};
  border-radius: ${spacingIncrement(12)};
  ${({ $isEntry }): string => ($isEntry ? 'bottom: 0' : 'top: 0')};
  height: ${spacingIncrement(14)};
  left: 50%;
  position: absolute;
  transform: translateX(-50%)
    ${({ $isEntry }): string => ($isEntry ? 'translateY(-7px)' : 'translateY(7px)')};
  width: ${spacingIncrement(14)};
  z-index: 2;
`

const DirtyIndicator = styled.span`
  --indicator-gap: ${spacingIncrement(4)};
  --indicator-size: ${spacingIncrement(4)};

  background-color: ${({ theme }): string => theme.color.warning};
  border-radius: 50%;
  height: var(--indicator-size);
  margin-left: calc((var(--indicator-size) + var(--indicator-gap)) * -1);
  margin-right: var(--indicator-gap);
  width: var(--indicator-size);
`

const TextWrapper = styled.div<{ $color: keyof Color; $disabled: boolean; $isEntry?: boolean }>`
  ${({ $isEntry }): string => ($isEntry ? 'bottom: 0' : 'top: 0')};
  align-items: center;
  color: ${({ $color, theme }): string => theme.color[$color]};
  cursor: ${({ $disabled }) => ($disabled ? 'initial' : 'grab')};
  display: flex;
  flex-direction: ${({ $isEntry }): string => ($isEntry ? 'column' : 'column-reverse')};
  gap: ${spacingIncrement(4)};
  justify-content: center;
  left: 50%;
  position: absolute;
  transform: translateX(-50%)
    ${({ $isEntry }): string => ($isEntry ? 'translateY(-100%)' : 'translateY(100%)')};
  p {
    line-height: 1;
    margin-bottom: 0;
  }
`

const Handle: React.FC<Props> = ({ color, onChange, value, isDirty, isEntry, x }) => (
  <Draggable
    axis="x"
    bounds="parent"
    disabled={!onChange}
    position={{ x, y: 0 }}
    onDrag={(_, data): void => onChange?.(data.x)}
  >
    {/* Wrap with an extra absolute div so the direct child to track has 0 width, and hence exactly precise calculation */}
    <div style={{ position: 'absolute', height: '100%' }}>
      <Wrapper $isEntry={isEntry} $disabled={!onChange}>
        <Pin $color={color} />
        {onChange && (
          <>
            <DoughnutBorder $isEntry={isEntry} />
            <Doughnut $color={color} $isEntry={isEntry} />
          </>
        )}
        <TextWrapper $color={color} $disabled={!onChange} $isEntry={isEntry}>
          <Flex>
            {isDirty && <DirtyIndicator />}
            <Label>{isEntry ? 'Open' : 'Close'}</Label>
          </Flex>
          <Value>{value}</Value>
        </TextWrapper>
      </Wrapper>
    </div>
  </Draggable>
)

export default Handle
