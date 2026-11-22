import { createFileRoute } from '@tanstack/react-router';
import { ComingSoon } from '@/components/lezgo/coming-soon';
export const Route = createFileRoute('/_authenticated/boss')({ head: () => ({ meta: [{ title: 'Boss — lezgo' }, { name: 'description', content: 'The lezgo boss challenge.' }, { property: 'og:title', content: 'Boss — lezgo' }, { property: 'og:description', content: 'The lezgo boss challenge.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: () => <ComingSoon kind="boss" /> });
