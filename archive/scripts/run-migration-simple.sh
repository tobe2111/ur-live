#!/bin/bash
echo "🚀 D1 마이그레이션 실행 중..."
npx wrangler d1 execute toss-live-commerce-db --remote --file=./migrations/0030_add_firebase_uid.sql
