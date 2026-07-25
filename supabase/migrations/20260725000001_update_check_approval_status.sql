-- 1. Drop the old check constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_approval_status;

-- 2. Re-add the check constraint with 'unsubmitted' included
ALTER TABLE public.profiles ADD CONSTRAINT check_approval_status CHECK (approval_status IN ('unsubmitted', 'pending', 'approved', 'suspended', 'rejected'));
