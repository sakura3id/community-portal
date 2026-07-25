ALTER TYPE public.approval_status ADD VALUE IF NOT EXISTS 'unsubmitted' BEFORE 'pending';
