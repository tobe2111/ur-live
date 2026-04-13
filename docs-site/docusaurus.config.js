// @ts-check
const { themes: prismThemes } = require('prism-react-renderer')

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: '유어딜 (UR Deal)',
  tagline: '인플루언서 라이브 방송으로 만나는 최저가 특가 · 맛집 공동구매',
  favicon: 'img/favicon.ico',

  url: 'https://docs.ur-team.com',
  baseUrl: '/',

  organizationName: 'urdeal',
  projectName: 'urdeal-docs',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'ko',
    locales: ['ko'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: undefined,
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          blogTitle: '유어딜 블로그',
          blogDescription: '라이브 커머스 트렌드, 셀러 성공 사례, 플랫폼 업데이트 소식',
          postsPerPage: 9,
          blogSidebarTitle: '최근 글',
          blogSidebarCount: 10,
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'ignore',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: ['/tags/**'],
          filename: 'sitemap.xml',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/og-image.png',
      metadata: [
        { name: 'keywords', content: '라이브 커머스, 맛집 공동구매, 인플루언서 쇼핑, 라이브 방송, 타임딜, 경매' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      navbar: {
        title: '유어딜',
        logo: {
          alt: '유어딜 로고',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: '가이드',
          },
          { to: '/blog', label: '블로그', position: 'left' },
          {
            href: 'https://live.ur-team.com',
            label: '유어딜 바로가기',
            position: 'right',
          },
          {
            href: 'https://live.ur-team.com/seller/login',
            label: '셀러 시작하기',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: '가이드',
            items: [
              { label: '셀러 시작 가이드', to: '/docs/seller/getting-started' },
              { label: '라이브 방송 설정', to: '/docs/seller/live-setup' },
              { label: '딜 포인트 안내', to: '/docs/buyer/deal-points' },
            ],
          },
          {
            title: '서비스',
            items: [
              { label: '유어딜 홈', href: 'https://live.ur-team.com' },
              { label: '셀러 대시보드', href: 'https://live.ur-team.com/seller' },
              { label: '라이브 방송', href: 'https://live.ur-team.com/live' },
            ],
          },
          {
            title: '더 보기',
            items: [
              { label: '블로그', to: '/blog' },
              { label: '공지사항', to: '/blog/tags/공지' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} 리스터코퍼레이션. All rights reserved.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
    }),
}

module.exports = config
