// Cryptographically secure random bytes (expo-crypto, native). Loaded lazily:
// an older build without the module gets null → the share screen asks to update.
import { requireOptionalNativeModule } from 'expo';

export function secureRandom(): ((n: number) => Uint8Array) | null {
  if (requireOptionalNativeModule('ExpoCrypto') === null) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Crypto = require('expo-crypto') as typeof import('expo-crypto');
  return (n: number) => Crypto.getRandomBytes(n);
}
