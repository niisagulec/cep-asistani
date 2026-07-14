CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS shift_id INTEGER REFERENCES shifts(id);

CREATE INDEX IF NOT EXISTS ix_employees_shift_id
ON employees(shift_id);

CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    leave_type VARCHAR NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DOUBLE PRECISION NOT NULL,
    reason TEXT,
    status VARCHAR NOT NULL DEFAULT 'PENDING',
    reviewed_by INTEGER REFERENCES users(id),
    review_note TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_leave_requests_employee_id
ON leave_requests(employee_id);
