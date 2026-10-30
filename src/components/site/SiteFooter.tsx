/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    shell
 * @topic     app-shell
 * @purpose   Site footer: the Dudoxx copyright line and the text credit to Liquid AI (LFM3-Omni) with a link to https://www.liquid.ai.
 * @status    reusable
 *
 * `--footer-height` tall; the voice-agent stage subtracts that height. The credit is text only,
 * never a Liquid AI logo.
 */
import { getTranslations } from 'next-intl/server';

const LIQUID_AI_URL = 'https://www.liquid.ai';

export async function SiteFooter(): Promise<React.JSX.Element> {
  const t = await getTranslations('common');
  return (
    <footer aria-label={t('footer.label')} className="h-(--footer-height) chrome-bar">
      <div className="flex h-full flex-col items-center justify-center gap-xs px-(--shell-gutter) text-xs text-muted-foreground sm:flex-row sm:justify-between">
        <p>{t('footer.copyright')}</p>
        <p>
          {t.rich('footer.credit', {
            link: (chunks) => (
              <a
                href={LIQUID_AI_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link underline-offset-4 hover:underline"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>
    </footer>
  );
}
