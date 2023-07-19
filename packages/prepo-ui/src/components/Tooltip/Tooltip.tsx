import type { TooltipProps } from 'antd'
import { css } from 'styled-components'
import { ComponentType } from 'react'
import dynamic from 'next/dynamic'
import { centered, spacingIncrement } from '../../common-utils'

const ATooltip: ComponentType<TooltipProps> = dynamic(() =>
  import('antd').then(({ Tooltip }) => Tooltip)
)

export const tooltipStyles = css`
  .ant-tooltip-arrow {
    display: none;
  }

  .ant-tooltip-arrow-content::before {
    display: none;
  }

  .ant-tooltip-inner {
    ${centered};
    background: ${({ theme }): string => theme.color.neutral10};
    background-color: ${({ theme }): string => theme.color.neutral10};
    border: solid 1px ${({ theme }): string => theme.color.neutral7};
    border-radius: 5px;
    box-shadow: ${({ theme }): string => theme.shadow.prepo};
    color: ${({ theme }): string => theme.color.neutral1};
    font-size: ${({ theme }): string => theme.fontSize.xs};
    font-weight: ${({ theme }): number => theme.fontWeight.regular};
    text-align: center;
    z-index: 0;
  }

  .ant-tooltip-arrow-content {
    pointer-events: none;
  }

  .ant-input-affix-wrapper-focused {
    border-color: ${({ theme }): string => theme.color.primary};
    box-shadow: 0 0 0 2px ${({ theme }): string => theme.color.success};
  }

  .ant-tooltip-placement-top {
    padding-bottom: ${spacingIncrement(4)};
  }
`

export default ATooltip
