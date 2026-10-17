-- Create resources table for articles, videos, and success stories
CREATE TABLE public.resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('article', 'video', 'success_story')),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  author TEXT,
  read_time INTEGER,
  rating NUMERIC(2, 1),
  tags TEXT[],
  video_url TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view resources
CREATE POLICY "Resources are viewable by everyone"
ON public.resources
FOR SELECT
USING (true);

-- Only authenticated users can create resources (for future admin functionality)
CREATE POLICY "Authenticated users can create resources"
ON public.resources
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_resources_updated_at
BEFORE UPDATE ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert dummy data for articles
INSERT INTO public.resources (type, title, description, content, author, read_time, rating, tags) VALUES
('article', 'The Science Behind Nicotine Addiction', 'Understanding how nicotine affects your brain and body', 'Nicotine is a highly addictive substance that affects neurotransmitters in the brain...', 'Dr. Sarah Johnson', 8, 4.8, ARRAY['science', 'addiction', 'brain']),
('article', 'Breaking Free from Smoking', 'Practical strategies for overcoming cigarette dependency', 'Quitting smoking is one of the best decisions you can make for your health...', 'Michael Chen', 6, 4.5, ARRAY['strategies', 'health', 'motivation']),
('article', 'Understanding Withdrawal Symptoms', 'What to expect when you quit and how to cope', 'Withdrawal symptoms are your body''s way of adjusting to life without nicotine...', 'Dr. Emily White', 5, 4.7, ARRAY['withdrawal', 'symptoms', 'coping']);

-- Insert dummy data for videos
INSERT INTO public.resources (type, title, description, author, read_time, rating, tags, video_url, thumbnail_url) VALUES
('video', 'Your Body After Quitting: Week by Week', 'See the amazing changes that happen when you stop smoking', 'Health Channel', 12, 4.9, ARRAY['health', 'recovery', 'timeline'], 'https://example.com/video1', 'https://example.com/thumb1.jpg'),
('video', 'Meditation for Craving Management', 'Guided meditation to help you through difficult moments', 'Mindful Living', 10, 4.6, ARRAY['meditation', 'mindfulness', 'cravings'], 'https://example.com/video2', 'https://example.com/thumb2.jpg');

-- Insert dummy data for success stories
INSERT INTO public.resources (type, title, description, content, author, read_time, rating, tags) VALUES
('success_story', '1 Year Smoke-Free: My Journey', 'How I overcame 15 years of smoking and reclaimed my health', 'I never thought I could quit. I had been smoking for 15 years, a pack a day...', 'James Rodriguez', 7, 5.0, ARRAY['inspiration', 'recovery', '1-year']),
('success_story', 'From Pack-a-Day to Marathon Runner', 'My transformation after quitting smoking', 'Six months ago, I couldn''t climb stairs without getting winded. Today, I just completed my first marathon...', 'Lisa Thompson', 6, 4.9, ARRAY['fitness', 'transformation', 'running']),
('success_story', 'Breaking a 20-Year Habit', 'It''s never too late to quit and start healing', 'At 45, I decided enough was enough. Twenty years of smoking had taken its toll...', 'Robert Williams', 8, 4.8, ARRAY['inspiration', 'long-term', 'health']);