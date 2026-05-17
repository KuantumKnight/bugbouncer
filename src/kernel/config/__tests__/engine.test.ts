/**
 * ConfigEngine Tests — Story 1.5
 *
 * Validates Safe Zones, Exclusions, and Sensitive Field Masking.
 * AC1: Configuration schema for SafeZones and Exclusions.
 * AC2: Component name/regex exclusion from Fiber observation.
 * AC3: URL pattern exclusion from network interception.
 * AC4: Sensitive field masking (deep traversal).
 * AC5: Configuration readable by the Causal Kernel at runtime.
 */

import { describe, it, expect } from "vitest";
import {
  ConfigEngine,
  default_config,
  config_engine,
} from "../engine";

// ──────────────────────────────────────────────
// AC1: Configuration schema
// ──────────────────────────────────────────────

describe("AC1: Configuration Schema", () => {
  it("should instantiate with a valid config object", () => {
    const engine = new ConfigEngine({
      safe_zones: { urls: ["/api"], components: ["Dashboard"] },
      exclusions: {
        urls: [/auth\.com/],
        components: [/Login/],
        sensitive_keys: ["password"],
      },
    });
    expect(engine).toBeDefined();
  });

  it("should export a default_config with production-safe defaults", () => {
    expect(default_config).toBeDefined();
    expect(default_config.exclusions.sensitive_keys).toContain("password");
    expect(default_config.exclusions.sensitive_keys).toContain("token");
    expect(default_config.exclusions.sensitive_keys).toContain("api_key");
    expect(default_config.exclusions.sensitive_keys).toContain("ssn");
    expect(default_config.exclusions.sensitive_keys).toContain("cvv");
    expect(default_config.exclusions.sensitive_keys).toContain("card_number");
  });

  it("should export a singleton config_engine instance", () => {
    expect(config_engine).toBeInstanceOf(ConfigEngine);
  });
});

// ──────────────────────────────────────────────
// AC2: Component exclusion
// ──────────────────────────────────────────────

describe("AC2: Component Exclusion", () => {
  const engine = new ConfigEngine({
    safe_zones: {},
    exclusions: {
      components: ["SecretPanel", /Auth/],
      sensitive_keys: [],
    },
  });

  it("should exclude components by exact string match", () => {
    expect(engine.should_observe_component("SecretPanel")).toBe(false);
  });

  it("should exclude components by regex match", () => {
    expect(engine.should_observe_component("AuthForm")).toBe(false);
    expect(engine.should_observe_component("UserAuthModal")).toBe(false);
  });

  it("should allow non-excluded components", () => {
    expect(engine.should_observe_component("Dashboard")).toBe(true);
    expect(engine.should_observe_component("UserProfile")).toBe(true);
  });

  it("should support safe_zones whitelist for components", () => {
    const whitelist_engine = new ConfigEngine({
      safe_zones: { components: ["Dashboard", /Settings/] },
      exclusions: { sensitive_keys: [] },
    });

    expect(whitelist_engine.should_observe_component("Dashboard")).toBe(true);
    expect(whitelist_engine.should_observe_component("SettingsPanel")).toBe(true);
    expect(whitelist_engine.should_observe_component("LoginPage")).toBe(false);
  });

  it("should prioritize exclusions over safe_zones", () => {
    const mixed_engine = new ConfigEngine({
      safe_zones: { components: [/Dashboard/] },
      exclusions: {
        components: ["DashboardSecret"],
        sensitive_keys: [],
      },
    });

    expect(mixed_engine.should_observe_component("DashboardSecret")).toBe(false);
    expect(mixed_engine.should_observe_component("DashboardMain")).toBe(true);
  });
});

// ──────────────────────────────────────────────
// AC3: URL exclusion
// ──────────────────────────────────────────────

