import ReactMarkdown from "react-markdown";

// raw HTML is NOT enabled in react-markdown by default → model output can't inject <script>.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-wn">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
