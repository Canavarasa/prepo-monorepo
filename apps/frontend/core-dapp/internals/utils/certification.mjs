import { webcrypto } from 'node:crypto'

// Node.js support for Ed25519 is experimental, so instead of signing with the
// Ed25519 key, derive a symmetric AES key from the Ed25519 key bytes and
// encrypt with the derived key (which is effectively the same as signing
// because only we have a need for verifying)
export async function deriveCertificationKey(baseKeyBytes) {
  const baseKey = await webcrypto.subtle.importKey(
    'raw',
    baseKeyBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return webcrypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-512',
      salt: Buffer.from('+jLWsP07SoXhP9Jjxe545Q==', 'base64'),
      iterations: 600_000,
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['decrypt', 'encrypt']
  )
}
