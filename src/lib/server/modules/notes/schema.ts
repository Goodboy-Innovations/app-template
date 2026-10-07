import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const notes = pgTable(
	'notes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		/** A user id from the identity module. No foreign key: modules don't share tables. */
		authorId: uuid('author_id').notNull(),
		body: text('body').notNull(),
		/** Full object key, S3_PREFIX included; null when the note has no file. */
		fileKey: text('file_key'),
		fileName: text('file_name'),
		fileSize: integer('file_size'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('notes_author_id_idx').on(t.authorId)]
);
