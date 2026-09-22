import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { WorkflowSteps } from "./components/WorkflowSteps";
import { EvidenceBand } from "./components/EvidenceBand";
import { CaseIntake } from "./components/CaseIntake";
import { Disclaimer } from "./components/Disclaimer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-navy text-cream">
      <Header />
      <div aria-hidden="true" className="ct-texture" />
      <main className="flex-1">
        <Hero />
        <WorkflowSteps />
        <EvidenceBand />
        <CaseIntake />
      </main>
      <Disclaimer />
    </div>
  );
}
