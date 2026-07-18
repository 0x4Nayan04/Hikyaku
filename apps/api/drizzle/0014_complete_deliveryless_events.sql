UPDATE "events"
SET "status" = 'completed'
WHERE "status" = 'pending'
  AND NOT EXISTS (
    SELECT 1
    FROM "deliveries"
    WHERE "deliveries"."event_id" = "events"."id"
  );
