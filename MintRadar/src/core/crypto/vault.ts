/**
 * SecureVault — private keys live ONLY here, never in Zustand/localStorage.
 * NIP-44 v2: ECDH secp256k1 → HKDF-SHA256 → ChaCha20-Poly1305.
 */
import * as secp from '@noble/secp256k1'
import { chacha20poly1305 } from '@noble/ciphers/chacha'
import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha256'
import { randomBytes } from '@noble/hashes/utils'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'

// ── Module-scope secret state (never exported) ────────────────
let _privkey: Uint8Array | null = null
let _pubkeyHex: string | null = null

let _incognitoPrivkey: Uint8Array | null = null
let _incognitoPubkeyHex: string | null = null

// ── Helpers ───────────────────────────────────────────────────
function assertSession(): Uint8Array {
  if (!_privkey) throw new Error('No active session — call loadSession first')
  return _privkey
}

function pubkeyFromPriv(priv: Uint8Array): string {
  return bytesToHex(secp.getPublicKey(priv, true).slice(1)) // x-only (32 bytes)
}

// ── Key generation ────────────────────────────────────────────
export function generateKeyPair(): { pubkeyHex: string; nsec: string } {
  const priv = secp.utils.randomPrivateKey()
  const pub = pubkeyFromPriv(priv)
  const nsec = 'nsec1' + bytesToHex(priv) // simplified — real app uses bech32
  priv.fill(0)
  return { pubkeyHex: pub, nsec }
}

export function importPrivkey(nsecOrHex: string): string {
  const hex = nsecOrHex.startsWith('nsec1')
    ? nsecOrHex.slice(5) // simplified bech32 strip — real impl uses nip19
    : nsecOrHex
  const priv = hexToBytes(hex)
  if (priv.length !== 32) throw new Error('Invalid private key length')
  _privkey = priv
  _pubkeyHex = pubkeyFromPriv(priv)
  return _pubkeyHex
}

export function loadSession(privkeyHex: string): string {
  return importPrivkey(privkeyHex)
}

export function getActivePubkey(): string | null {
  return _pubkeyHex
}

export function isSessionActive(): boolean {
  return _privkey !== null
}

export function lockSession(): void {
  if (_privkey) {
    _privkey.fill(0)
    _privkey = null
  }
  _pubkeyHex = null
}

// ── Event signing ─────────────────────────────────────────────
export async function signEvent(eventHash: Uint8Array): Promise<string> {
  const priv = assertSession()
  const sig = await secp.signAsync(eventHash, priv)
  return bytesToHex(sig.toCompactRawBytes())
}

// ── Incognito session ─────────────────────────────────────────
export function startIncognito(): string {
  _incognitoPrivkey = secp.utils.randomPrivateKey()
  _incognitoPubkeyHex = pubkeyFromPriv(_incognitoPrivkey)
  return _incognitoPubkeyHex
}

export function getIncognitoPubkey(): string | null {
  return _incognitoPubkeyHex
}

export async function signIncognitoEvent(eventHash: Uint8Array): Promise<string> {
  if (!_incognitoPrivkey) throw new Error('No incognito session active')
  const sig = await secp.signAsync(eventHash, _incognitoPrivkey)
  return bytesToHex(sig.toCompactRawBytes())
}

export function clearIncognito(): void {
  if (_incognitoPrivkey) {
    _incognitoPrivkey.fill(0)
    _incognitoPrivkey = null
  }
  _incognitoPubkeyHex = null
}

// ── NIP-44 v2 ECDH + HKDF + ChaCha20-Poly1305 ────────────────
function deriveSharedSecret(theirPubkeyHex: string, myPriv: Uint8Array): Uint8Array {
  const theirPoint = secp.ProjectivePoint.fromHex('02' + theirPubkeyHex)
  const shared = theirPoint.multiply(BigInt('0x' + bytesToHex(myPriv)))
  return shared.toRawBytes(true).slice(1) // x-coord only
}

function deriveMessageKey(sharedSecret: Uint8Array, salt: Uint8Array): Uint8Array {
  return hkdf(sha256, sharedSecret, salt, new TextEncoder().encode('nip44-v2'), 76)
}

export function encryptNip44(plaintext: string, theirPubkeyHex: string): string {
  const priv = assertSession()
  const salt = randomBytes(32)
  const keyMaterial = deriveMessageKey(deriveSharedSecret(theirPubkeyHex, priv), salt)
  const key = keyMaterial.slice(0, 32)
  const nonce = keyMaterial.slice(32, 44)

  const cipher = chacha20poly1305(key, nonce)
  const plainBytes = new TextEncoder().encode(plaintext)
  const ciphertext = cipher.encrypt(plainBytes)

  const payload = new Uint8Array(1 + 32 + ciphertext.length)
  payload[0] = 2 // version
  payload.set(salt, 1)
  payload.set(ciphertext, 33)

  return btoa(String.fromCharCode(...payload))
}

export function decryptNip44(cipherB64: string, theirPubkeyHex: string): string {
  const priv = assertSession()
  const payload = Uint8Array.from(atob(cipherB64), c => c.charCodeAt(0))

  if (payload[0] !== 2) throw new Error('Unsupported NIP-44 version')
  const salt = payload.slice(1, 33)
  const ciphertext = payload.slice(33)

  const keyMaterial = deriveMessageKey(deriveSharedSecret(theirPubkeyHex, priv), salt)
  const key = keyMaterial.slice(0, 32)
  const nonce = keyMaterial.slice(32, 44)

  const cipher = chacha20poly1305(key, nonce)
  const plainBytes = cipher.decrypt(ciphertext)
  return new TextDecoder().decode(plainBytes)
}
