-- Tabla de perfiles con roles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'solo_lectura' 
    CHECK (role IN ('solo_lectura','ventas','bodega','inventario','administrador')),
  display_name text,
  empresa_id text DEFAULT 'ferriperfiles',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- If policy exists, drop it first to avoid error
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

CREATE POLICY "Users can read own profile" ON public.profiles 
  FOR SELECT TO authenticated USING (id = auth.uid());

-- Insert dummy profiles for existing users if any (useful if they don't have one)
INSERT INTO public.profiles (id, role, display_name)
SELECT id, 'administrador', email FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Tabla de conversaciones del chat
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  empresa_id text DEFAULT 'ferriperfiles',
  title text DEFAULT 'Nueva conversación',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de mensajes del chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid REFERENCES public.chat_conversations(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users own conversations" ON public.chat_conversations;
    DROP POLICY IF EXISTS "Users own messages" ON public.chat_messages;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

CREATE POLICY "Users own conversations" ON public.chat_conversations 
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  
CREATE POLICY "Users own messages" ON public.chat_messages 
  FOR ALL TO authenticated 
  USING (conversation_id IN (SELECT id FROM public.chat_conversations WHERE user_id = auth.uid()))
  WITH CHECK (conversation_id IN (SELECT id FROM public.chat_conversations WHERE user_id = auth.uid()));
