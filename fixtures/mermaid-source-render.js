(() => {
  const MERMAID_SELECTOR = "pre.mermaid, code.language-mermaid";
  const MERMAID_RUNTIME_URLS = [
    "../node_modules/mermaid/dist/mermaid.min.js",
    "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"
  ];

  function startMermaidSourceRender() {
    if (isInsideRenderedHtmlDiffReport() || !document.querySelector(MERMAID_SELECTOR)) {
      return;
    }

    loadMermaidRuntime(0)
      .then((mermaid) => renderMermaidGraphs(mermaid))
      .catch((error) => markMermaidRenderError(error));
  }

  function isInsideRenderedHtmlDiffReport() {
    // The diff report needs to collect the original Mermaid source before it
    // renders diagrams. This guard lets source HTML render when opened directly
    // while staying inert inside the report iframe.
    return Boolean(window.__rhdBridgeConfig || window.__renderedHtmlDiffBridge);
  }

  function loadMermaidRuntime(index) {
    if (window.mermaid && typeof window.mermaid.render === "function") {
      return Promise.resolve(window.mermaid);
    }

    if (index >= MERMAID_RUNTIME_URLS.length) {
      return Promise.reject(new Error("Mermaid runtime could not be loaded."));
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = MERMAID_RUNTIME_URLS[index];
      script.async = true;
      script.onload = () => {
        if (window.mermaid && typeof window.mermaid.render === "function") {
          resolve(window.mermaid);
          return;
        }

        reject(new Error("Mermaid runtime loaded without a render function."));
      };
      script.onerror = () => reject(new Error(`Failed to load ${script.src}`));
      document.head.append(script);
    }).catch(() => loadMermaidRuntime(index + 1));
  }

  async function renderMermaidGraphs(mermaid) {
    if (isInsideRenderedHtmlDiffReport()) {
      return;
    }

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      deterministicIds: true,
      deterministicIDSeed: "rendered-html-diff-source",
      flowchart: {
        curve: "basis",
        htmlLabels: false
      },
      themeVariables: {
        background: "#ffffff",
        primaryColor: "#ddf4ff",
        primaryBorderColor: "#0969da",
        primaryTextColor: "#24292f",
        secondaryColor: "#dafbe1",
        secondaryBorderColor: "#2da44e",
        tertiaryColor: "#fff8c5",
        tertiaryBorderColor: "#9a6700",
        lineColor: "#57606a",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
      }
    });

    const blocks = Array.from(document.querySelectorAll(MERMAID_SELECTOR));

    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      const source = extractMermaidSource(block);

      block.setAttribute("data-rhd-graphic-source", source);

      if (!source) {
        continue;
      }

      try {
        const renderId = `rhd-source-mermaid-${index}-${fingerprint(source)}`;
        const result = await mermaid.render(renderId, source);
        const rendered = document.createElement("div");

        // Preserve author attributes, especially data-diff-key, so the same
        // source file still works as input for rendered-html-diff later.
        for (const attr of Array.from(block.attributes)) {
          rendered.setAttribute(attr.name, attr.value);
        }

        rendered.classList.remove("mermaid", "language-mermaid");
        rendered.classList.add("mermaid-rendered");
        rendered.setAttribute("data-rhd-graphic-source", source);
        rendered.innerHTML = result.svg;
        block.replaceWith(rendered);
      } catch (error) {
        block.classList.add("mermaid-render-error");
        block.setAttribute(
          "data-rhd-render-error",
          error && error.message ? error.message : "Mermaid render failed"
        );
      }
    }
  }

  function extractMermaidSource(block) {
    const htmlSource = block.innerHTML || block.textContent || "";
    const sourceWithTextLineBreaks = htmlSource.replace(/<br\s*\/?>/gi, "\n");
    return normalizeMermaidSource(decodeMermaidSourceEntities(sourceWithTextLineBreaks));
  }

  function decodeMermaidSourceEntities(source) {
    const mermaidLineBreakPlaceholder = "__RHD_MERMAID_BR__";

    // Browsers encode Mermaid arrows and label markup inside <pre>. Decode the
    // syntax, but keep label line breaks encoded so Mermaid parses them safely.
    return source
      .replace(/&amp;lt;/gi, "&lt;")
      .replace(/&amp;gt;/gi, "&gt;")
      .replace(/&amp;nbsp;/gi, " ")
      .replace(/&amp;quot;/gi, "&quot;")
      .replace(/&amp;apos;/gi, "&apos;")
      .replace(/&lt;br\s*\/?&gt;/gi, mermaidLineBreakPlaceholder)
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&amp;/gi, "&")
      .replace(/&nbsp;/gi, " ")
      .replace(new RegExp(mermaidLineBreakPlaceholder, "g"), "&lt;br/&gt;");
  }

  function normalizeMermaidSource(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");

    while (lines.length > 0 && lines[0].trim() === "") {
      lines.shift();
    }

    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }

    const indents = lines
      .filter((line) => line.trim() !== "")
      .map((line) => line.match(/^\s*/)[0].length);
    const smallestIndent = indents.length > 0 ? Math.min(...indents) : 0;

    return lines.map((line) => line.slice(smallestIndent)).join("\n").trim();
  }

  function fingerprint(value) {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }

    return Math.abs(hash).toString(36);
  }

  function markMermaidRenderError(error) {
    for (const block of document.querySelectorAll(MERMAID_SELECTOR)) {
      block.classList.add("mermaid-render-error");
      block.setAttribute(
        "data-rhd-render-error",
        error && error.message ? error.message : "Mermaid render failed"
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startMermaidSourceRender, { once: true });
  } else {
    startMermaidSourceRender();
  }
})();
