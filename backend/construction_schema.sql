-- =========================================================================
-- MIGRATION SCRIPT: CONSTRUCTION MANAGEMENT & HIERARCHICAL TASK TRACKING
-- =========================================================================

-- 1. Extend the projects table with constructor, promoter and progress details
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS promoter_name TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS constructor_name TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS target_completion_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS global_progress NUMERIC DEFAULT 0;

-- 2. Create the engineers table
CREATE TABLE IF NOT EXISTS public.engineers (
    id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'ingenieur',
    email TEXT NOT NULL
);

-- Enable RLS on engineers
ALTER TABLE public.engineers ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies for engineers table
DROP POLICY IF EXISTS "Allow read access to engineers" ON public.engineers;
CREATE POLICY "Allow read access to engineers" ON public.engineers
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins and Promoteurs can manage engineers" ON public.engineers;
CREATE POLICY "Admins and Promoteurs can manage engineers" ON public.engineers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'promoteur')
        )
    );

-- 3. Create a trigger function to keep profiles synced to the engineers table
CREATE OR REPLACE FUNCTION public.sync_engineer_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'ingenieur' THEN
        INSERT INTO public.engineers (id, full_name, role, email)
        VALUES (
            NEW.id,
            COALESCE(NEW.full_name, NEW.email),
            'ingenieur',
            NEW.email
        )
        ON CONFLICT (id) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            email = EXCLUDED.email;
    ELSE
        DELETE FROM public.engineers WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on profiles table
DROP TRIGGER IF EXISTS on_profile_changed ON public.profiles;
CREATE TRIGGER on_profile_changed
    AFTER INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.sync_engineer_profile();

-- Initial sync of existing profiles with role 'ingenieur'
INSERT INTO public.engineers (id, full_name, role, email)
SELECT id, COALESCE(full_name, email), role, email
FROM public.profiles
WHERE role = 'ingenieur'
ON CONFLICT (id) DO NOTHING;

-- 4. Create the project_engineers junction table
CREATE TABLE IF NOT EXISTS public.project_engineers (
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    engineer_id UUID REFERENCES public.engineers(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, engineer_id)
);

-- Enable RLS on project_engineers
ALTER TABLE public.project_engineers ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies for project_engineers table
DROP POLICY IF EXISTS "Allow read access to project_engineers" ON public.project_engineers;
CREATE POLICY "Allow read access to project_engineers" ON public.project_engineers
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins and Promoteurs can manage project_engineers" ON public.project_engineers;
CREATE POLICY "Admins and Promoteurs can manage project_engineers" ON public.project_engineers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'promoteur')
        )
    );

-- 5. Extend the tasks table to support 3-level hierarchies
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS level INTEGER CHECK (level BETWEEN 1 AND 3);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS progress_percentage NUMERIC DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS target_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add policy for engineers to view/update project tasks they are assigned to
DROP POLICY IF EXISTS "Engineers can view assigned project tasks" ON public.tasks;
CREATE POLICY "Engineers can view assigned project tasks" ON public.tasks
    FOR SELECT USING (
        assigned_to = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.project_engineers
            WHERE project_engineers.project_id = tasks.project_id
              AND project_engineers.engineer_id = auth.uid()
        )
    );
