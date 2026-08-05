-- =========================================================================
-- DATABASE SETUP & SCHEMA FOR PLATEFORME IMMO
-- =========================================================================

-- 1. ENUM FOR USER ROLES (Already exists in V1, let's keep it safe)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'promoteur', 'ingenieur', 'commercial', 'client');
    END IF;
END$$;

-- 2. PROFILES TABLE (Already exists in V1, let's extend if not exists)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'client',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Allow individual read" ON public.profiles;
CREATE POLICY "Allow individual read" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow individual update" ON public.profiles;
CREATE POLICY "Allow individual update" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins and Promoteurs can view all profiles" ON public.profiles;
CREATE POLICY "Admins and Promoteurs can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'promoteur')
        )
    );

DROP POLICY IF EXISTS "Commercials and Engineers can view profiles" ON public.profiles;
CREATE POLICY "Commercials and Engineers can view profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('commercial', 'ingenieur')
        )
    );

-- 3. AUTOMATIC PROFILE CREATION TRIGGER (From V1)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'client'::public.user_role)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    location TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    status TEXT DEFAULT 'planning' NOT NULL, -- 'planning', 'construction', 'completed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on projects" ON public.projects
    FOR SELECT USING (true);

CREATE POLICY "Admins and Promoteurs can manage projects" ON public.projects
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'promoteur')
        )
    );

-- 5. PROJECT ASSIGNMENTS TABLE (RBAC project assignments)
CREATE TABLE IF NOT EXISTS public.project_assignments (
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_role TEXT, -- 'commercial', 'ingenieur'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (project_id, profile_id)
);

ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to project assignments" ON public.project_assignments
    FOR SELECT USING (true);

CREATE POLICY "Admins and Promoteurs can manage assignments" ON public.project_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'promoteur')
        )
    );

-- 6. LOTS TABLE (Apartments/Villas)
CREATE TABLE IF NOT EXISTS public.lots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    number TEXT NOT NULL,
    type TEXT NOT NULL, -- 'F2', 'F3', 'Villa', etc.
    status TEXT DEFAULT 'available' NOT NULL, -- 'available' (green), 'reserved' (orange), 'sold' (red)
    price NUMERIC NOT NULL,
    client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    commercial_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on lots" ON public.lots
    FOR SELECT USING (true);

CREATE POLICY "Commercials, Promoteurs, and Admins can update lots" ON public.lots
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('commercial', 'promoteur', 'admin')
        )
    );

CREATE POLICY "Promoteurs and Admins can insert/delete lots" ON public.lots
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('promoteur', 'admin')
        )
    );

-- 7. MILESTONES TABLE (Project Timeline Steps)
CREATE TABLE IF NOT EXISTS public.milestones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    progress_percent NUMERIC DEFAULT 0 NOT NULL,
    is_validated BOOLEAN DEFAULT false NOT NULL,
    validated_at TIMESTAMP WITH TIME ZONE,
    validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    order_index INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on milestones" ON public.milestones
    FOR SELECT USING (true);

CREATE POLICY "Engineers, Promoteurs, and Admins can manage milestones" ON public.milestones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('ingenieur', 'promoteur', 'admin')
        )
    );

-- 8. PAYMENTS TABLE (Client Billing Tracks)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lot_id UUID REFERENCES public.lots(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'paid', 'overdue'
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view their own payments" ON public.payments
    FOR SELECT USING (client_id = auth.uid());

CREATE POLICY "Commercials, Promoteurs, and Admins can view all payments" ON public.payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('commercial', 'promoteur', 'admin')
        )
    );

CREATE POLICY "Promoteurs and Admins can manage payments" ON public.payments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('promoteur', 'admin')
        )
    );

-- 9. DOCUMENTS TABLE (Digital Safe)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    lot_id UUID REFERENCES public.lots(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'other' NOT NULL, -- 'contract', 'plan', 'receipt', 'other'
    file_url TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view their own documents" ON public.documents
    FOR SELECT USING (client_id = auth.uid());

CREATE POLICY "Commercials, Promoteurs, and Admins can view all documents" ON public.documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('commercial', 'promoteur', 'admin')
        )
    );

CREATE POLICY "Commercials, Promoteurs, and Admins can manage documents" ON public.documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('commercial', 'promoteur', 'admin')
        )
    );

-- 10. SNAG ISSUES TABLE (SAV Checklist)
CREATE TABLE IF NOT EXISTS public.snag_issues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lot_id UUID REFERENCES public.lots(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'open' NOT NULL, -- 'open', 'in_progress', 'resolved', 'closed'
    severity TEXT DEFAULT 'medium' NOT NULL, -- 'low', 'medium', 'high'
    reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- engineer assigned
    subcontractor TEXT, -- 'plumber', 'electrician', 'painter', etc.
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.snag_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view snag issues of their lots" ON public.snag_issues
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.lots
            WHERE lots.id = snag_issues.lot_id AND lots.client_id = auth.uid()
        )
    );

CREATE POLICY "Engineers, Promoteurs, and Admins can manage snag issues" ON public.snag_issues
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('ingenieur', 'promoteur', 'admin')
        )
    );

CREATE POLICY "Commercials can view snag issues" ON public.snag_issues
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('commercial')
        )
    );

-- 11. IN-PROGRESS / EXISTING TÂCHES TABLE (From V1, keeping it for compatibility)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo', -- 'todo', 'in_progress', 'done'
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Tasks policies (from V1)
DROP POLICY IF EXISTS "Engineers can view their own tasks" ON public.tasks;
CREATE POLICY "Engineers can view their own tasks" ON public.tasks
    FOR SELECT USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "Engineers can update their own tasks" ON public.tasks;
CREATE POLICY "Engineers can update their own tasks" ON public.tasks
    FOR UPDATE USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "Promoteurs and Admins have full access to tasks" ON public.tasks;
CREATE POLICY "Promoteurs and Admins have full access to tasks" ON public.tasks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'promoteur')
        )
    );
