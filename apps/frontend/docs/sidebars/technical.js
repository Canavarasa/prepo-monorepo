function makeReworkItem(id) {
  return {
    type: 'doc',
    id,
    className: 'rework',
  }
}

function makeSectionTitle(text, icon) {
  return {
    type: 'html',
    value: `<p class="sidebar-section-title"><span>${icon}</span>${text}</p>`,
    defaultStyle: true,
    className: 'sidebar-section-title-wrapper',
  }
}

module.exports = [
  makeSectionTitle('Protocol', '⚙️'),
  makeReworkItem('technical/protocol/glossary'),
  makeReworkItem('technical/protocol/market-parameters'),
  makeReworkItem('technical/protocol/formulas'),
  makeReworkItem('technical/protocol/protocol-owned-liquidity'),
  makeReworkItem('technical/protocol/liquidity-strategy'),
  makeReworkItem('technical/protocol/arbitrage-bot'),
  makeReworkItem('technical/protocol/roadmap'),
  makeReworkItem('technical/protocol/faq'),

  makeSectionTitle('Smart Contracts', '📝'),
  makeReworkItem('technical/smart-contracts/architecture'),
  makeReworkItem('technical/smart-contracts/tech-stack'),
  makeReworkItem('technical/smart-contracts/testing'),
  makeReworkItem('technical/smart-contracts/style-guide'),
  makeReworkItem('technical/smart-contracts/faq'),

  makeSectionTitle('Frontend', '💻'),
  makeReworkItem('technical/frontend/tech-stack'),
  makeReworkItem('technical/frontend/url-parameters'),
  makeReworkItem('technical/frontend/decentralized-frontend'),
  makeReworkItem('technical/frontend/integrations'),
  makeReworkItem('technical/frontend/subgraphs'),
  makeReworkItem('technical/frontend/faq'),
]
