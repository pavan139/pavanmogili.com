import { ask } from '../../content';
import { highlight, search, type Answer } from './search';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderAnswer(a: Answer): string {
  if (!a.query.trim()) return '';
  if (a.refused) {
    return `<div class="answer-refusal"><p><strong>Nothing found.</strong> ${esc(ask.refusal)}</p><p class="answer-summary">Searched ${a.searched} sentences from ${a.readmes} READMEs for “${esc(a.query)}”.</p></div>`;
  }
  const items = a.hits
    .map(
      (h) => `<div class="answer">
        <blockquote cite="${h.url}"><p>${highlight(h.text, h.terms)}</p></blockquote>
        <p class="answer-meta"><span class="answer-verified">Verbatim</span><a href="${h.url}">${esc(h.repo)} README, ${esc(h.section)}</a></p>
      </div>`,
    )
    .join('');
  return `<p class="answer-summary">${a.hits.length} quote${a.hits.length > 1 ? 's' : ''} from ${a.searched} sentences in ${a.readmes} READMEs. Matched words are highlighted.</p>${items}`;
}

export function run(query: string): void {
  const out = document.querySelector<HTMLElement>('[data-ask-results]');
  if (out) out.innerHTML = renderAnswer(search(query));
}
