#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DATABASE_DSN:-}" ]; then
  echo "Error: DATABASE_DSN is not set"
  exit 1
fi

echo "--- Create Superadmin User ---"
read -p "Email: " email
read -p "Name: " name
read -s -p "Password: " password
echo

# Hash password using bcrypt (fallback to python3 if htpasswd missing)
if command -v htpasswd &> /dev/null; then
  hashed=$(htpasswd -bnBC 10 "" "$password" | tr -d ':\n')
elif command -v python3 &> /dev/null; then
  hashed=$(echo "$password" | python3 -c "
import bcrypt, sys
pw = sys.stdin.read().strip().encode('utf-8')
print(bcrypt.hashpw(pw, bcrypt.gensalt(10)).decode('utf-8'))
")
else
  echo "Error: Neither htpasswd nor python3 found. Install apache2-utils or python3-bcrypt."
  exit 1
fi

echo "Inserting superadmin..."
result=$(psql "$DATABASE_DSN" -v ON_ERROR_STOP=1 \
  -v name="$name" \
  -v email="$email" \
  -v hash="$hashed" \
  -t -c "
INSERT INTO ops.users (name, email, hashed_password, role, is_active)
VALUES (:'name', :'email', :'hash', 'superadmin', true)
RETURNING id;")

id=$(echo "$result" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
echo "Created user ID: $id"
