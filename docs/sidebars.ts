import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  beginnerSidebar: [
    {
      type: 'category',
      label: '기초 가이드',
      items: [
        'beginner/intro',
        'beginner/concepts',
        'beginner/architecture',
        'beginner/signals',
        'beginner/getting-started',
      ],
    },
  ],
  intermediateSidebar: [
    {
      type: 'category',
      label: '중급 가이드',
      items: [
        'intermediate/collector',
        'intermediate/collector-config',
        'intermediate/jaeger',
        'intermediate/tempo',
        'intermediate/instrumentation',
        'intermediate/context-propagation',
      ],
    },
  ],
  advancedSidebar: [
    {
      type: 'category',
      label: '고급 가이드',
      items: [
        'advanced/msa-architecture',
        'advanced/sampling-strategies',
        'advanced/production-deployment',
        'advanced/performance-optimization',
        'advanced/security',
        'advanced/troubleshooting',
      ],
    },
  ],
  practicalSidebar: [
    {
      type: 'category',
      label: '실습 예제',
      items: [
        'practical/docker-compose-setup',
        'practical/kubernetes-deployment',
        'practical/nodejs-example',
        'practical/java-example',
        'practical/python-example',
        'practical/go-example',
      ],
    },
  ],
  casestudiesSidebar: [
    {
      type: 'category',
      label: '실제 사례 연구',
      items: [
        'casestudies/enterprise-success',
        'casestudies/roi-analysis',
        'casestudies/migration-guide',
      ],
    },
  ],
};

export default sidebars;
