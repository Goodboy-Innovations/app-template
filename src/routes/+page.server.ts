import { readmeHtml } from '$lib/server/modules/readme';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ readme: readmeHtml() });
