-- Create chat_messages table to store user conversations
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS chat_messages_user_created_idx
  ON public.chat_messages (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_conversation_idx
  ON public.chat_messages (user_id, conversation_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies: users can manage their own chat messages
-- Policies must be created without IF NOT EXISTS on PG 15
DROP POLICY IF EXISTS "Users can view their own chats" ON public.chat_messages;
CREATE POLICY "Users can view their own chats"
  ON public.chat_messages
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own chats" ON public.chat_messages;
CREATE POLICY "Users can insert their own chats"
  ON public.chat_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own chats" ON public.chat_messages;
CREATE POLICY "Users can update their own chats"
  ON public.chat_messages
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own chats" ON public.chat_messages;
CREATE POLICY "Users can delete their own chats"
  ON public.chat_messages
  FOR DELETE
  USING (auth.uid() = user_id);