describe("AC3: URL Exclusion", () => {
  const engine = new ConfigEngine({
    safe_zones: {},
    exclusions: {
      urls: [/auth\.provider\.com/, "localhost:3000/api/login"],
      sensitive_keys: [],
    },
  });

  it("should exclude URLs matching regex patterns", () => {
    expect(engine.should_observe_url("https://auth.provider.com/token")).toBe(false);
  });

  it("should exclude URLs matching string substrings", () => {
    expect(engine.should_observe_url("http://localhost:3000/api/login")).toBe(false);
  });

  it("should allow non-excluded URLs", () => {
    expect(engine.should_observe_url("https://api.example.com/data")).toBe(true);
  });

  it("should support safe_zones whitelist for URLs", () => {
    const whitelist_engine = new ConfigEngine({
      safe_zones: { urls: [/api\.internal\.com/] },
      exclusions: { sensitive_keys: [] },
    });

    expect(whitelist_engine.should_observe_url("https://api.internal.com/data")).toBe(true);
    expect(whitelist_engine.should_observe_url("https://external.com/data")).toBe(false);
  });
});

// ──────────────────────────────────────────────
// AC4: Sensitive Field Masking
// ──────────────────────────────────────────────

describe("AC4: Sensitive Field Masking", () => {
  const engine = new ConfigEngine({
    safe_zones: {},
    exclusions: {
      sensitive_keys: ["password", "token", "secret", "api_key", "cvv", "ssn"],
    },
  });

  it("should mask top-level sensitive keys", () => {
    const result = engine.mask_payload({
      username: "testuser",
      password: "hunter2",
    });
    expect(result.username).toBe("testuser");
    expect(result.password).toBe("[MASKED]");
  });

  it("should mask deeply nested sensitive keys", () => {
    const result = engine.mask_payload({
      user: {
        profile: {
          name: "Alice",
          settings: {
            secret: "my_secret_value",
          },
        },
      },
    });
    expect(result.user.profile.name).toBe("Alice");
    expect(result.user.profile.settings.secret).toBe("[MASKED]");
  });

  it("should mask case-insensitively", () => {
    const result = engine.mask_payload({
      Password: "hunter2",
      API_KEY: "key123",
      Token: "tok_xxx",
    });
    expect(result.Password).toBe("[MASKED]");
    expect(result.API_KEY).toBe("[MASKED]");
    expect(result.Token).toBe("[MASKED]");
  });

  it("should handle arrays with objects containing sensitive keys", () => {
    const result = engine.mask_payload([
      { username: "user1", password: "pass1" },
      { username: "user2", password: "pass2" },
    ]);
    expect(result[0].username).toBe("user1");
    expect(result[0].password).toBe("[MASKED]");
    expect(result[1].password).toBe("[MASKED]");
  });

  it("should return primitives unchanged", () => {
    expect(engine.mask_payload("hello")).toBe("hello");
    expect(engine.mask_payload(42)).toBe(42);
    expect(engine.mask_payload(null)).toBeNull();
    expect(engine.mask_payload(undefined)).toBeUndefined();
  });

  it("should mask empty string values for sensitive keys", () => {
    const result = engine.mask_payload({ password: "" });
    expect(result.password).toBe("[MASKED]");
  });

  it("should mask numeric values for sensitive keys", () => {
    const result = engine.mask_payload({ cvv: 123 });
    expect(result.cvv).toBe("[MASKED]");
  });

  it("should mask boolean values for sensitive keys", () => {
    const result = engine.mask_payload({ token: true });
    expect(result.token).toBe("[MASKED]");
  });

  it("should not mutate the original payload object", () => {
    const original = { username: "test", password: "secret123" };
    const result = engine.mask_payload(original);
    expect(original.password).toBe("secret123");
    expect(result.password).toBe("[MASKED]");
  });
});

// ──────────────────────────────────────────────
// AC5: Runtime readability
// ──────────────────────────────────────────────

describe("AC5: Runtime Config Access", () => {
  it("should allow runtime access via the singleton config_engine", () => {
    // The default config is loaded at module level
    expect(config_engine.should_observe_component("NormalComponent")).toBe(true);
    expect(config_engine.should_observe_component("LoginForm")).toBe(false); // /Login/ in default exclusions
  });

  it("should support dynamic config replacement", () => {
    const custom_engine = new ConfigEngine({
      safe_zones: { components: ["OnlyThis"] },
      exclusions: { sensitive_keys: ["custom_secret"] },
    });

    expect(custom_engine.should_observe_component("OnlyThis")).toBe(true);
    expect(custom_engine.should_observe_component("AnythingElse")).toBe(false);
    expect(custom_engine.mask_payload({ custom_secret: "val" }).custom_secret).toBe("[MASKED]");
  });
});
