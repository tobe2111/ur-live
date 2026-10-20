# GitHub Actions 비활성화됨

현재 Cloudflare Pages 배포는 로컬에서 수동으로 진행합니다:

```bash
npm run build
npx wrangler pages deploy dist --project-name ur-live
```

GitHub Actions를 다시 활성화하려면:
1. deploy.yml.disabled → deploy.yml로 이름 변경
2. GitHub Secrets 설정:
   - CLOUDFLARE_API_TOKEN
   - CLOUDFLARE_ACCOUNT_ID
