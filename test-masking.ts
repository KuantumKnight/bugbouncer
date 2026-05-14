import { config_engine } from "./src/kernel/config/engine";
import { DagMapper } from "./src/kernel/mapper/dag";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error("Assertion failed: " + message);
}

function run_tests() {
  console.log("Running Validation Tests for Sensitive Field Masking...");

  const test_payload = {
    request_url: "https://api.example.com/login?token=12345",
    user_data: {
      username: "testuser",
      password: "supersecretpassword",
      api_key: "ak_live_123456789",
      preferences: {
        theme: "dark",
        secret: "my_deep_secret"
      }
    },
    someId: "123"
  };

  const dag_mapper = new DagMapper();
  const normalized = dag_mapper.normalize_payload(test_payload);

  console.log("Original Payload:", JSON.stringify(test_payload, null, 2));
  console.log("Normalized Payload:", JSON.stringify(normalized, null, 2));

  // Assertions
  assert(normalized.user_data.password === "[MASKED]", "Password should be masked");
  assert(normalized.user_data.api_key === "[MASKED]", "API Key should be masked");
  assert(normalized.user_data.preferences.secret === "[MASKED]", "Deep secret should be masked");
  assert(normalized.user_data.username === "testuser", "Username should NOT be masked");
  assert(normalized.request_url === "https://api.example.com/login?token=12345", "URL should remain intact (query masking handled elsewhere if needed, but keys should be masked)");
  
  // Snake case assertions
  assert(normalized.some_id === "123", "Keys should be converted to snake_case");

  console.log("All masking and snake_case tests passed successfully! ✅");
}

try {
  run_tests();
} catch (e) {
  console.error("Test failed:", e);
  process.exit(1);
}
