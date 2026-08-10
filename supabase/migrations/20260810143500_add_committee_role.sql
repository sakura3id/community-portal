-- Migration: Add 'committee' to app_role enum
-- Target file: /Users/a/Codes/sakura3id/community-portal/supabase/migrations/20260810143500_add_committee_role.sql

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'committee';
