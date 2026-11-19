// tweetnacl needs a secure random source; React Native has no crypto.getRandomValues,
// so feed it from the system's secure generator.
import * as Crypto from 'expo-crypto';
import nacl from 'tweetnacl';

nacl.setPRNG((x, n) => {
  const bytes = Crypto.getRandomBytes(n);
  for (let i = 0; i < n; i++) x[i] = bytes[i];
});
