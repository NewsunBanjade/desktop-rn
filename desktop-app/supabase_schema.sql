-- SQL Schema setup for RN Studio Photo Upload App
-- Copy and paste this into your Supabase SQL Editor

-- 1. Enable UUID generator extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create the albums table
CREATE TABLE IF NOT EXISTS public.albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    code TEXT UNIQUE,
    expiry_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create the photos table (maps uploaded photos to albums)
CREATE TABLE IF NOT EXISTS public.photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    public_url TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    thumbnail TEXT,
    size_bytes BIGINT,
    is_featured BOOLEAN DEFAULT false,
    cdn TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create the featured_photos table (independent of albums)
CREATE TABLE IF NOT EXISTS public.featured_photos (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    file_name TEXT NOT NULL,
    public_url TEXT NOT NULL,
    storage_key TEXT NOT NULL,

    -- Primary Key
    CONSTRAINT featured_photos_pkey PRIMARY KEY (id)
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_photos ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies
-- Allow authenticated users full access
CREATE POLICY "Allow authenticated users full access on albums" 
ON public.albums FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access on photos" 
ON public.photos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access on featured_photos" 
ON public.featured_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow public read access to display images/albums/featured_photos
CREATE POLICY "Allow public read access on albums" 
ON public.albums FOR SELECT TO public USING (true);

CREATE POLICY "Allow public read access on photos" 
ON public.photos FOR SELECT TO public USING (true);

CREATE POLICY "Allow public read access on featured_photos" 
ON public.featured_photos FOR SELECT TO public USING (true);

-- Note on Supabase Storage:
-- Create a public bucket named "rn-studio-photos"
-- In Supabase Storage under Policies, set up:
--   1. SELECT: Allow public read access on bucket "rn-studio-photos"
--   2. INSERT/DELETE: Allow authenticated users full control on bucket "rn-studio-photos"
