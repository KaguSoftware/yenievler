import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Archivo } from "next/font/google";
import "../globals.css";
import { MotionRoot } from "@/components/MotionRoot";
import { World } from "@/components/World";
import { LOCALES, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { I18nProvider } from "@/i18n/provider";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const { meta } = await getDictionary(lang);
  return {
    title: meta.title,
    description: meta.description,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])) },
  };
}

/**
 * Runs before first paint. If WebGL exists the page is laid out for the world ("pending", then "on"
 * once a frame has drawn); otherwise every section keeps its own solid background ("off").
 * With no JavaScript the attribute is absent, which is the same as "off".
 */
const WORLD_PROBE = `(function(){var d=document.documentElement;try{var c=document.createElement("canvas");var g=c.getContext("webgl2")||c.getContext("webgl");if(g){var x=g.getExtension("WEBGL_lose_context");if(x)x.loseContext();d.dataset.world="pending"}else d.dataset.world="off"}catch(e){d.dataset.world="off"}})()`;

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <html lang={lang} className={`${archivo.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: WORLD_PROBE }} />
      </head>
      <body>
        <World />
        <I18nProvider lang={lang} dict={dict}>
          <MotionRoot>{children}</MotionRoot>
        </I18nProvider>
      </body>
    </html>
  );
}
