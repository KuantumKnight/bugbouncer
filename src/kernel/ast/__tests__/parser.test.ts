import { describe, it, expect } from "vitest";
import { ast_parser } from "../parser";

const SAMPLE_COMPONENT = `
'use client';
import React, { useState } from 'react';
export default function Test() {
  const [s, setS] = useState(0);
  return <div onClick={() => setS(1)}>{s}</div>;
}
`;

describe("AstParser", () => {
  it("should parse component structure", () => {
    const ast = ast_parser.parse_component(SAMPLE_COMPONENT, "test.tsx");
    expect(ast.file_path).toBe("test.tsx");
    expect(ast.directives.some(d => d.value === "use client")).toBe(true);
    expect(ast.imports.length).toBe(1);
    expect(ast.hooks.length).toBe(1);
    expect(ast.exports.length).toBe(1);
  });

  it("should be resilient to invalid code", () => {
    const ast = ast_parser.parse_component("const a =", "fail.ts");
    expect(ast.file_path).toBe("fail.ts");
    expect(ast.source_file).toBeDefined();
  });
});
