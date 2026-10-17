-- Create quit_plans table to store AI-generated 7-day plans
CREATE TABLE IF NOT EXISTS public.quit_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_data JSONB NOT NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups by user
CREATE INDEX IF NOT EXISTS quit_plans_user_id_idx ON public.quit_plans(user_id);

-- Enable Row Level Security
ALTER TABLE public.quit_plans ENABLE ROW LEVEL SECURITY;

-- Policies for quit_plans
CREATE POLICY "Users can view their own quit plans" 
ON public.quit_plans FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quit plans" 
ON public.quit_plans FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quit plans" 
ON public.quit_plans FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quit plans" 
ON public.quit_plans FOR DELETE 
USING (auth.uid() = user_id);

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_quit_plans_updated_at
    BEFORE UPDATE ON public.quit_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
