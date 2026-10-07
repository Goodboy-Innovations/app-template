export { MIN_PASSWORD_LENGTH } from './password';
export { USER_ROLES, type UserRole } from './schema';
export {
	SESSION_COOKIE,
	authenticate,
	countUsers,
	createSession,
	createUser,
	findUserByEmail,
	getUserNames,
	invalidateSession,
	setPassword,
	validateSession,
	verifyUserPassword,
	type SessionUser,
	type SignInResult
} from './service';
