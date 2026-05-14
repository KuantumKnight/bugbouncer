/**
 * BugBouncer Config Engine
 * 
 * Manages Safe Zones (allowed tracking areas) and Exclusions (sensitive data).
 * This engine provides high-performance predicate checks for observers.
 */

export interface BugBouncerConfig {
  safe_zones: {
    urls?: (string | RegExp)[];
    components?: (string | RegExp)[];
  };
  exclusions: {
    urls?: (string | RegExp)[];
    components?: (string | RegExp)[];
    sensitive_keys: string[]; // e.g. ["password", "token", "cvv"]
  };
}

export class ConfigEngine {
  private config: BugBouncerConfig;

  constructor(config: BugBouncerConfig) {
    this.config = config;
  }

  /**
   * Checks if a component should be observed.
   */
  public should_observe_component(name: string): boolean {
    // 1. Check Exclusions (Blacklist)
    if (this.matches(name, this.config.exclusions.components)) {
      return false;
    }

    // 2. Check Safe Zones (Whitelist) - if defined, must be in one
    if (this.config.safe_zones.components && this.config.safe_zones.components.length > 0) {
      return this.matches(name, this.config.safe_zones.components);
    }

    return true;
  }

  /**
   * Checks if a URL should be intercepted.
   */
  public should_observe_url(url: string): boolean {
    // 1. Check Exclusions
    if (this.matches(url, this.config.exclusions.urls)) {
      return false;
    }

    // 2. Check Safe Zones
    if (this.config.safe_zones.urls && this.config.safe_zones.urls.length > 0) {
      return this.matches(url, this.config.safe_zones.urls);
    }

    return true;
  }

  /**
   * Deeply masks sensitive keys in a payload object.
   */
  public mask_payload(payload: any): any {
    if (!payload || typeof payload !== "object") return payload;

    if (Array.isArray(payload)) {
      return payload.map(item => this.mask_payload(item));
    }

    const masked: Record<string, any> = {};
    for (const key in payload) {
      if (this.config.exclusions.sensitive_keys.includes(key.toLowerCase())) {
        masked[key] = "[MASKED]";
      } else if (typeof payload[key] === "object") {
        masked[key] = this.mask_payload(payload[key]);
      } else {
        masked[key] = payload[key];
      }
    }
    return masked;
  }

  private matches(value: string, patterns?: (string | RegExp)[]): boolean {
    if (!patterns) return false;
    return patterns.some(p => {
      if (typeof p === "string") return value.includes(p);
      return p.test(value);
    });
  }
}

// Default production-safe configuration
export const default_config: BugBouncerConfig = {
  safe_zones: {},
  exclusions: {
    components: [/Auth/, /Login/, /Secret/],
    urls: [/auth\.com/, /localhost:3000\/api\/login/],
    sensitive_keys: [
      "password", "token", "auth", "secret", "cvv", 
      "credit_card", "card_number", "ssn", "api_key"
    ]
  }
};

export const config_engine = new ConfigEngine(default_config);
