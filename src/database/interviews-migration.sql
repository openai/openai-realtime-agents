-- Migration script to update interviews table schema
-- Add reference columns to interviews table

-- Check if the columns already exist and add them if they don't
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'interviews' AND column_name = 'company_id') THEN
    ALTER TABLE interviews ADD COLUMN company_id UUID REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'interviews' AND column_name = 'person_id') THEN
    ALTER TABLE interviews ADD COLUMN person_id UUID REFERENCES people(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'interviews' AND column_name = 'support_engagement_id') THEN
    ALTER TABLE interviews ADD COLUMN support_engagement_id UUID REFERENCES support_engagements(id);
  END IF;

  -- Create an index on the foreign key columns for better performance
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_interviews_company_id') THEN
    CREATE INDEX idx_interviews_company_id ON interviews(company_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_interviews_person_id') THEN
    CREATE INDEX idx_interviews_person_id ON interviews(person_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_interviews_support_engagement_id') THEN
    CREATE INDEX idx_interviews_support_engagement_id ON interviews(support_engagement_id);
  END IF;
END $$; 