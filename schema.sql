-- Drop tables if they exist to allow clean runs
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS profiles;

-- Create profiles table referencing Supabase auth.users
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    age INTEGER,
    city TEXT,
    gender TEXT CHECK (gender IN ('male', 'female')),
    interested_in TEXT CHECK (interested_in IN ('male', 'female', 'both')),
    about_me TEXT,
    profile_photo TEXT,
    voice_intro_url TEXT,                -- Audio icebreaker (Supabase Storage URL)
    prompts JSONB DEFAULT '[]'::jsonb,  -- 3 personality prompt answers [{id, answer}]
    face_verified BOOLEAN DEFAULT false,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create matches table
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    user2_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    user1_name TEXT,
    user2_name TEXT,
    compatibility_score INTEGER DEFAULT 0, -- Stored at match-creation time (0-100)
    location_shared BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'matched',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user1_id, user2_id)
);

-- Create messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set first admin user manually:
-- UPDATE profiles SET is_admin = true WHERE email = 'admin@example.com';

