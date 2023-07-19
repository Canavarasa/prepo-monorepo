import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const WethIcon: React.FC<Props> = ({ width = '48', height = '48', onClick }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    onClick={onClick}
  >
    <rect width="48" height="48" rx="24" fill="white" />
    <g clipPath="url(#clip0_23613_205739)">
      <path
        d="M23.9966 5L23.7344 5.86597V30.9922L23.9966 31.2465L35.9928 24.3524L23.9966 5Z"
        fill="#343434"
      />
      <path d="M23.9965 5L12 24.3524L23.9965 31.2465V19.0509V5Z" fill="#8C8C8C" />
      <path
        d="M23.9964 33.4547L23.8486 33.6299V42.5802L23.9964 42.9996L35.9999 26.5641L23.9964 33.4547Z"
        fill="#3C3C3B"
      />
      <path d="M23.9965 42.9996V33.4547L12 26.5641L23.9965 42.9996Z" fill="#8C8C8C" />
      <path d="M23.9966 31.2465L35.9928 24.3523L23.9966 19.0509V31.2465Z" fill="#141414" />
      <path d="M12 24.3523L23.9965 31.2465V19.0509L12 24.3523Z" fill="#393939" />
    </g>
    <defs>
      <clipPath id="clip0_23613_205739">
        <rect width="24" height="38" fill="white" transform="translate(12 5)" />
      </clipPath>
    </defs>
  </svg>
)

export default WethIcon
