import { SwitchProps } from 'antd'
import styled, { Color } from 'styled-components'
import { ComponentType } from 'react'
import dynamic from 'next/dynamic'
import { spacingIncrement } from '../../common-utils'

const ASwitch: ComponentType<SwitchProps> = dynamic(() =>
  import('antd').then(({ Switch }) => Switch)
)

type Props = {
  color?: keyof Color
}

const Wrapper = styled.div<Required<Props>>`
  &&& {
    .ant-switch {
      align-items: flex-start;
      background-color: ${({ theme }): string => theme.color.neutral5};
      box-shadow: none;
      display: flex;
      height: ${spacingIncrement(20)};
      min-width: ${spacingIncrement(30)};
      outline: none;
      width: ${spacingIncrement(30)};
      padding: ${spacingIncrement(2)};
    }
    .ant-switch-handle {
      background-color: ${({ theme }): string => theme.color.switchHandler};
      border-radius: 100%;
      height: ${spacingIncrement(16)};
      min-width: ${spacingIncrement(16)};
      position: static;
      transition: all 0.2s ease-in-out;
      width: ${spacingIncrement(16)};
      z-index: 1;
      :before {
        display: none;
      }
    }
    .ant-click-animating-node,
    .ant-switch-inner {
      display: none;
    }
    .ant-switch-checked {
      background-color: ${({ theme, color }): string => theme.color[color]};
      justify-content: flex-end;
    }
  }
`

const Switch: React.FC<Props & SwitchProps> = ({ color = 'primary', ...props }) => (
  <Wrapper color={color}>
    {/* eslint-disable-next-line react/jsx-props-no-spreading */}
    <ASwitch {...props} />
  </Wrapper>
)

export default Switch
