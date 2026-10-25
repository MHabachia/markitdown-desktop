import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Renders Markdown to HTML that is safe to put into the DOM.
 * Converted documents are untrusted input: raw HTML in them (scripts, event handlers,
 * javascript: links) must never reach the page unsanitized.
 */
export function renderMarkdown(markdown: string): string {
  try {
    const html = marked.parse(markdown, { async: false }) as string;
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'button'] });
  } catch {
    return '<p>Der Inhalt konnte nicht dargestellt werden.</p>';
  }
}

/** Click handler for rendered previews: links would navigate the app window away. */
export function blockLinkNavigation(e: React.MouseEvent<HTMLElement>) {
  if ((e.target as HTMLElement).closest('a')) e.preventDefault();
}
