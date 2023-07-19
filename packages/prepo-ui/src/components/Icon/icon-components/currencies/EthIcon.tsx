import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const EthIcon: React.FC<Props> = ({ width = '48', height = '48', onClick }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    onClick={onClick}
  >
    <g clipPath="url(#clip0_23613_205771)">
      <path
        d="M24 48C37.2548 48 48 37.2548 48 24C48 10.7452 37.2548 0 24 0C10.7452 0 0 10.7452 0 24C0 37.2548 10.7452 48 24 48Z"
        fill="#627EEA"
      />
      <path d="M24.7471 6V19.305L35.9926 24.33L24.7471 6Z" fill="white" fillOpacity="0.602" />
      <path d="M24.747 6L13.5 24.33L24.747 19.305V6Z" fill="white" />
      <path
        d="M24.7471 32.952V41.9925L36.0001 26.424L24.7471 32.952Z"
        fill="white"
        fillOpacity="0.602"
      />
      <path d="M24.747 41.9925V32.9504L13.5 26.424L24.747 41.9925Z" fill="white" />
      <path
        d="M24.7471 30.8595L35.9926 24.33L24.7471 19.308V30.8595Z"
        fill="white"
        fillOpacity="0.2"
      />
      <path d="M13.5 24.33L24.747 30.8595V19.308L13.5 24.33Z" fill="white" fillOpacity="0.602" />
    </g>
    <defs>
      <clipPath id="clip0_23613_205771">
        <rect width="48" height="48" fill="white" />
      </clipPath>
    </defs>
  </svg>
)

export default EthIcon
