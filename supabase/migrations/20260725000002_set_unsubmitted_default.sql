-- 2. Alter default value on profiles table
ALTER TABLE public.profiles ALTER COLUMN approval_status SET DEFAULT 'unsubmitted';

-- 3. Update existing users who have not submitted details from 'pending' to 'unsubmitted'
UPDATE public.profiles
SET approval_status = 'unsubmitted'
WHERE approval_status = 'pending'
  AND house_number IS NULL
  AND requested_affiliation IS NULL;
