import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const ZkSyncIcon: React.FC<Props> = ({ width = '25', height = '24', onClick, isDarkMode }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 400 400"
    width={width}
    height={height}
    onClick={onClick}
  >
    <circle
      cx="200"
      cy="200"
      r="200"
      fill={isDarkMode ? '#212429' : '#EDEEF2'}
      fillRule="evenodd"
      clipRule="evenodd"
    />
    <path
      fill="#4e529a"
      fillRule="evenodd"
      d="M316 199l-66.7-66.4v48.6l-66.2 48.7h66.2v35.5L316 199z"
      clipRule="evenodd"
    />
    <path
      fill="#8c8dfc"
      fillRule="evenodd"
      d="M81 199l66.7 66.4v-48.3l66.2-49.1h-66.2v-35.5L81 199z"
      clipRule="evenodd"
    />
  </svg>
)

export default ZkSyncIcon
