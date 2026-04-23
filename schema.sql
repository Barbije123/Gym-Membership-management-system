-- ============================================================
--  IronForge Gym Management System — MySQL Schema
--  Run this file once to set up the database:
--    mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS ironforge_gym
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ironforge_gym;

-- ─────────────────────────────────────────────
--  TRAINERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trainers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  phone       VARCHAR(20),
  email       VARCHAR(100),
  speciality  ENUM('Strength','Cardio','Functional','Yoga','CrossFit','Nutrition') NOT NULL DEFAULT 'Strength',
  experience  TINYINT UNSIGNED DEFAULT 0 COMMENT 'Years of experience',
  salary      DECIMAL(10,2) DEFAULT 0.00,
  status      ENUM('Active','On Leave','Inactive') NOT NULL DEFAULT 'Active',
  joined_on   DATE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
--  MEMBERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  phone       VARCHAR(20),
  email       VARCHAR(100),
  plan        ENUM('Monthly','Quarterly','Half-Yearly','Annual') NOT NULL DEFAULT 'Monthly',
  trainer_id  INT DEFAULT NULL,
  status      ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  joined_on   DATE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_member_trainer
    FOREIGN KEY (trainer_id) REFERENCES trainers(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

-- ─────────────────────────────────────────────
--  PAYMENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  member_id   INT NOT NULL,
  plan        ENUM('Monthly','Quarterly','Half-Yearly','Annual') NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  method      ENUM('Cash','UPI','Card','Bank Transfer') NOT NULL DEFAULT 'Cash',
  status      ENUM('Paid','Pending') NOT NULL DEFAULT 'Paid',
  paid_on     DATE,
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_member
    FOREIGN KEY (member_id) REFERENCES members(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- ─────────────────────────────────────────────
--  EQUIPMENT
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  category     ENUM('Cardio','Strength','Functional','Free Weights','Accessories') NOT NULL DEFAULT 'Strength',
  quantity     SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  cost         DECIMAL(10,2) DEFAULT 0.00,
  `condition`  ENUM('good','maintenance','broken') NOT NULL DEFAULT 'good',
  purchased_on DATE,
  notes        TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
--  SEED DATA (optional — comment out to skip)
-- ─────────────────────────────────────────────
INSERT INTO trainers (name, phone, email, speciality, experience, salary, status, joined_on) VALUES
  ('Vikram Nair',  '+91 9900112233', 'vikram@ironforge.in', 'Strength',    8, 30000.00, 'Active',   '2020-01-15'),
  ('Priya Menon',  '+91 8877665544', 'priya@ironforge.in',  'Cardio',      5, 25000.00, 'Active',   '2021-06-01'),
  ('Rahul Desai',  '+91 9988776655', 'rahul@ironforge.in',  'Functional',  3, 22000.00, 'On Leave', '2022-03-10');

INSERT INTO members (name, phone, email, plan, trainer_id, status, joined_on) VALUES
  ('Arjun Sharma', '+91 9876543210', 'arjun@mail.com', 'Monthly',    1, 'Active',   '2025-03-01'),
  ('Riya Patel',   '+91 8765432109', 'riya@mail.com',  'Quarterly',  2, 'Active',   '2025-02-15'),
  ('Suresh Kumar', '+91 7654321098', '',               'Annual',     NULL, 'Inactive', '2024-01-10');

INSERT INTO payments (member_id, plan, amount, method, status, paid_on) VALUES
  (1, 'Monthly',    1500.00,  'UPI',           'Paid',    '2025-03-01'),
  (2, 'Quarterly',  4000.00,  'Cash',          'Paid',    '2025-02-15'),
  (3, 'Annual',     12000.00, 'Bank Transfer', 'Pending', '2024-01-10');

INSERT INTO equipment (name, category, quantity, cost, `condition`, purchased_on) VALUES
  ('Treadmill',          'Cardio',       4,  85000.00,  'good',        '2024-06-01'),
  ('Barbell Set',        'Strength',     8,  25000.00,  'good',        '2024-06-01'),
  ('Rowing Machine',     'Cardio',       2,  60000.00,  'maintenance', '2023-11-10'),
  ('Dumbbells (5-50kg)', 'Free Weights', 20, 40000.00,  'good',        '2024-01-05'),
  ('Resistance Bands',   'Accessories',  15,  5000.00,  'good',        '2024-03-20'),
  ('Smith Machine',      'Strength',     2, 150000.00,  'broken',      '2023-05-15');

-- ─────────────────────────────────────────────
--  USEFUL VIEWS
-- ─────────────────────────────────────────────

-- Member details with trainer name
CREATE OR REPLACE VIEW vw_members AS
  SELECT
    m.id,
    m.name,
    m.phone,
    m.email,
    m.plan,
    m.status,
    m.joined_on,
    t.id   AS trainer_id,
    t.name AS trainer_name
  FROM members m
  LEFT JOIN trainers t ON m.trainer_id = t.id;

-- Payment history with member name
CREATE OR REPLACE VIEW vw_payments AS
  SELECT
    p.id,
    p.member_id,
    m.name  AS member_name,
    p.plan,
    p.amount,
    p.method,
    p.status,
    p.paid_on,
    p.notes,
    p.created_at
  FROM payments p
  JOIN members m ON p.member_id = m.id;

-- Dashboard summary
CREATE OR REPLACE VIEW vw_dashboard AS
  SELECT
    (SELECT COUNT(*) FROM members)                                   AS total_members,
    (SELECT COUNT(*) FROM members WHERE status = 'Active')           AS active_members,
    (SELECT COUNT(*) FROM trainers)                                  AS total_trainers,
    (SELECT COUNT(*) FROM trainers WHERE status = 'Active')          AS active_trainers,
    (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='Paid') AS total_revenue,
    (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='Pending') AS pending_revenue,
    (SELECT COALESCE(SUM(quantity),0) FROM equipment)                AS total_equipment,
    (SELECT COUNT(*) FROM equipment WHERE `condition`='maintenance') AS equipment_maintenance;
