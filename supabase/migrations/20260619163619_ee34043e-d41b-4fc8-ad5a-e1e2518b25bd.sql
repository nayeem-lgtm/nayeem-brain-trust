
-- Rename existing enum values to match the new naming
ALTER TYPE public.task_status RENAME VALUE 'not_started' TO 'pending';
ALTER TYPE public.task_status RENAME VALUE 'in_progress' TO 'ongoing';
ALTER TYPE public.task_status RENAME VALUE 'waiting' TO 'on_hold';

-- Add new "upcoming" status
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'upcoming';

-- Recurrence enum
DO $$ BEGIN
  CREATE TYPE public.task_recurrence AS ENUM ('none', 'daily', 'weekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- New columns on tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS recurrence public.task_recurrence NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_until timestamptz;

-- Update default for new tasks
ALTER TABLE public.tasks ALTER COLUMN status SET DEFAULT 'pending'::public.task_status;
