import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** One row per admin browser signed in through OIDC. Admins have no row in `users`. */
export const adminSessions = pgTable('admin_sessions', {
	/** SHA-256 of the session token; the raw token only lives in the cookie. */
	id: text('id').primaryKey(),
	/** The provider's `sub` for the admin. */
	subject: text('subject').notNull(),
	email: text('email').notNull(),
	name: text('name').notNull(),
	/** The user the admin acts as, an id from `identity` (no foreign key); null when not acting. */
	actingAs: uuid('acting_as'),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});

/** Every admin sign-in, refusal, switch and exit. Never updated or deleted by the app. */
export const adminAccessLog = pgTable(
	'admin_access_log',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
		subject: text('subject').notNull(),
		email: text('email').notNull(),
		action: text('action', {
			enum: ['sign-in', 'refused', 'act-as', 'exit', 'sign-out']
		}).notNull(),
		/** The user acted as (act-as, exit). */
		targetUserId: uuid('target_user_id'),
		targetEmail: text('target_email')
	},
	(t) => [index('admin_access_log_at_idx').on(t.at)]
);
