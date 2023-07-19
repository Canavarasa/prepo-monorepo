const withTM = require('next-transpile-modules')([
  'prepo-constants',
  'prepo-utils',
  'prepo-ui',
  'prepo-stores',
])

const nextConfig = {
  productionBrowserSourceMaps: true,
  experimental: { esmExternals: 'loose' },
  trailingSlash: true,
  compiler: {
    // ssr and displayName are configured by default
    styledComponents: true,
  },
}

module.exports = withTM(nextConfig)
