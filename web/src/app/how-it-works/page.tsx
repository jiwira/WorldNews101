export default function HowItWorks() {
  return (
    <div className="prose-wn space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">How it works</h1>
      <p>
        World &amp; Finance 101 gathers global news, clusters articles that cover the same
        story, rates how each outlet leans, and produces a neutral economic analysis —
        all with <strong>local AI</strong> on an RTX 5070 Ti. No paid APIs.
      </p>
      <h2 className="text-lg font-semibold">The agents</h2>
      <ul className="list-disc pl-5">
        <li><strong>Curator</strong> — gathers &amp; clusters the day's news.</li>
        <li><strong>Bias &amp; Framing Analyst</strong> — rates each source's lean.</li>
        <li><strong>Game-Theory Analyst</strong> — why the actors do what they do.</li>
        <li><strong>Markets Analyst</strong> — the economic impact.</li>
        <li><strong>Editor</strong> — writes the neutral, layered briefing.</li>
      </ul>
      <p className="text-sm text-slate-500">
        Built with n8n + CrewAI + Ollama. Technical case study:{" "}
        <a href="https://jiwira.com" className="text-blue-600 hover:underline">jiwira.com</a>.
      </p>
    </div>
  );
}
