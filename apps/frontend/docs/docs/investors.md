import useBaseUrl from '@docusaurus/useBaseUrl';
import { angelInvestors, institutionalInvestors } from '../src/lib/investors.js'
import Investor from '../src/components/Investor'

# Investors

### 🏢&nbsp; Institutional Investors

<ul className="cols-section">
  {institutionalInvestors.map((investor) => <Investor key={investor.name} investor={investor} />)}
  <p>and more...</p>
</ul>

### 👼&nbsp; Angel Investors

<ul className="cols-section">
  {angelInvestors.map((investor) => <Investor key={investor.name} investor={investor} />)}
  <p>and more...</p>
</ul>
