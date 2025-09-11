-- Create additional status lookup tables for sales orders, purchase orders, projects
CREATE TABLE IF NOT EXISTS sales_order_statuses (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  ordinal INTEGER
);

CREATE TABLE IF NOT EXISTS purchase_order_statuses (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  ordinal INTEGER
);

CREATE TABLE IF NOT EXISTS project_statuses (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  ordinal INTEGER
);

-- Seed common codes (idempotent)
INSERT INTO sales_order_statuses(code,name,ordinal) VALUES
  ('draft','Draft',10),('confirmed','Confirmed',20),('fulfilled','Fulfilled',30),('cancelled','Cancelled',90)
ON CONFLICT (code) DO NOTHING;

INSERT INTO purchase_order_statuses(code,name,ordinal) VALUES
  ('draft','Draft',10),('ordered','Ordered',20),('received','Received',30),('cancelled','Cancelled',90)
ON CONFLICT (code) DO NOTHING;

INSERT INTO project_statuses(code,name,ordinal) VALUES
  ('planned','Planned',10),('active','Active',20),('onhold','On Hold',30),('closed','Closed',90)
ON CONFLICT (code) DO NOTHING;
