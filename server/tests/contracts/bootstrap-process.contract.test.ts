import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { resolve } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

async function reservePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Could not reserve a test port.");
  }

  const port = address.port;
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
  return port;
}

async function waitUntilHealthy(baseUrl: string, child: ChildProcess, stderr: () => string) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server process exited early (${child.exitCode}): ${stderr()}`);
    }

    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.status === 200) {
        return;
      }
    } catch {
      // The listener may not be ready yet.
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }

  throw new Error(`Server process did not become healthy: ${stderr()}`);
}

describe("production bootstrap process contract", () => {
  let child: ChildProcess;
  let baseUrl: string;
  let stderr = "";

  beforeAll(async () => {
    const port = await reservePort();
    baseUrl = `http://127.0.0.1:${port}`;
    child = spawn(
      process.execPath,
      ["--import", "tsx", resolve(process.cwd(), "src/index.ts")],
      {
        cwd: resolve(process.cwd(), "tests"),
        env: {
          ...process.env,
          NODE_ENV: "test",
          LOG_LEVEL: "silent",
          PORT: String(port),
          DB_HOST: "",
          DB_PORT: "",
          DB_USER: "",
          DB_PASSWORD: "",
          DB_NAME: "",
          AUTH_TOKEN_SECRET: "process-contract-secret",
        },
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });

    await waitUntilHealthy(baseUrl, child, () => stderr);
  }, 40_000);

  afterAll(async () => {
    if (!child || child.exitCode !== null) {
      return;
    }

    child.kill("SIGTERM");
    await Promise.race([
      once(child, "exit"),
      new Promise<void>((resolveWait) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolveWait();
        }, 5_000);
        timer.unref();
      }),
    ]);
  });

  it("serves the real entrypoint without reading the normal server .env", async () => {
    const health = await request(baseUrl).get("/health").expect(200);
    expect(health.body).toStrictEqual({ status: "ok" });

    const malformed = await request(baseUrl)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send('{"username":')
      .expect(500);
    expect(malformed.body).toStrictEqual({ message: "Beklenmeyen bir hata oluştu." });
  });
});
