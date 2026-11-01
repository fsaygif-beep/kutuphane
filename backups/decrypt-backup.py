"""Decrypt to a local ZIP; never restores or overwrites a live database."""
from pathlib import Path
import argparse,base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
parser=argparse.ArgumentParser()
parser.add_argument("encrypted_file",type=Path)
parser.add_argument("--key-file",type=Path,required=True)
parser.add_argument("--output",type=Path,required=True)
a=parser.parse_args()
if a.output.exists():raise SystemExit("Output exists; choose a new output path.")
data=a.encrypted_file.read_bytes();header=b"KUTUPHANE-AESGCM-V1\n"
if not data.startswith(header):raise SystemExit("Unknown encrypted file format.")
key=base64.urlsafe_b64decode(a.key_file.read_text().strip())
payload=data[len(header):]
plain=AESGCM(key).decrypt(payload[:12],payload[12:],b"kutuphane-backup-v1")
a.output.write_bytes(plain)
print("Decrypted ZIP saved locally. Do not upload it to a public repository.")
