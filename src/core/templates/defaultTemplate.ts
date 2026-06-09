export interface DefaultMarkdownTemplateInput {
  title: string;
  url: string;
  site: string;
  capturedAt: string;
  content: string;
}

function normalizeTemplateValue(value: string): string {
  return value.replace(/\r?\n/g, " ").trim();
}

export function renderDefaultMarkdown(input: DefaultMarkdownTemplateInput): string {
  const title = normalizeTemplateValue(input.title);
  const url = normalizeTemplateValue(input.url);
  const site = normalizeTemplateValue(input.site);
  const capturedAt = normalizeTemplateValue(input.capturedAt);
  const content = input.content.trim();

  return `---
title: ${title}
url: ${url}
site: ${site}
captured: ${capturedAt}
------------------------

# ${title}

${content}`.trim();
}
