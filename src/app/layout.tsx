import type { Metadata, Viewport } from 'next';
import './globals.css';
// Vercel supplies this hostname automatically; no manual environment setup is required.
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || 'fan-food.vercel.app';
export const metadata: Metadata = {
    metadataBase: new URL(`https://${productionHost}`),
    title: 'فن فود | من مطبخنا إلى لمّتكم',
    description: 'منيو فن فود: دولمة، رز وولائم، كبة، معجنات وحلويات. اختار أكلاتك وأحجامها، واجمع طلبك بسلة واحدة وارسله عبر واتساب.',
    applicationName: 'فن فود',
    icons: { icon: '/icon.svg', apple: '/apple-icon.png' },
    manifest: '/manifest.webmanifest',
    openGraph: { title: 'فن فود — أكل البيت، بروح اليوم.', description: 'اختار سفرتك من منيو فن فود واطلب مباشرة عبر واتساب.', locale: 'ar_IQ', type: 'website', images: [{ url: '/images/hero.webp', width: 889, height: 521, alt: 'فن فود — من مطبخنا إلى لمّتكم' }] },
    robots: { index: true, follow: true },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#1F3A29' };
export default function RootLayout({ children }: { children: React.ReactNode; }) {
    return <html lang="ar" dir="rtl"><head>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;650;700;750;800;850;900&family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet"/>
      <link rel="stylesheet" href="/menu-enhancements-v2.css"/>
      <link rel="stylesheet" href="/menu-ux-v3.css"/>
    </head><body>{children}</body></html>;
}
