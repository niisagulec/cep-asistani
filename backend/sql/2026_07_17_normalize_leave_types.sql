BEGIN;

UPDATE leave_requests
SET leave_type = 'EXCUSE'
WHERE leave_type = 'CASUAL';

UPDATE leave_requests
SET leave_type = 'HEALTH'
WHERE leave_type = 'SICK';

ALTER TABLE leave_requests
DROP CONSTRAINT IF EXISTS ck_leave_requests_leave_type;

ALTER TABLE leave_requests
ADD CONSTRAINT ck_leave_requests_leave_type
CHECK (leave_type IN ('ANNUAL', 'HEALTH', 'EXCUSE', 'UNPAID'));

COMMIT;
