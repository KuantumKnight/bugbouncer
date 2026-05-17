import { describe, it, expect } from "vitest";
import { ast_parser } from "../parser";
import { structural_hasher } from "../hasher";

const CODE_A = `
import { Button } from './Button';
export const App = () => <Button>Click</Button>;
`;

const CODE_A_FORMATTED = `
import   {   Button   }   from   "./Button"   ;

export   const   App   =   (   )   =>   
    <Button>
        Click
    </Button>
;
`;

const CODE_B = `
import { Button } from './Button';
export const App = () => <button>Click</button>;
`;

describe("StructuralHasher", () => {
  it("should be deterministic and ignore whitespace/formatting", () => {
    const ast1 = ast_parser.parse_component(CODE_A, "a.tsx");
    const ast2 = ast_parser.parse_component(CODE_A_FORMATTED, "a.tsx");
    
    const hash1 = structural_hasher.compute_hash(ast1);
    const hash2 = structural_hasher.compute_hash(ast2);
    
    expect(hash1.hash).toBe(hash2.hash);
  });

  it("should detect structural changes", () => {
    const ast1 = ast_parser.parse_component(CODE_A, "a.tsx");
    const ast2 = ast_parser.parse_component(CODE_B, "a.tsx");
    
    const hash1 = structural_hasher.compute_hash(ast1);
    const hash2 = structural_hasher.compute_hash(ast2);
    
    expect(hash1.hash).not.toBe(hash2.hash);
  });

  it("should detect drift", () => {
    const h1 = { hash: "abc", file_path: "f", computed_at: "t", node_count: 1 };
    const h2 = { hash: "def", file_path: "f", computed_at: "t", node_count: 1 };
    
    const drift = structural_hasher.detect_drift(h2, h1);
    expect(drift.has_drifted).toBe(true);
    expect(drift.previous_hash).toBe("abc");
  });
});
