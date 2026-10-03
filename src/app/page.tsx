import { Hero } from "@/components/Hero";
import { Range } from "@/components/Range";
import { Exploded } from "@/components/Exploded";
import { TechSheet } from "@/components/TechSheet";
import { Configurator } from "@/components/Configurator";
import { Showrooms } from "@/components/Showrooms";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Hero />
      <Range />
      <Exploded />
      <TechSheet />
      <Configurator />
      <Showrooms />
      <Footer />
    </main>
  );
}
