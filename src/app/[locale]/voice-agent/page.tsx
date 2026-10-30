/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       page
 * @domain    integration
 * @route     /[locale]/voice-agent
 * @purpose   Voice agent page: the icedLiquid live voice assistant (ASR, tool-calling brain and speech all in this browser on WebGPU).
 * @status    active
 *
 * Server shell only, app-style frame: header, a visually hidden h1, the stage filling the viewport
 * between header and footer, footer. The IcedLiquidStage island runs the agent; model knobs come
 * from `@/config`, tools run on the agent-tools route.
 */
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { IcedLiquidStage } from '@/components/icedliquid/IcedLiquidStage';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'voice' });
  return { title: t('agentPage.metaTitle'), description: t('agentPage.description') };
}

export default async function VoiceAgentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('voice');
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="min-w-0 flex-1 px-(--shell-gutter) py-md">
        <h1 className="sr-only">{t('agentPage.title')}</h1>
        <IcedLiquidStage />
      </main>
      <SiteFooter />
    </div>
  );
}
