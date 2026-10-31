CREATE TABLE IF NOT EXISTS app_users (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','employee') NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS banks (
  bank_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  bank_name VARCHAR(100) NOT NULL,
  head_office VARCHAR(160) NOT NULL,
  established_year SMALLINT UNSIGNED NULL,
  contact_no VARCHAR(20) NULL,
  email VARCHAR(160) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS branches (
  branch_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  bank_id INT UNSIGNED NOT NULL,
  branch_name VARCHAR(100) NOT NULL,
  ifsc_code VARCHAR(20) NOT NULL UNIQUE,
  address_line1 VARCHAR(180) NOT NULL,
  city VARCHAR(80) NOT NULL,
  state VARCHAR(80) NOT NULL,
  pin_code VARCHAR(12) NOT NULL,
  phone_no VARCHAR(20) NULL,
  email VARCHAR(160) NULL,
  manager_name VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_branches_bank FOREIGN KEY (bank_id) REFERENCES banks(bank_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS employees (
  emp_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  branch_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  designation VARCHAR(60) NOT NULL,
  phone_no VARCHAR(20) NULL,
  email VARCHAR(160) NULL,
  join_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_employees_branch FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS accounts (
  account_no BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  branch_id INT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  account_type VARCHAR(30) NOT NULL,
  balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  open_date DATE NOT NULL,
  status ENUM('Active','Inactive','Frozen','Closed') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_accounts_branch FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_account_balance CHECK (balance >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS loans (
  loan_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  branch_id INT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  loan_type VARCHAR(40) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL,
  start_date DATE NOT NULL,
  status ENUM('Pending','Active','Closed','Rejected') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loans_branch FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_loan_amount CHECK (amount > 0),
  CONSTRAINT chk_loan_interest CHECK (interest_rate >= 0)
) ENGINE=InnoDB;

-- Supplementary demo ledger: it supports simulated deposits, withdrawals and
-- internal transfers. It is not connected to a payment network or real bank.
CREATE TABLE IF NOT EXISTS account_transactions (
  transaction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(40) NOT NULL,
  transaction_type ENUM('DEPOSIT','WITHDRAWAL','TRANSFER_OUT','TRANSFER_IN') NOT NULL,
  account_no BIGINT UNSIGNED NOT NULL,
  related_account BIGINT UNSIGNED NULL,
  amount DECIMAL(14,2) NOT NULL,
  description VARCHAR(180) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_transactions_account_date (account_no, created_at),
  INDEX idx_transactions_reference (reference),
  CONSTRAINT fk_transactions_account FOREIGN KEY (account_no) REFERENCES accounts(account_no)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_transactions_related FOREIGN KEY (related_account) REFERENCES accounts(account_no)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_transactions_user FOREIGN KEY (created_by) REFERENCES app_users(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_transaction_amount CHECK (amount > 0)
) ENGINE=InnoDB;
