import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name' | 'onClick'>

const ExclamationTriangle: React.FC<Props> = ({ width = '24', height = '24' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 20 20"
    fill="transparent"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill="currentColor"
      d="M10 0C4.467 0 0 4.467 0 10s4.467 10 10 10 10-4.467 10-10S15.533 0 10 0zM9 5h2v6H9V5zm0 8h2v2H9v-2z"
    />
  </svg>
)

export default ExclamationTriangle
