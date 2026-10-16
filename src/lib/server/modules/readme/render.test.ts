import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './render';
import { readmeHtml } from './service';

const BASE = 'https://github.com/example/app/blob/main/';

describe('renderMarkdown', () => {
	it('renders headings, tables, lists and code', () => {
		const html = renderMarkdown(
			'# Title\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n- one\n\n```sh\nnpm run dev\n```\n'
		);
		expect(html).toContain('<h1>Title</h1>');
		expect(html).toContain('<td>1</td>');
		expect(html).toContain('<li>one</li>');
		expect(html).toContain('<code class="language-sh">npm run dev');
	});

	it('shows raw HTML as text', () => {
		const html = renderMarkdown(
			'<script>alert(1)</script>\n\nhi <img src=x onerror=alert(1)> <b>x</b>'
		);
		expect(html).not.toMatch(/<script|<img|<b>/);
		expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
	});

	it('refuses script and data links', () => {
		for (const url of [
			'javascript:alert(1)',
			'JaVaScRiPt:alert(1)',
			'vbscript:x',
			'data:text/html;base64,PHNjcmlwdD4='
		]) {
			const html = renderMarkdown(`[click](${url}) ![i](${url})`);
			expect(html, url).not.toMatch(/href="(javascript|vbscript|data)/i);
			expect(html, url).not.toMatch(/src="(javascript|vbscript|data)/i);
		}
	});

	it('points relative links and images into the repository', () => {
		const html = renderMarkdown('[module](src/lib/x.md) ![logo](docs/logo.png)', {
			linkBase: BASE
		});
		expect(html).toContain(`<a href="${BASE}src/lib/x.md" rel="noopener noreferrer">module</a>`);
		expect(html).toContain(`src="${BASE}docs/logo.png"`);
	});

	it('keeps only the text of relative links without a base', () => {
		const html = renderMarkdown('see [the module](src/lib/x.md) and ![a logo](logo.png)');
		expect(html).toBe('<p>see the module and a logo</p>\n');
	});

	it('leaves anchors and absolute links, which open without opener or referrer', () => {
		const html = renderMarkdown('[up](#top) [site](https://example.com) [root](/notes)');
		expect(html).toContain('<a href="#top">up</a>');
		expect(html).toContain('<a href="https://example.com" rel="noopener noreferrer">site</a>');
		expect(html).toContain('<a href="/notes">root</a>');
	});
});

describe('readmeHtml', () => {
	it("renders the repository's README", () => {
		expect(readmeHtml()).toMatch(/^<h1>/);
	});
});
