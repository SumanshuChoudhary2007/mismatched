-- Drop tables if they exist to allow clean runs
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
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create matches table
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    user2_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'matched',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user1_id, user2_id)
);

-- Set explicitly first user as admin if needed, or update manually in supabase editor
-- UPDATE profiles SET is_admin = true WHERE email = 'admin@example.com';
