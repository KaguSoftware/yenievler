import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { MotionRoot } from "@/components/MotionRoot";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nimbo | Rain, played.",
  description:
    "Thermostatic shower systems with piano-key mixers, stone basins and solid brass taps. Press a key, change the weather.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} antialiased`}>
      <body>
        <MotionRoot>{children}</MotionRoot>
      </body>
    </html>
  );
}
