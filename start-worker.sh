#!/bin/bash
cd /home/user/webapp
WRANGLER_HOST=0.0.0.0 npx wrangler dev --local --ip 0.0.0.0 --port 8787 2>&1
