// ULID implementation for Cloudflare Workers
// Based on the ULID spec: https://github.com/ulid/spec

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function randomChar(): string {
  const rand = Math.floor(Math.random() * ENCODING_LEN);
  return ENCODING[rand];
}

function encodeTime(now: number, len: number): string {
  let str = '';
  for (let i = len; i > 0; i--) {
    const mod = now % ENCODING_LEN;
    str = ENCODING[mod] + str;
    now = Math.floor(now / ENCODING_LEN);
  }
  return str;
}

function encodeRandom(len: number): string {
  let str = '';
  for (let i = 0; i < len; i++) {
    str += randomChar();
  }
  return str;
}

export function ulid(seedTime?: number): string {
  const time = seedTime ?? Date.now();
  return encodeTime(time, TIME_LEN) + encodeRandom(RANDOM_LEN);
}

export function decodeTime(id: string): number {
  if (id.length !== TIME_LEN + RANDOM_LEN) {
    throw new Error('Invalid ULID');
  }
  const timeChars = id.substring(0, TIME_LEN);
  let time = 0;
  for (const char of timeChars) {
    const index = ENCODING.indexOf(char);
    if (index === -1) {
      throw new Error('Invalid ULID character');
    }
    time = time * ENCODING_LEN + index;
  }
  return time;
}
