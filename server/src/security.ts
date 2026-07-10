import { createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const keyLength = 64;

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getTokenSecret() {
  return process.env.AUTH_TOKEN_SECRET || "dev-only-change-this-secret";
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer;

  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function getPasswordValidationErrors(password: string) {
  const errors: string[] = [];

  if (password.length < 10) {
    errors.push("Şifre en az 10 karakter olmalıdır.");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Şifre en az 1 büyük harf içermelidir.");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Şifre en az 1 küçük harf içermelidir.");
  }

  if (!/\d/.test(password)) {
    errors.push("Şifre en az 1 rakam içermelidir.");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Şifre en az 1 özel karakter içermelidir.");
  }

  return errors;
}

export type AuthTokenPayload = {
  sub: string;
  exp: number;
  loginIp?: string;
};

export function signToken(userId: string, durationMinutes = 480, loginIp?: string) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + Math.max(15, durationMinutes) * 60,
      loginIp,
    } satisfies AuthTokenPayload),
  );
  const signature = createHmac("sha256", getTokenSecret())
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): AuthTokenPayload | null {
  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    return null;
  }

  const expected = createHmac("sha256", getTokenSecret())
    .update(`${header}.${payload}`)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  const parsed = JSON.parse(base64UrlDecode(payload)) as AuthTokenPayload;

  if (!parsed.sub || !parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return parsed;
}
