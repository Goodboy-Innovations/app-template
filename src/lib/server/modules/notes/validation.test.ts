import { describe, expect, it } from 'vitest';
import { MAX_BODY_LENGTH, checkBody, cleanFileName } from './validation';

describe('checkBody', () => {
	it('trims the text and rejects empty or too long notes', () => {
		expect(checkBody('  hello \n')).toEqual({ ok: true, value: 'hello' });
		expect(checkBody('   ')).toMatchObject({ ok: false });
		expect(checkBody('x'.repeat(MAX_BODY_LENGTH + 1))).toMatchObject({ ok: false });
	});
});

describe('cleanFileName', () => {
	it('keeps the base name without control characters or quotes', () => {
		expect(cleanFileName('C:\\Users\\me\\report "final".pdf')).toBe('report final.pdf');
		expect(cleanFileName('../../etc/passwd')).toBe('passwd');
		expect(cleanFileName('a\nb.txt')).toBe('ab.txt');
		expect(cleanFileName('')).toBe('file');
	});
});
