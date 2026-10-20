module.exports = {
  apps: [
    {
      name: 'ur-live',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=toss-live-commerce-db --kv=SESSION_KV --kv=CACHE_KV --kv=LIVE_CACHE --local --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      // 로그 설정
      out_file: './logs/ur-live-out.log',
      error_file: './logs/ur-live-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
}
