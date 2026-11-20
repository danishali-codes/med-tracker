import { requireOptionalNativeModule } from 'expo';

interface SabrCryptoNative {
  /**
   * PBKDF2-HMAC-SHA512. The password is its UTF-8 bytes; password, salt and result are
   * URL-safe base64 without padding.
   */
  pbkdf2Sha512(passwordB64: string, saltB64: string, iterations: number, length: number): Promise<string>;
}

/** null where the native side isn't built in (iPhone for now, web, Expo Go, tests). */
export const SabrCrypto = requireOptionalNativeModule<SabrCryptoNative>('SabrCrypto');
