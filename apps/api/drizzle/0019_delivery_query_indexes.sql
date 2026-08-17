DROP INDEX IF EXISTS "deliveries_status_idx";--> statement-breakpoint
CREATE INDEX "deliveries_tenant_id_status_created_at_idx" ON "deliveries" USING btree ("tenant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "deliveries_status_updated_at_idx" ON "deliveries" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "endpoints_tenant_id_status_idx" ON "endpoints" USING btree ("tenant_id","status");
