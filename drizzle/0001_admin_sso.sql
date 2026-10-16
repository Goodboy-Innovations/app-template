CREATE TABLE "admin_access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"subject" text NOT NULL,
	"email" text NOT NULL,
	"action" text NOT NULL,
	"target_user_id" uuid,
	"target_email" text
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"acting_as" uuid,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "admin_access_log_at_idx" ON "admin_access_log" USING btree ("at");