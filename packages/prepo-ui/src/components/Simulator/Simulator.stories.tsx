import { Story } from '@storybook/react'
import Simulator, { SimulatorProps } from './Simulator'

export default {
  title: 'Components/Simulator',
  component: Simulator,
  argTypes: {
    direction: {
      name: 'Direction',
      type: { name: 'string', required: true },
      defaultValue: 'long',
      control: {
        type: 'radio',
        options: ['long', 'short'],
      },
    },
    payoutRange: {
      name: 'Payout Range',
      defaultValue: [0.2, 0.8],
    },
    valuationRange: {
      name: 'Valuation Range',
      defaultValue: [1000000000, 100000000000],
    },
    entryLongTokenPrice: {
      name: 'Entry long token price',
      defaultValue: 0.5,
    },
    exitLongTokenPrice: {
      name: 'Exit long token price',
      defaultValue: 0.75,
    },
  },
}

// eslint-disable-next-line react/jsx-props-no-spreading
const Template: Story<SimulatorProps> = (args) => <Simulator {...args} />

export const DefaultSimulator = Template.bind({})
