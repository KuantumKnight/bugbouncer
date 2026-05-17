import { describe, it, expect } from "vitest";
import { ast_parser } from "../parser";
import { dependency_extractor } from "../extractor";

const CODE = `
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { track } from 'bugbouncer';

export const UI = () => {
  const [s] = useState(0);
  const auth = useAuth();
  return <div>UI</div>;
};
`;

describe("DependencyExtractor", () => {
  it("should extract all categories of dependencies", () => {
    const ast = ast_parser.parse_component(CODE, "ui.tsx");
    const info = dependency_extractor.extract_all(ast);
    
    expect(info.imports.length).toBe(3);
    expect(info.hooks.length).toBe(2);
    
    const local = dependency_extractor.extract_local_dependencies(ast);
    expect(local.length).toBe(1);
    expect(local[0].source).toBe("@/hooks/use-auth");
    
    const external = dependency_extractor.extract_external_dependencies(ast);
    expect(external.length).toBe(2); // react, bugbouncer
  });

  it("should identify state providers", () => {
    const ast = ast_parser.parse_component("import { create } from 'zustand';", "store.ts");
    const providers = dependency_extractor.extract_state_providers(ast);
    expect(providers.length).toBe(1);
    expect(providers[0].source).toBe("zustand");
  });
});
