import dynamic from 'next/dynamic'
import { Color, useTheme } from 'styled-components'

const SpinFC = dynamic(() => import('antd/lib/spin'))
const LoadingOutlined = dynamic(() => import('@ant-design/icons/LoadingOutlined'))

type Props = {
  color?: keyof Color
  size?: number
}
const Spinner: React.FC<Props> = ({ color = 'primary', size = 24 }) => {
  const theme = useTheme()
  return (
    <SpinFC
      indicator={<LoadingOutlined style={{ fontSize: size, color: theme.color[color] }} spin />}
      spinning
    />
  )
}

export default Spinner
