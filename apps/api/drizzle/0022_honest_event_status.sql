UPDATE events e SET status = CASE
  WHEN EXISTS (SELECT 1 FROM deliveries d WHERE d.event_id = e.id AND d.status IN ('pending', 'in_progress')) THEN 'pending'
  WHEN NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.event_id = e.id) THEN 'no_recipients'
  WHEN EXISTS (SELECT 1 FROM deliveries d WHERE d.event_id = e.id AND d.status = 'succeeded')
   AND EXISTS (SELECT 1 FROM deliveries d WHERE d.event_id = e.id AND d.status = 'failed') THEN 'partial_failure'
  WHEN EXISTS (SELECT 1 FROM deliveries d WHERE d.event_id = e.id AND d.status = 'failed') THEN 'failed'
  ELSE 'completed'
END;
