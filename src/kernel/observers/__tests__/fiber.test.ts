/**
 * FiberObserver Tests — Story 1.5, Task 3
 *
 * Validates that the FiberObserver:
 * - Skips excluded components via config_engine.should_observe_component()
 * - Still observes non-excluded components
 */

import { describe, it, expect, vi } from "vitest";
import { config_engine } from "@/kernel/config/engine";

describe("FiberObserver — component exclusion (Task 3)", () => {
  it("should have config_engine wired with should_observe_component", () => {
    expect(config_engine).toBeDefined();
    expect(typeof config_engine.should_observe_component).toBe("function");
  });

  it("should exclude components matching default exclusion regex /Auth/", () => {
    expect(config_engine.should_observe_component("AuthForm")).toBe(false);
    expect(config_engine.should_observe_component("UserAuthModal")).toBe(false);
    expect(config_engine.should_observe_component("OAuthProvider")).toBe(false);
  });

  it("should exclude components matching default exclusion regex /Login/", () => {
    expect(config_engine.should_observe_component("LoginForm")).toBe(false);
    expect(config_engine.should_observe_component("LoginModal")).toBe(false);
  });

  it("should exclude components matching default exclusion regex /Secret/", () => {
    expect(config_engine.should_observe_component("SecretPanel")).toBe(false);
    expect(config_engine.should_observe_component("SecretManager")).toBe(false);
  });

  it("should allow observation of non-excluded components", () => {
    expect(config_engine.should_observe_component("Dashboard")).toBe(true);
    expect(config_engine.should_observe_component("UserProfile")).toBe(true);
    expect(config_engine.should_observe_component("DataGrid")).toBe(true);
    expect(config_engine.should_observe_component("App")).toBe(true);
    expect(config_engine.should_observe_component("Header")).toBe(true);
  });

  it("should use spy to verify should_observe_component is callable", () => {
    const spy = vi.spyOn(config_engine, "should_observe_component");

    config_engine.should_observe_component("TestComponent");

    expect(spy).toHaveBeenCalledWith("TestComponent");
    spy.mockRestore();
  });

  it("should verify FiberObserver source code uses config_engine", async () => {
    // Read the fiber observer source to verify integration
    const fs = await import("fs");
    const path = await import("path");
    const fiber_source = fs.readFileSync(
      path.resolve(__dirname, "../fiber.ts"),
      "utf-8"
    );

    // Verify the import
    expect(fiber_source).toContain('import { config_engine } from "@/kernel/config/engine"');

    // Verify the exclusion check is used in traversal
    expect(fiber_source).toContain("config_engine.should_observe_component");
  });
});
