import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const LidoETHIcon: React.FC<Props> = ({ width = '24', height = '24', onClick }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g clipPath="url(#clip0_23652_229775)">
      <path
        d="M24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24C18.6274 24 24 18.6274 24 12Z"
        fill="#00A3FF"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 3L16 9.55822L11.9997 12L8 9.55815L12 3ZM9.2245 9.24799L12 4.69745L14.7755 9.24799L11.9998 10.9423L9.2245 9.24799Z"
        fill="white"
      />
      <path
        d="M11.9994 13.7354L7.07791 11.0001L6.94353 11.2007C5.42775 13.4632 5.76631 16.4263 7.75747 18.3246C10.1005 20.5585 13.8995 20.5585 16.2425 18.3246C18.2337 16.4263 18.5723 13.4632 17.0565 11.2007L16.922 11L11.9994 13.7354Z"
        fill="white"
      />
    </g>
    <defs>
      <clipPath id="clip0_23652_229775">
        <rect width="24" height="24" fill="white" />
      </clipPath>
    </defs>
  </svg>
)

export default LidoETHIcon
