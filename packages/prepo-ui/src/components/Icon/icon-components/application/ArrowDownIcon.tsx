import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const ArrowDownIcon: React.FC<Props> = ({ width = '18', height = '18', onClick }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    onClick={onClick}
  >
    <path
      d="M9 3.75V14.25"
      stroke="currentColor"
      strokeWidth="1.33333"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14.25 9L9 14.25L3.75 9"
      stroke="currentColor"
      strokeWidth="1.33333"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export default ArrowDownIcon
