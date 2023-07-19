import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name' | 'onClick'>

const TradingVolumeIcon: React.FC<Props> = ({ width = '12', height = '12' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1.5 5.16428C1.5 4.63172 1.93173 4.2 2.46429 4.2V4.2C2.99685 4.2 3.42857 4.63173 3.42857 5.16429V10.5H1.5V5.16428ZM5.1 2.4C5.1 1.90294 5.50294 1.5 6 1.5V1.5C6.49706 1.5 6.9 1.90294 6.9 2.4V10.5H5.1V2.4ZM8.7 7.54286C8.7 7.0458 9.10294 6.64286 9.6 6.64286V6.64286C10.0971 6.64286 10.5 7.0458 10.5 7.54286V10.5H8.7V7.54286Z"
      fill="currentColor"
    />
  </svg>
)

export default TradingVolumeIcon
