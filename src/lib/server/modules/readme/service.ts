import { renderMarkdown } from './render';
// The repository's README, read when the app is built: the runtime image has no source files.
import source from '../../../../../README.md?raw';

/** Where the README's relative links point. An app made from the template points this at its own repository. */
const LINK_BASE = 'https://github.com/Goodboy-Innovations/app-template/blob/main/';

let html: string | undefined;

/** The README as safe HTML, rendered once. */
export function readmeHtml(): string {
	html ??= renderMarkdown(source, { linkBase: LINK_BASE });
	return html;
}
