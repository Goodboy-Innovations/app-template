// The tables Better Auth uses (auth.ts maps its models to them). Property names are Better Auth's
// field names; column names are the database's.

import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const USER_ROLES = ['admin', 'user'] as const;
export type UserRole = (typeof USER_ROLES)[number];

const timestamps = {
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
};

export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(), // always stored lowercased
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	role: text('role', { enum: USER_ROLES }).notNull().default('user'),
	// Better Auth's admin plugin.
	banned: boolean('banned').notNull().default(false),
	banReason: text('ban_reason'),
	banExpires: timestamp('ban_expires', { withTimezone: true }),
	...timestamps
});

export const sessions = pgTable(
	'sessions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		/** The token in the (signed) session cookie. */
		token: text('token').notNull().unique(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		/** The admin acting as this session's user (Better Auth's admin plugin); null otherwise. */
		impersonatedBy: uuid('impersonated_by'),
		...timestamps
	},
	(t) => [index('sessions_user_id_idx').on(t.userId)]
);

/** How a user signs in: provider `credential` holds the password hash; others are OAuth links. */
export const accounts = pgTable(
	'accounts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
		scope: text('scope'),
		password: text('password'),
		...timestamps
	},
	(t) => [index('accounts_user_id_idx').on(t.userId)]
);

/** One-time values: email verification, password reset, OAuth state. */
export const verifications = pgTable(
	'verifications',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		...timestamps
	},
	(t) => [index('verifications_identifier_idx').on(t.identifier)]
);
