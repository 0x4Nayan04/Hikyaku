CREATE INDEX "events_tenant_id_created_at_replacement_idx" ON "events" USING btree ("tenant_id", "created_at", "id");--> statement-breakpoint
CREATE INDEX "events_tenant_id_status_created_at_idx" ON "events" USING btree ("tenant_id", "status", "created_at", "id");--> statement-breakpoint
CREATE INDEX "deliveries_tenant_id_created_at_replacement_idx" ON "deliveries" USING btree ("tenant_id", "created_at", "id");--> statement-breakpoint
CREATE INDEX "deliveries_tenant_id_status_created_at_replacement_idx" ON "deliveries" USING btree ("tenant_id", "status", "created_at", "id");--> statement-breakpoint
DROP INDEX "events_tenant_id_created_at_idx";--> statement-breakpoint
DROP INDEX "deliveries_tenant_id_created_at_idx";--> statement-breakpoint
DROP INDEX "deliveries_tenant_id_status_created_at_idx";--> statement-breakpoint
ALTER INDEX "events_tenant_id_created_at_replacement_idx" RENAME TO "events_tenant_id_created_at_idx";--> statement-breakpoint
ALTER INDEX "deliveries_tenant_id_created_at_replacement_idx" RENAME TO "deliveries_tenant_id_created_at_idx";--> statement-breakpoint
ALTER INDEX "deliveries_tenant_id_status_created_at_replacement_idx" RENAME TO "deliveries_tenant_id_status_created_at_idx";
