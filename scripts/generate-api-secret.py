#!/usr/bin/env python3
"""
Génère une clé API_SECRET aléatoire (32 caractères, URL-safe).
Usage: python scripts/generate-api-secret.py
       py -3 scripts/generate-api-secret.py  (Windows)
"""
import secrets

def main():
    # 32 octets → ~43 caractères en base64 URL-safe (sans padding)
    key = secrets.token_urlsafe(32)
    print("Clé générée (à mettre dans .env comme API_SECRET) :")
    print()
    print(key)
    print()
    print("Exemple .env :")
    print(f"API_SECRET={key}")

if __name__ == "__main__":
    main()
