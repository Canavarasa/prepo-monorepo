import { NextPage } from 'next'
import SEO from '../components/SEO'
import SimulatorPage from '../features/simulator/SimulatorPage'

const Simulator: NextPage = () => (
  <>
    <SEO
      title="Simulator | prePO"
      description="Simulate your prePO trades"
      ogImageUrl="/prepo-og-image.png"
    />
    <SimulatorPage />
  </>
)

export default Simulator
