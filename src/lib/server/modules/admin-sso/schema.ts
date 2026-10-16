import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Every admin sign-in, refusal, switch, exit and sign-out. Never updated or deleted by the app. */
export const adminAccessLog = pgTable(
	'admin_access_log',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
		/** The provider's `sub` for the admin. */
		subject: text('subject').notNull(),
		email: text('email').notNull(),
		action: text('action', {
			enum: ['sign-in', 'refused', 'act-as', 'exit', 'sign-out']
		}).notNull(),
		/** The client address as the app sees it. */
		ip: text('ip').notNull(),
		/** The user acted as (act-as, exit): a user id from `identity`, no foreign key. */
		targetUserId: uuid('target_user_id'),
		targetEmail: text('target_email')
	},
	(t) => [index('admin_access_log_at_idx').on(t.at)]
);
