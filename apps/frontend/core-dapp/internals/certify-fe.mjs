import { randomBytes, webcrypto } from 'node:crypto'
import { deriveCertificationKey } from './utils/certification.mjs'

if (!process.env.BUILD_ID || !process.env.IPNS_KEY_BASE64) {
  console.log('Missing environment variables')
  process.exit(1)
}

const key = await deriveCertificationKey(Buffer.from(process.env.IPNS_KEY_BASE64, 'base64'))
const iv = randomBytes(12)

const ciphertext = await webcrypto.subtle.encrypt(
  {
    name: 'AES-GCM',
    iv,
  },
  key,
  Buffer.from(process.env.BUILD_ID, 'hex')
)

console.log(
  JSON.stringify({
    buildId: process.env.BUILD_ID,
    encryptedBuildId: Buffer.from(ciphertext).toString('base64'),
    iv: iv.toString('base64'),
  })
)
