ALTER TABLE attendance_records
    ADD COLUMN IF NOT EXISTS is_voided BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE attendance_correction_requests
    ADD COLUMN IF NOT EXISTS replacement_record_id INTEGER NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_attendance_correction_replacement_record'
    ) THEN
        ALTER TABLE attendance_correction_requests
            ADD CONSTRAINT fk_attendance_correction_replacement_record
            FOREIGN KEY (replacement_record_id) REFERENCES attendance_records(id);
    END IF;
END $$;
