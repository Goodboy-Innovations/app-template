import MarkdownIt from 'markdown-it';

export type RenderOptions = {
	/**
	 * Where relative links point, e.g. the repository's https://github.com/<org>/<repo>/blob/main/.
	 * Without it, relative links and images are shown as their text only: on the app's own address they
	 * would lead nowhere.
	 */
	linkBase?: string;
};

const ABSOLUTE = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Markdown to HTML that is safe to put on a page: raw HTML in the source is shown as text, never as markup,
 * and markdown-it refuses javascript:, vbscript:, file: and data: links. External links open without the
 * opener and without a referrer.
 */
export function renderMarkdown(markdown: string, opts: RenderOptions = {}): string {
	const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
	const relative = (url: string) =>
		url !== '' && !ABSOLUTE.test(url) && !url.startsWith('#') && !url.startsWith('/');
	const resolve = (url: string) => (opts.linkBase ? new URL(url, opts.linkBase).href : null);

	// A link whose target can't be resolved keeps its text, without the <a>.
	const dropped = new WeakSet<object>();
	md.core.ruler.push('relative-links', (state) => {
		for (const block of state.tokens) {
			const tokens = block.children ?? [];
			const open: (number | null)[] = [];
			for (let i = 0; i < tokens.length; i++) {
				const t = tokens[i];
				if (t.type === 'link_open') {
					const href = String(t.attrGet('href') ?? '');
					if (relative(href)) {
						const resolved = resolve(href);
						if (resolved) t.attrSet('href', resolved);
						else dropped.add(t);
					}
					if (ABSOLUTE.test(String(t.attrGet('href') ?? '')) && !dropped.has(t))
						t.attrSet('rel', 'noopener noreferrer');
					open.push(dropped.has(t) ? i : null);
				} else if (t.type === 'link_close') {
					if (open.pop() !== null) dropped.add(t);
				} else if (t.type === 'image') {
					const src = String(t.attrGet('src') ?? '');
					if (relative(src)) {
						const resolved = resolve(src);
						if (resolved) t.attrSet('src', resolved);
						else dropped.add(t);
					}
				}
			}
		}
	});
	const render = md.renderer.rules;
	const original = {
		link_open: render.link_open ?? ((tokens, i, o, _env, self) => self.renderToken(tokens, i, o)),
		link_close: render.link_close ?? ((tokens, i, o, _env, self) => self.renderToken(tokens, i, o)),
		image: render.image!
	};
	render.link_open = (tokens, i, o, env, self) =>
		dropped.has(tokens[i]) ? '' : original.link_open(tokens, i, o, env, self);
	render.link_close = (tokens, i, o, env, self) =>
		dropped.has(tokens[i]) ? '' : original.link_close(tokens, i, o, env, self);
	render.image = (tokens, i, o, env, self) =>
		dropped.has(tokens[i])
			? md.utils.escapeHtml(tokens[i].content)
			: original.image(tokens, i, o, env, self);

	return md.render(markdown);
}
