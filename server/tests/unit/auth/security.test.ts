import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPasswordValidationErrors,
  hashPassword,
  signToken,
  verifyPassword,
  verifyToken,
} from "../../../src/modules/auth/security.js";

describe("auth security", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("returns password validation messages in the existing order", () => {
    expect(getPasswordValidationErrors("")).toStrictEqual([
      "Şifre en az 10 karakter olmalıdır.",
      "Şifre en az 1 büyük harf içermelidir.",
      "Şifre en az 1 küçük harf içermelidir.",
      "Şifre en az 1 rakam içermelidir.",
      "Şifre en az 1 özel karakter içermelidir.",
    ]);
    expect(getPasswordValidationErrors("ValidPass1!")).toStrictEqual([]);
  });

  it("hashes with scrypt and verifies only the matching password", async () => {
    const hash = await hashPassword("ValidPass1!");

    expect(hash).toMatch(/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
    await expect(verifyPassword("ValidPass1!", hash)).resolves.toBe(true);
    await expect(verifyPassword("WrongPass1!", hash)).resolves.toBe(false);
  });

  it("rejects unsupported and incomplete password hash formats", async () => {
    await expect(verifyPassword("password", "bcrypt:salt:hash")).resolves.toBe(false);
    await expect(verifyPassword("password", "scrypt:missing-hash")).resolves.toBe(false);
    await expect(verifyPassword("password", "")).resolves.toBe(false);
  });

  it("keeps the custom token payload and minimum fifteen-minute duration", () => {
    vi.stubEnv("AUTH_TOKEN_SECRET", "unit-test-secret");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T10:00:00.000Z"));

    const token = signToken("user-1", 1, "10.0.0.8");

    expect(verifyToken(token)).toStrictEqual({
      sub: "user-1",
      exp: 1_783_937_700,
      loginIp: "10.0.0.8",
    });
  });

  it("preserves the development token-secret fallback", () => {
    vi.stubEnv("AUTH_TOKEN_SECRET", "");

    const token = signToken("user-1");

    expect(verifyToken(token)?.sub).toBe("user-1");
  });

  it("rejects missing parts, signature tampering and expired tokens", () => {
    vi.stubEnv("AUTH_TOKEN_SECRET", "unit-test-secret");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T10:00:00.000Z"));
    const token = signToken("user-1", 15);

    expect(verifyToken("missing.parts")).toBeNull();

    const [header, payload] = token.split(".");
    expect(verifyToken(`${header}.${payload}.tampered`)).toBeNull();

    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(verifyToken(token)).toBeNull();
  });

  it("preserves the thrown error for a correctly signed malformed payload", () => {
    vi.stubEnv("AUTH_TOKEN_SECRET", "unit-test-secret");
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from("not-json").toString("base64url");
    const signature = createHmac("sha256", "unit-test-secret")
      .update(`${header}.${payload}`)
      .digest("base64url");

    expect(() => verifyToken(`${header}.${payload}.${signature}`)).toThrow(SyntaxError);
  });
});
