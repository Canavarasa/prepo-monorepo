import retry from 'async-retry'
import fetch from 'node-fetch'

const { IPFS_DEPLOY_INFURA__PROJECT_ID, IPFS_DEPLOY_INFURA__PROJECT_SECRET, MAX_PINS } = process.env

if (
  !IPFS_DEPLOY_INFURA__PROJECT_ID ||
  !IPFS_DEPLOY_INFURA__PROJECT_SECRET ||
  !MAX_PINS ||
  Number.isNaN(+MAX_PINS)
) {
  console.log('Missing environment variables')
  process.exit(1)
}

const Authorization = `Basic ${Buffer.from(
  `${IPFS_DEPLOY_INFURA__PROJECT_ID}:${IPFS_DEPLOY_INFURA__PROJECT_SECRET}`
).toString('base64')}`

const pins = await retry(() =>
  fetch('https://ipfs.infura.io:5001/api/v0/pin/ls?type=recursive', {
    method: 'POST',
    headers: {
      Authorization,
    },
  })
).then((response) => response.json())

const cidList = Object.keys(pins.Keys)

if (cidList.length <= MAX_PINS) process.exit(0)

const sortedCidList = (
  await Promise.all(
    cidList.map(async (cid) => ({
      cid,
      time: await retry(() => fetch(`https://cf-ipfs.com/ipfs/${cid}/BUILD_TIME.json`)).then(
        (response) => response.json()
      ),
    }))
  )
)
  .sort((a, b) => a.time - b.time)
  .map(({ cid }) => cid)

const toUnpin = sortedCidList.slice(0, -MAX_PINS)

await Promise.all(
  toUnpin.map(async (cid) => {
    await retry(() =>
      fetch(`https://ipfs.infura.io:5001/api/v0/pin/rm?arg=${cid}`, {
        method: 'POST',
        headers: {
          Authorization,
        },
      })
    )

    console.log(`Unpinned ${cid}`)
  })
)
