// crypto.ts — End-to-end encryption using Web Crypto API (ECDH + AES-GCM)
// Key flow:
//   1. On first login each user generates an ECDH key pair.
//   2. Public key is stored in Firebase (base64). Private key stays in localStorage.
//   3. When Alice & Bob become friends, each derives a shared AES key from
//      their own private key + the other's public key (ECDH).
//   4. Every DM is encrypted with AES-GCM before writing to Firebase.

const PRIVATE_KEY_PREFIX = "e2e_priv_";
const EC_PARAMS: EcKeyGenParams = { name: "ECDH", namedCurve: "P-256" };
const AES_PARAMS = { name: "AES-GCM", length: 256 };

// ── Key pair ──────────────────────────────────────────────────────────────────

export async function getOrCreateKeyPair(uid: string): Promise<{ publicKeyB64: string }> {
  const stored = localStorage.getItem(PRIVATE_KEY_PREFIX + uid);
  if (stored) {
    // Already exists — just return the public key derived from stored private
    const privKey = await importPrivateKey(stored);
    // We can't re-export the public key from a private key directly in WebCrypto,
    // so we store both together as JSON
    const pair = JSON.parse(stored) as { pub: string; priv: string };
    return { publicKeyB64: pair.pub };
  }

  const keyPair = await crypto.subtle.generateKey(EC_PARAMS, true, ["deriveKey"]);
  const pubRaw  = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  const pubB64  = btoa(String.fromCharCode(...new Uint8Array(pubRaw)));
  const privB64 = btoa(JSON.stringify(privJwk));

  localStorage.setItem(PRIVATE_KEY_PREFIX + uid, JSON.stringify({ pub: pubB64, priv: privB64 }));
  return { publicKeyB64: pubB64 };
}

async function importPrivateKey(stored: string): Promise<CryptoKey> {
  const { priv } = JSON.parse(stored) as { pub: string; priv: string };
  const jwk = JSON.parse(atob(priv));
  return crypto.subtle.importKey("jwk", jwk, EC_PARAMS, false, ["deriveKey"]);
}

async function importPublicKey(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, EC_PARAMS, false, []);
}

// ── Shared AES key (ECDH) ─────────────────────────────────────────────────────

const sharedKeyCache = new Map<string, CryptoKey>();

export async function getSharedKey(myUid: string, theirPublicKeyB64: string): Promise<CryptoKey | null> {
  const cacheKey = myUid + ":" + theirPublicKeyB64.slice(0, 16);
  if (sharedKeyCache.has(cacheKey)) return sharedKeyCache.get(cacheKey)!;

  const stored = localStorage.getItem(PRIVATE_KEY_PREFIX + myUid);
  if (!stored) return null;

  try {
    const myPrivKey    = await importPrivateKey(stored);
    const theirPubKey  = await importPublicKey(theirPublicKeyB64);
    const sharedAesKey = await crypto.subtle.deriveKey(
      { name: "ECDH", public: theirPubKey },
      myPrivKey,
      AES_PARAMS,
      false,
      ["encrypt", "decrypt"],
    );
    sharedKeyCache.set(cacheKey, sharedAesKey);
    return sharedAesKey;
  } catch {
    return null;
  }
}

// ── Encrypt / Decrypt ─────────────────────────────────────────────────────────

export async function encryptMessage(plaintext: string, sharedKey: CryptoKey): Promise<string> {
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct  = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedKey, enc.encode(plaintext));
  // Pack iv + ciphertext as base64
  const combined = new Uint8Array(iv.byteLength + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptMessage(b64: string, sharedKey: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ct = combined.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, sharedKey, ct);
  return new TextDecoder().decode(pt);
}
