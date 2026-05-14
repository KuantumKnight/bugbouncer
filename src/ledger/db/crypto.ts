/**
 * BugBouncer Ledger Crypto — AES-256-GCM Application-Level Encryption
 *
 * Since the official @sqlite.org/sqlite-wasm does not bundle SQLCipher,
 * we encrypt the sensitive `payload` field of each TraceMetadata record
 * BEFORE it is written to SQLite. The IV is stored alongside the ciphertext.
 *
 * Key Management:
 *   - A CryptoKey is generated once and stored in IndexedDB as non-extractable.
 *   - If the key is lost (e.g. storage cleared), old data is irrecoverable — by design.
 *   - The key never leaves the browser's WebCrypto key store.
 *
 * This module runs inside the Ledger Web Worker context.
 */

const CRYPTO_DB_NAME = "bugbouncer_keystore";
const CRYPTO_STORE_NAME = "encryption_keys";
const MASTER_KEY_ID = "ledger_master_key";

// ──────────────────────────────────────────────
// Key Management — IndexedDB + Web Crypto API
// ──────────────────────────────────────────────

/**
 * Opens (or creates) the IndexedDB keystore.
 */
function open_keystore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CRYPTO_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CRYPTO_STORE_NAME)) {
        db.createObjectStore(CRYPTO_STORE_NAME, { keyPath: "key_id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generates a new AES-256-GCM key and stores it in IndexedDB
 * with `extractable: false` so it cannot be exported.
 */
async function generate_master_key(): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false, // non-extractable — key can never leave WebCrypto store
    ["encrypt", "decrypt"]
  );

  const db = await open_keystore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CRYPTO_STORE_NAME, "readwrite");
    const store = tx.objectStore(CRYPTO_STORE_NAME);
    store.put({ key_id: MASTER_KEY_ID, crypto_key: key });

    tx.oncomplete = () => {
      db.close();
      resolve(key);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Retrieves the master key from IndexedDB, or generates one
 * if this is the first run.
 */
export async function get_or_create_master_key(): Promise<CryptoKey> {
  const db = await open_keystore();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CRYPTO_STORE_NAME, "readonly");
    const store = tx.objectStore(CRYPTO_STORE_NAME);
    const request = store.get(MASTER_KEY_ID);

    request.onsuccess = async () => {
      db.close();
      if (request.result?.crypto_key) {
        resolve(request.result.crypto_key as CryptoKey);
      } else {
        resolve(await generate_master_key());
      }
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

// ──────────────────────────────────────────────
// Encrypt / Decrypt — AES-256-GCM
// ──────────────────────────────────────────────

export interface EncryptedPayload {
  /** The AES-GCM ciphertext as a raw byte array. */
  encrypted_data: Uint8Array<ArrayBuffer>;
  /** The 12-byte initialization vector used for this encryption. */
  iv: Uint8Array<ArrayBuffer>;
}

/**
 * Encrypts a JSON-serializable payload using AES-256-GCM.
 *
 * @param key     The non-extractable CryptoKey from IndexedDB.
 * @param payload The plaintext payload object to encrypt.
 * @returns       The ciphertext and the IV needed for decryption.
 */
export async function encrypt_payload(
  key: CryptoKey,
  payload: Record<string, unknown>
): Promise<EncryptedPayload> {
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );

  return {
    encrypted_data: new Uint8Array(ciphertext),
    iv,
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload back to its original object.
 *
 * @param key            The same CryptoKey that was used for encryption.
 * @param encrypted_data The ciphertext bytes.
 * @param iv             The 12-byte IV that was used during encryption.
 * @returns              The decrypted JSON object.
 */
export async function decrypt_payload(
  key: CryptoKey,
  encrypted_data: Uint8Array<ArrayBuffer>,
  iv: Uint8Array<ArrayBuffer>
): Promise<Record<string, unknown>> {
  const plaintext_buffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted_data
  );

  const plaintext = new TextDecoder().decode(plaintext_buffer);
  return JSON.parse(plaintext);
}
