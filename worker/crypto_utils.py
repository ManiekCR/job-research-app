"""
AES-256-GCM decryption compatible with web/src/lib/crypto.ts.
The stored format is: base64(iv[12] + authTag[16] + ciphertext).
"""

from __future__ import annotations

import base64

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

IV_LENGTH = 12
AUTH_TAG_LENGTH = 16


def decrypt(payload_b64: str, master_key_b64: str) -> str:
    key = base64.b64decode(master_key_b64)
    raw = base64.b64decode(payload_b64)

    iv = raw[:IV_LENGTH]
    auth_tag = raw[IV_LENGTH : IV_LENGTH + AUTH_TAG_LENGTH]
    ciphertext = raw[IV_LENGTH + AUTH_TAG_LENGTH :]

    # The Python library expects "ciphertext + tag" concatenated (unlike
    # Node, where they're handled separately) — hence this reassembly.
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(iv, ciphertext + auth_tag, None)
    return plaintext.decode("utf-8")