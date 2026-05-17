/**
 * BugBouncer Supabase Drift Detection Module
 *
 * Exports live Supabase schema introspection, local AST TypeScript parsing,
 * and deep structural drift comparison capabilities for the Causal Kernel.
 *
 * MANDATORY CONVENTION: All methods and properties in snake_case.
 * ERROR HANDLING: Kernel Panic pattern — catch exceptions and return safe fallback.
 */

export * from "./types";
export * from "./client";
export * from "./drift_detector";
