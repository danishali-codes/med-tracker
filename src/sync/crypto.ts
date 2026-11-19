import nacl from 'tweetnacl';

/**
 * End-to-end encryption for anything sent to a sync server. The key is made on the
 * phone and never leaves it (except inside a share code you hand to someone yourself),
 * so the server, even your own, only ever stores scrambled bytes.
 *
 * XSalsa20-Poly1305 (NaCl secretbox): a wrong key or tampered data fails to open.
 */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** URL-safe base64 without padding (so keys fit in links and codes). */
export function toB64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = [B64[(n >> 18) & 63], B64[(n >> 12) & 63], B64[(n >> 6) & 63], B64[n & 63]];
    out += chars.slice(0, Math.min(4, bytes.length - i + 1)).join('');
  }
  return out;
}

export function fromB64(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let acc = 0;
  let j = 0;
  for (const ch of clean) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('Not a valid code');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[j++] = (acc >> bits) & 255;
    }
  }
  return out.slice(0, j);
}

// Small UTF-8 helpers, so this works on engines without TextEncoder/TextDecoder.
const utf8 = {
  encode(s: string): Uint8Array {
    const bin = unescape(encodeURIComponent(s));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};
const fromUtf8 = {
  decode(b: Uint8Array): string {
    let bin = '';
    for (let i = 0; i < b.length; i += 4096) bin += String.fromCharCode(...b.subarray(i, i + 4096));
    return decodeURIComponent(escape(bin));
  },
};

export function newKey(): string {
  return toB64(nacl.randomBytes(nacl.secretbox.keyLength));
}

/** Random id that is hard to guess, for share records. */
export function newToken(bytes = 18): string {
  return toB64(nacl.randomBytes(bytes));
}

export function seal(plain: string, key: string): string {
  const k = fromB64(key);
  if (k.length !== nacl.secretbox.keyLength) throw new Error('Bad key');
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(utf8.encode(plain), nonce, k);
  return `v1.${toB64(nonce)}.${toB64(box)}`;
}

export function open(sealed: string, key: string): string {
  const [v, n, b] = sealed.split('.');
  if (v !== 'v1' || !n || !b) throw new Error('Unknown format');
  const plain = nacl.secretbox.open(fromB64(b), fromB64(n), fromB64(key));
  if (!plain) throw new Error('Could not unlock. The code or key is wrong, or the data was changed.');
  return fromUtf8.decode(plain);
}
