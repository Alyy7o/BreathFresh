-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Update resources table RLS policies for admin management
DROP POLICY IF EXISTS "Authenticated users can create resources" ON public.resources;

CREATE POLICY "Admins can insert resources"
ON public.resources
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update resources"
ON public.resources
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete resources"
ON public.resources
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create a view for admin to see all users with their progress
CREATE OR REPLACE VIEW public.admin_users_view AS
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.quit_date,
  p.years_smoked,
  p.cigarettes_per_day,
  p.cigarettes_per_pack,
  p.pack_cost,
  p.created_at,
  CASE 
    WHEN p.quit_date IS NOT NULL THEN 
      EXTRACT(DAY FROM (NOW() - p.quit_date))::INTEGER
    ELSE 0
  END AS days_smoke_free,
  COALESCE(c.craving_count, 0) AS total_cravings
FROM public.profiles p
LEFT JOIN (
  SELECT user_id, COUNT(*) AS craving_count
  FROM public.cravings
  GROUP BY user_id
) c ON p.id = c.user_id;

-- RLS policy for admin_users_view
ALTER VIEW public.admin_users_view SET (security_invoker = on);

CREATE POLICY "Admins can view all users"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id OR 
  public.has_role(auth.uid(), 'admin')
);