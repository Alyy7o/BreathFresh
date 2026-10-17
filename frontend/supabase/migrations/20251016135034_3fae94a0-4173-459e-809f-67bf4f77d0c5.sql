-- Create cravings table to track user craving logs
CREATE TABLE IF NOT EXISTS public.cravings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  intensity INTEGER NOT NULL CHECK (intensity >= 1 AND intensity <= 10),
  trigger TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.cravings ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own cravings" 
ON public.cravings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cravings" 
ON public.cravings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cravings" 
ON public.cravings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cravings" 
ON public.cravings 
FOR DELETE 
USING (auth.uid() = user_id);