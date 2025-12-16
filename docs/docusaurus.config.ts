import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'OpenTelemetry 완벽 가이드',
  tagline: 'OTel Agent부터 Jaeger, Tempo까지 - MSA 환경의 분산 추적 마스터하기',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  // Mermaid 다이어그램 지원
  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  // GitHub Pages 배포 설정
  url: 'https://mypalesong.github.io',
  baseUrl: '/otel/',

  organizationName: 'mypalesong',
  projectName: 'otel',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'ko',
    locales: ['ko'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/mypalesong/otel/tree/main/docs/',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/otel-social-card.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'OpenTelemetry Guide',
      logo: {
        alt: 'OTel Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'beginnerSidebar',
          position: 'left',
          label: '기초',
        },
        {
          type: 'docSidebar',
          sidebarId: 'intermediateSidebar',
          position: 'left',
          label: '중급',
        },
        {
          type: 'docSidebar',
          sidebarId: 'advancedSidebar',
          position: 'left',
          label: '고급',
        },
        {
          type: 'docSidebar',
          sidebarId: 'practicalSidebar',
          position: 'left',
          label: '실습',
        },
        {
          type: 'docSidebar',
          sidebarId: 'casestudiesSidebar',
          position: 'left',
          label: '사례연구',
        },
        {
          href: 'https://github.com/mypalesong/otel',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '문서',
          items: [
            {label: '기초', to: '/beginner/intro'},
            {label: '중급', to: '/intermediate/collector'},
            {label: '고급', to: '/advanced/msa-architecture'},
            {label: '사례연구', to: '/casestudies/enterprise-success'},
          ],
        },
        {
          title: '공식 자료',
          items: [
            {label: 'OpenTelemetry', href: 'https://opentelemetry.io'},
            {label: 'Jaeger', href: 'https://www.jaegertracing.io'},
            {label: 'Grafana Tempo', href: 'https://grafana.com/oss/tempo/'},
          ],
        },
        {
          title: '커뮤니티',
          items: [
            {label: 'CNCF Slack', href: 'https://slack.cncf.io/'},
            {label: 'GitHub Discussions', href: 'https://github.com/open-telemetry/opentelemetry-specification/discussions'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} OpenTelemetry Guide. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'docker', 'java', 'go', 'python', 'javascript', 'typescript'],
    },
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
