import { describe, expect, it } from "vitest";
import { HttpError } from "../../../src/http/errors.js";

describe("HttpError", () => {
  it("keeps status, exact body, message and class name", () => {
    const body = { code: "IP_NOT_ALLOWED", message: "Bu IP adresine izin verilmiyor." };
    const error = new HttpError(401, body);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("HttpError");
    expect(error.message).toBe(body.message);
    expect(error.status).toBe(401);
    expect(error.body).toBe(body);
  });
});
