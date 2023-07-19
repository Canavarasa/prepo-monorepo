import styled, { css, FlattenSimpleInterpolation } from 'styled-components'
import { PositionType } from '../../utils/prepo.types'

type Props = {
  positionType: PositionType
  withBackground?: boolean
  className?: string
}

const Wrapper = styled.div<Props>`
  color: ${({ theme, positionType }): string => theme.positionType[positionType]};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.regular};
  text-transform: capitalize;

  ${({ positionType, theme, withBackground }): FlattenSimpleInterpolation | undefined =>
    withBackground && positionType !== 'liquidity'
      ? css`
          background: ${positionType === 'long'
            ? theme.color.accentSuccess
            : theme.color.accentError};
          border-radius: 0.25rem;
          padding: 0 0.25rem;
        `
      : undefined};
`

const PositionLabel: React.FC<Props> = ({ className, positionType, withBackground }) => (
  <Wrapper positionType={positionType} className={className} withBackground={withBackground}>
    {positionType}
  </Wrapper>
)

export default PositionLabel
