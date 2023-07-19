import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const PreEthIcon: React.FC<Props> = ({ width = '48', height = '48', onClick }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    fill="none"
    viewBox="0 0 24 24"
    onClick={onClick}
  >
    <g clipPath="url(#clip0_23648_86706)">
      <rect width="24" height="24" fill="#454699" rx="12" />
      <g clipPath="url(#clip1_23648_86706)">
        <path
          fill="#454699"
          d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12z"
        />
        <path fill="#fff" fillOpacity="0.602" d="M11.999 3v6.505l5.497 2.456L12 3z" />
        <path fill="#fff" d="M11.998 3L6.5 11.961l5.498-2.456V3z" />
        <path fill="#fff" fillOpacity="0.602" d="M11.999 16.176v4.42l5.501-7.611-5.501 3.191z" />
        <path fill="#fff" d="M11.998 20.596v-4.42L6.5 12.985l5.498 7.611z" />
        <path fill="#fff" fillOpacity="0.2" d="M11.999 15.153l5.497-3.192L12 9.506v5.647z" />
        <path fill="#fff" fillOpacity="0.602" d="M6.5 11.961l5.498 3.192V9.506L6.5 11.961z" />
      </g>
    </g>
    <defs>
      <clipPath id="clip0_23648_86706">
        <rect width="24" height="24" fill="#fff" rx="12" />
      </clipPath>
      <clipPath id="clip1_23648_86706">
        <path fill="#fff" d="M0 0H24V24H0z" />
      </clipPath>
    </defs>
  </svg>
)

export default PreEthIcon
