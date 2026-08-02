-- Alter users to add fullname
ALTER TABLE users ADD COLUMN IF NOT EXISTS fullname VARCHAR(255) NOT NULL DEFAULT '';

-- Alter tenants to add business_type
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_type VARCHAR(100);
