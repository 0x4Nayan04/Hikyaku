DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "users"
		GROUP BY lower("email")
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot normalize user emails: case-insensitive duplicates exist';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
UPDATE "users" SET "email" = lower("email") WHERE "email" <> lower("email");--> statement-breakpoint
UPDATE "invites" SET "email" = lower("email") WHERE "email" <> lower("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_ci_uidx" ON "users" USING btree (lower("email"));
