CREATE INDEX "deliveries_tenant_id_status_updated_at_idx" ON "deliveries" USING btree ("tenant_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "deliveries_tenant_id_endpoint_id_created_at_idx" ON "deliveries" USING btree ("tenant_id","endpoint_id","created_at" DESC);--> statement-breakpoint
DROP INDEX IF EXISTS "delivery_attempts_delivery_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "endpoints_tenant_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "deliveries_status_updated_at_idx";--> statement-breakpoint
CREATE INDEX "deliveries_status_updated_at_idx" ON "deliveries" USING btree ("status","updated_at") WHERE "status" IN ('pending', 'in_progress');
