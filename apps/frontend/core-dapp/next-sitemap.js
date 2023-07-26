const siteUrl = 'https://prepo.eth.limo/'

module.exports = {
  siteUrl: process.env.SITE_URL ?? siteUrl,
  generateRobotsTxt: true,
}
