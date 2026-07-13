import { defineConfig } from "vitest/config";

export default defineConfig({
  envDir: false,
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/contracts/**/*.test.ts"],
    setupFiles: ["./tests/setup/unit.ts"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/schema.ts",
        "src/index.ts",
        "src/setup.ts",
        "src/routes/**",
        "src/{audit,auth,db,notifications,requestIp,security,settings}.ts",
        "src/modules/**/types.ts",
        "src/modules/**/*.types.ts",
        "src/modules/**/routes.ts",
        "src/modules/**/*.routes.ts",
        "src/modules/reports/index.ts",
      ],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 80,
        "src/modules/auth/security.ts": { branches: 100 },
        "src/modules/auth/request-ip.ts": { branches: 100 },
        "src/modules/auth/authorization-policy.ts": { branches: 100 },
        "src/modules/calls/call.policy.ts": { branches: 100 },
        "src/modules/roles/repository.ts": { branches: 100 },
        "src/modules/settings/settings.service.ts": { branches: 100 },
      },
    },
  },
});
