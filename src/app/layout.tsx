import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { MotionRoot } from "@/components/MotionRoot";
import { World } from "@/components/World";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nimbo | Rain, played.",
  description:
    "Thermostatic shower systems with piano-key mixers, stone basins, solid brass taps and the Piano kitchen sink. Press a key, change the weather.",
};

/**
 * Runs before first paint. If WebGL exists the page is laid out for the world ("pending", then "on"
 * once a frame has drawn); otherwise every section keeps its own solid background ("off").
 * With no JavaScript the attribute is absent, which is the same as "off".
 */
const WORLD_PROBE = `(function(){var d=document.documentElement;try{var c=document.createElement("canvas");var g=c.getContext("webgl2")||c.getContext("webgl");if(g){var x=g.getExtension("WEBGL_lose_context");if(x)x.loseContext();d.dataset.world="pending"}else d.dataset.world="off"}catch(e){d.dataset.world="off"}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: WORLD_PROBE }} />
      </head>
      <body>
        <World />
        <MotionRoot>{children}</MotionRoot>
      </body>
    </html>
  );
}
