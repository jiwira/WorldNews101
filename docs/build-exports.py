#!/usr/bin/env python3
"""Regenerate HTML + DOCX exports of all project docs.

Usage:  python3 docs/build-exports.py
Run this whenever a .md doc changes (see D-010). Requires pypandoc_binary
(`pip install --user --break-system-packages pypandoc_binary`).

Converts README.md, SPEC.md and docs/*.md into docs/exports/<name>.html and .docx.
"""
import os
import pypandoc

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORTS = os.path.join(ROOT, "docs", "exports")
os.makedirs(EXPORTS, exist_ok=True)

# Self-contained CSS for the HTML exports (clean, readable, print-friendly).
STYLE = """<style>
  body{max-width:820px;margin:2.5rem auto;padding:0 1.25rem;
       font:16px/1.7 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a}
  h1,h2,h3{line-height:1.25;margin-top:2rem;color:#0b1f3a}
  h1{border-bottom:2px solid #0b1f3a;padding-bottom:.3rem}
  code{background:#f3f4f6;padding:.1rem .35rem;border-radius:4px;font-size:.9em}
  pre{background:#0b1f3a;color:#e6edf3;padding:1rem;border-radius:8px;overflow:auto}
  pre code{background:none;color:inherit;padding:0}
  table{border-collapse:collapse;width:100%;margin:1rem 0}
  th,td{border:1px solid #d0d7de;padding:.5rem .7rem;text-align:left;vertical-align:top}
  th{background:#f3f4f6}
  blockquote{border-left:4px solid #0b1f3a;margin:1rem 0;padding:.2rem 1rem;color:#444;background:#f8fafc}
  a{color:#0b5fff}
</style>"""

HEADER = os.path.join(EXPORTS, "_style.html")
with open(HEADER, "w") as f:
    f.write(STYLE)

# (relative source path, export basename)
DOCS = [
    ("README.md", "README"),
    ("SPEC.md", "SPEC"),
    ("docs/01-ARCHITECTURE.md", "01-ARCHITECTURE"),
    ("docs/02-DATABASE.md", "02-DATABASE"),
    ("docs/03-DATA-FLOW.md", "03-DATA-FLOW"),
    ("docs/04-UI-UX.md", "04-UI-UX"),
    ("docs/05-SECURITY.md", "05-SECURITY"),
    ("docs/06-DECISIONS.md", "06-DECISIONS"),
    ("docs/07-DEPLOYMENT.md", "07-DEPLOYMENT"),
]

def main():
    for src, base in DOCS:
        src_path = os.path.join(ROOT, src)
        if not os.path.exists(src_path):
            print(f"  skip (missing): {src}")
            continue
        html_out = os.path.join(EXPORTS, base + ".html")
        docx_out = os.path.join(EXPORTS, base + ".docx")
        pypandoc.convert_file(
            src_path, "html", outputfile=html_out,
            extra_args=["--standalone", f"--metadata=title:{base}",
                        f"--include-in-header={HEADER}"],
        )
        pypandoc.convert_file(
            src_path, "docx", outputfile=docx_out,
            extra_args=[f"--metadata=title:{base}"],
        )
        print(f"  ok: {base}.html  +  {base}.docx")
    print("Exports written to docs/exports/")

if __name__ == "__main__":
    main()
