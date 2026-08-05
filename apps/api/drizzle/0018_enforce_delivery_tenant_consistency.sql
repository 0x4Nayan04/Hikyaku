CREATE UNIQUE INDEX "events_tenant_id_id_uidx" ON "events" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "endpoints_tenant_id_id_uidx" ON "endpoints" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_tenant_id_event_id_events_tenant_id_id_fk" FOREIGN KEY ("tenant_id","event_id") REFERENCES "public"."events"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_tenant_id_endpoint_id_endpoints_tenant_id_id_fk" FOREIGN KEY ("tenant_id","endpoint_id") REFERENCES "public"."endpoints"("tenant_id","id") ON DELETE cascade ON UPDATE no action;
