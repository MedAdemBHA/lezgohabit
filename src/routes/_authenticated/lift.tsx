import { createFileRoute } from '@tanstack/react-router';
import { ComingSoon } from '@/components/lezgo/coming-soon';
export const Route = createFileRoute('/_authenticated/lift')({ head: () => ({ meta: [{ title: 'Lift — lezgo' }, { name: 'description', content: 'Your lezgo training space.' }, { property: 'og:title', content: 'Lift — lezgo' }, { property: 'og:description', content: 'Your lezgo training space.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: () => <ComingSoon kind="lift" /> });
