ALTER TABLE deliveries ADD COLUMN replay_count integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE delivery_attempts ADD COLUMN run_number integer NOT NULL DEFAULT 0;
--> statement-breakpoint
DROP INDEX delivery_attempts_delivery_id_attempt_number_idx;
--> statement-breakpoint
CREATE UNIQUE INDEX delivery_attempts_delivery_run_attempt_idx ON delivery_attempts (delivery_id, run_number, attempt_number);
