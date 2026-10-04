import { Hero } from "@/components/Hero";
import { Range } from "@/components/Range";
import { Exploded } from "@/components/Exploded";
import { TechSheet } from "@/components/TechSheet";
import { Sink } from "@/components/Sink";
import { SinkShow } from "@/components/SinkShow";
import { Configurator } from "@/components/Configurator";
import { Showrooms } from "@/components/Showrooms";
import { Footer } from "@/components/Footer";
import { Spacer } from "@/components/Spacer";

/**
 * One fall, top to bottom: hero, the dive through the head, open air, the range, the sink, down its drain, the basin,
 * the overflow, the showrooms, the pool. The 3D world is fixed behind all of it (see World).
 */
export default function Home() {
  return (
    <main className="relative z-10">
      <Hero />
      <Exploded />
      <TechSheet />
      <Spacer id="air" className="h-[130vh]" />
      <Range />
      <SinkShow />
      <Sink />
      <Spacer id="drain" className="h-[220vh]" />
      <Configurator />
      <Spacer id="spill" className="h-[170vh]" />
      <Showrooms />
      <Spacer id="pool" className="h-[150vh]" />
      <Footer />
    </main>
  );
}
