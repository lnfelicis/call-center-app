import type { Request } from "express";
import { describe, expect, it } from "vitest";
import {
  getClientIp,
  isClientIpAllowed,
  isSessionIpAllowed,
} from "../../../src/modules/auth/request-ip.js";

function requestWithIp(ip: string | undefined, remoteAddress?: string) {
  return { ip, socket: { remoteAddress } } as unknown as Request;
}

describe("request IP policy", () => {
  it("prefers Express request IP and strips an IPv4-mapped prefix", () => {
    expect(getClientIp(requestWithIp("::ffff:192.168.1.20", "10.0.0.1"))).toBe("192.168.1.20");
  });

  it("falls back to the socket address and returns null when neither exists", () => {
    expect(getClientIp(requestWithIp(undefined, "::ffff:10.0.0.2"))).toBe("10.0.0.2");
    expect(getClientIp(requestWithIp(undefined))).toBeNull();
  });

  it("allows every client when the allowlist is empty", () => {
    expect(isClientIpAllowed(requestWithIp(undefined), [])).toBe(true);
    expect(isSessionIpAllowed(requestWithIp(undefined), [], undefined)).toBe(true);
  });

  it("requires the current client IP to be on a non-empty allowlist", () => {
    const req = requestWithIp("10.0.0.2");

    expect(isClientIpAllowed(req, ["10.0.0.2"])).toBe(true);
    expect(isClientIpAllowed(req, ["10.0.0.3"])).toBe(false);
    expect(isClientIpAllowed(requestWithIp(undefined), ["10.0.0.2"])).toBe(false);
  });

  it("requires both login and current IPs for an allowlisted session", () => {
    const allowlist = ["10.0.0.2", "10.0.0.3"];
    const req = requestWithIp("10.0.0.2");

    expect(isSessionIpAllowed(req, allowlist, "10.0.0.3")).toBe(true);
    expect(isSessionIpAllowed(req, allowlist, undefined)).toBe(false);
    expect(isSessionIpAllowed(req, allowlist, "10.0.0.4")).toBe(false);
    expect(isSessionIpAllowed(requestWithIp("10.0.0.4"), allowlist, "10.0.0.3")).toBe(false);
  });
});
