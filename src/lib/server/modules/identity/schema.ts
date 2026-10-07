import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const USER_ROLES = ['admin', 'user'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: text('email').notNull().unique(), // always stored lowercased
	name: text('name').notNull(),
	/** scrypt hash, see password.ts. */
	passwordHash: text('password_hash').notNull(),
	role: text('role', { enum: USER_ROLES }).notNull().default('user'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const sessions = pgTable(
	'sessions',
	{
		/** SHA-256 of the session token; the raw token only lives in the cookie. */
		id: text('id').primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
	},
	(t) => [index('sessions_user_id_idx').on(t.userId)]
);
