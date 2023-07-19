import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const ChevronLeftIcon: React.FC<Props> = ({ width = '16', height = '16', onClick }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    onClick={onClick}
  >
    <path
      d="M7.23326 8L11.0252 3.92897C11.4361 3.48788 11.4361 2.77191 11.0252 2.33082C10.6143 1.88973 9.94746 1.88973 9.53661 2.33082L4.95769 7.24674C4.56967 7.66332 4.56967 8.33774 4.95769 8.75326L9.53661 13.6692C9.94746 14.1103 10.6143 14.1103 11.0252 13.6692C11.4361 13.2281 11.4361 12.5121 11.0252 12.071L7.23326 8Z"
      fill="currentColor"
    />
  </svg>
)

export default ChevronLeftIcon
