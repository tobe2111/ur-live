#!/bin/bash

# Test cart API with actual Firebase token
# Get token from browser console: localStorage.getItem('firebase_token')

TOKEN="${1:-YOUR_TOKEN_HERE}"

curl -X POST https://live.ur-team.com/api/cart \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "quantity": 1,
    "options": null
  }' \
  -v

