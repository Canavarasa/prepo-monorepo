import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name' | 'onClick'>

const TradingLiquidityIcon: React.FC<Props> = ({ width = '12', height = '12' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8.99745 4.7971L5.99752 1L2.9975 4.7971C2.4975 5.42395 2.23161 5.968 2.07705 6.67065C1.9225 7.3733 2.00156 8.10165 2.30423 8.7636C2.6069 9.42555 3.11959 9.99135 3.77744 10.3895C4.43529 10.7875 5.20876 11 5.99999 11C6.79126 11 7.56465 10.7875 8.22252 10.3895C8.88039 9.99135 9.39305 9.42555 9.69578 8.7636C9.99845 8.10165 10.0775 7.3733 9.92292 6.67065C9.76838 5.968 9.49745 5.42395 8.99745 4.7971Z"
      fill="currentColor"
    />
  </svg>
)

export default TradingLiquidityIcon
