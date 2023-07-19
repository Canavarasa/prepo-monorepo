import type { TooltipProps } from 'antd'
import styled from 'styled-components'
import { spacingIncrement, media, Icon, centered } from 'prepo-ui'
import { ComponentType } from 'react'
import dynamic from 'next/dynamic'

const ATooltip: ComponentType<TooltipProps> = dynamic(() =>
  import('antd').then(({ Tooltip }) => Tooltip)
)

const Wrapper = styled.div`
  align-items: center;
  display: flex;
`

const Title = styled.span`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  line-height: 20px;
  margin: 0;

  ${media.tablet`
    font-size: ${({ theme }): string => theme.fontSize.base};
  `}
`

const IconWrapper = styled.span`
  display: flex;
  margin-left: ${spacingIncrement(5)};
`

const IconComponent = styled(Icon)`
  ${centered}
  svg {
    height: ${spacingIncrement(13)};
    width: ${spacingIncrement(13)};
    ${media.desktop`
      height: ${spacingIncrement(20)};
      width: ${spacingIncrement(20)};
    `}
  }
`

type Props = {
  className?: string
  tooltip?: React.ReactNode
}

const Subtitle: React.FC<Props> = ({ tooltip, className, children }) => (
  <Wrapper className={className}>
    <Title>{children}</Title>
    {tooltip && (
      <ATooltip title={tooltip}>
        <IconWrapper>
          <IconComponent name="info" color="neutral5" />
        </IconWrapper>
      </ATooltip>
    )}
  </Wrapper>
)

export default Subtitle
