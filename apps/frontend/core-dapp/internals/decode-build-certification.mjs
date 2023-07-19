import { webcrypto } from 'node:crypto'
import { deriveCertificationKey } from './utils/certification.mjs'

if (!process.env.IPNS_KEY_BASE64) {
  console.log('Missing environment variables')
  process.exit(1)
}

const key = await deriveCertificationKey(Buffer.from(process.env.IPNS_KEY_BASE64, 'base64'))
const { buildId, encryptedBuildId, iv } = JSON.parse(process.argv[2])

try {
  const decrypted = await webcrypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: Buffer.from(iv, "base64"),
    },
    key,
    Buffer.from(encryptedBuildId, "base64")
  )

  if (Buffer.from(decrypted).toString("hex") !== buildId) {
    throw new Error("Build ID mismatch")
  }
} catch(e) {
  console.error("Error verifying front-end certification!")
  process.exit(1)
}

console.log(buildId)
