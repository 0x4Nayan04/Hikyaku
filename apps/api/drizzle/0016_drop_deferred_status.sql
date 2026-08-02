-- Convert legacy deferred deliveries to pending (rate-limit waits stay pending).
UPDATE deliveries SET status = 'pending' WHERE status = 'deferred';
