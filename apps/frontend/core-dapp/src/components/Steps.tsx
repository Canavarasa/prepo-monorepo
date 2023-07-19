import type { StepsProps, StepProps } from 'antd'
import { spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { ComponentType } from 'react'
import dynamic from 'next/dynamic'

const ASteps: ComponentType<StepsProps> = dynamic(() => import('antd').then(({ Steps }) => Steps))

const AStep: ComponentType<StepProps> = dynamic(() =>
  import('antd').then(({ Steps }) => Steps.Step)
)

type Props = {
  steps: number
  currentStep: number
}

const StyledSteps = styled(ASteps)`
  align-self: center;
  margin-top: ${spacingIncrement(14)};
  max-width: ${spacingIncrement(80)};
  .ant-steps-item-icon {
    height: ${spacingIncrement(20)};
    .ant-steps-icon {
      top: -2.5px;
    }
    margin-right: 0;
    width: ${spacingIncrement(20)};
  }

  &&& .ant-steps-item-active > .ant-steps-item-container > .ant-steps-item-icon > .ant-steps-icon {
    color: ${({ theme }): string => theme.color.white};
  }
  &&& .ant-steps-item-process {
    padding-left: ${spacingIncrement(4)};
    .ant-steps-item-icon {
      background: ${({ theme }): string => theme.color.primary};
      border-color: ${({ theme }): string => theme.color.primary};
    }
    .ant-steps-item-title {
      padding-right: ${spacingIncrement(4)};
    }
    .ant-steps-item-title::after {
      background-color: ${({ theme }): string => theme.color.neutral5};
      top: ${spacingIncrement(10)};
    }
  }
  &&&&&& .ant-steps-item-finish {
    .ant-steps-item-container:hover {
      border-color: ${({ theme }): string => theme.color.darkPrimary};
    }

    .ant-steps-item-icon {
      border-color: ${({ theme }): string => theme.color.primary};
    }

    svg {
      fill: ${({ theme }): string => theme.color.primary};
    }
    .ant-steps-item-title {
      padding-right: ${spacingIncrement(4)};
    }
    .ant-steps-item-title::after {
      background-color: ${({ theme }): string => theme.color.primary};
      top: ${spacingIncrement(10)};
    }
  }
  &&& {
    .ant-steps-item-wait {
      padding-left: ${spacingIncrement(4)};
    }
    .ant-steps-item-icon {
      background-color: transparent;
      border-color: ${({ theme }): string => theme.color.neutral5};
      .ant-steps-icon {
        color: ${({ theme }): string => theme.color.neutral5};
      }
    }
  }
`

const Steps: React.FC<Props> = ({ currentStep, steps }) => (
  <StyledSteps current={currentStep} size="small" responsive={false}>
    {new Array(steps).fill(0).map((_, key) => (
      // eslint-disable-next-line react/no-array-index-key
      <AStep key={key} />
    ))}
  </StyledSteps>
)

export default Steps
