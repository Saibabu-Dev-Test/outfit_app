/* eslint-disable no-bitwise */
/* global TextEncoder */
// MD5 (RFC 1321) in plain JS: CPX Research's secure hash is md5, and WebCrypto has no MD5 outside
// Workers. Only used to CHECK partner hashes, never to protect anything of ours.
const K = new Int32Array(64);
for (let i = 0; i < 64; i++) {
  K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
}
const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];

export function md5Hex(str) {
  const msg = new TextEncoder().encode(String(str));
  const len = msg.length;
  const words = new Int32Array((((len + 8) >>> 6) + 1) * 16);
  for (let i = 0; i < len; i++) {
    words[i >> 2] |= msg[i] << ((i % 4) * 8);
  }
  words[len >> 2] |= 0x80 << ((len % 4) * 8);
  words[words.length - 2] = (len * 8) | 0;
  words[words.length - 1] = Math.floor((len * 8) / 4294967296) | 0;
  let a0 = 0x67452301;
  let b0 = 0xefcdab89 | 0;
  let c0 = 0x98badcfe | 0;
  let d0 = 0x10325476;
  for (let off = 0; off < words.length; off += 16) {
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f;
      let g;
      const r = i >> 4;
      if (r === 0) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (r === 1) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (r === 2) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const s = S[r * 4 + (i % 4)];
      const t = (a + f + K[i] + words[off + g]) | 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((t << s) | (t >>> (32 - s)))) | 0;
    }
    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }
  let out = '';
  [a0, b0, c0, d0].forEach(v => {
    for (let i = 0; i < 4; i++) {
      out += ((v >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    }
  });
  return out;
}
