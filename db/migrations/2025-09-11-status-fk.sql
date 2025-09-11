-- Seed status lookup tables (idempotent)
INSERT INTO task_statuses(code,name) VALUES
  ('open','Open'),('in_progress','In Progress'),('done','Done'),('cancelled','Cancelled')
ON CONFLICT (code) DO NOTHING;

INSERT INTO timesheet_statuses(code,name) VALUES
  ('draft','Draft'),('submitted','Submitted'),('approved','Approved'),('rejected','Rejected')
ON CONFLICT (code) DO NOTHING;

INSERT INTO invoice_statuses(code,name) VALUES
  ('draft','Draft'),('issued','Issued'),('paid','Paid'),('cancelled','Cancelled')
ON CONFLICT (code) DO NOTHING;

-- Add FK constraints as NOT VALID (online)
ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_fk FOREIGN KEY (status)
  REFERENCES task_statuses(code) NOT VALID;

ALTER TABLE timesheets
  ADD CONSTRAINT timesheets_status_fk FOREIGN KEY (approval_status)
  REFERENCES timesheet_statuses(code) NOT VALID;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_fk FOREIGN KEY (status)
  REFERENCES invoice_statuses(code) NOT VALID;

-- Validate constraints (may take time)
ALTER TABLE tasks VALIDATE CONSTRAINT tasks_status_fk;
ALTER TABLE timesheets VALIDATE CONSTRAINT timesheets_status_fk;
ALTER TABLE invoices VALIDATE CONSTRAINT invoices_status_fk;

-- Optional: drop existing CHECK constraints after validation
-- ALTER TABLE tasks DROP CONSTRAINT tasks_status_check;
-- ALTER TABLE timesheets DROP CONSTRAINT timesheets_approval_status_check;
-- ALTER TABLE invoices DROP CONSTRAINT invoices_status_check;
