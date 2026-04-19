-- House of Ahmar — Initial Schema
-- Run this in Supabase SQL Editor

-- Enums
CREATE TYPE member_role AS ENUM ('elder', 'member', 'guest');
CREATE TYPE post_type AS ENUM ('text', 'photo', 'announcement');
CREATE TYPE rsvp_status AS ENUM ('attending', 'maybe', 'not_attending');
CREATE TYPE channel_type AS ENUM ('general', 'announcement', 'private');
CREATE TYPE code_status AS ENUM ('active', 'used', 'revoked');

-- Members
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  bio TEXT,
  birthday DATE,
  role member_role NOT NULL DEFAULT 'member',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX members_role_idx ON members (role);
CREATE INDEX members_is_active_idx ON members (is_active);

-- Access Codes
CREATE TABLE access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label TEXT,
  status code_status NOT NULL DEFAULT 'active',
  max_uses INTEGER DEFAULT 1,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES members(id),
  used_by UUID REFERENCES members(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX access_codes_status_idx ON access_codes (status);

-- Posts
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES members(id),
  type post_type NOT NULL DEFAULT 'text',
  content TEXT,
  media_urls JSONB DEFAULT '[]'::jsonb,
  is_pinned BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX posts_author_idx ON posts (author_id);
CREATE INDEX posts_created_at_idx ON posts (created_at DESC);

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES members(id),
  content TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_idx ON comments (post_id, created_at);

-- Reactions
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (post_id, member_id, emoji)
);

-- Gatherings
CREATE TABLE gatherings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  cover_image_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  is_all_day BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES members(id),
  is_cancelled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX gatherings_starts_at_idx ON gatherings (starts_at);
CREATE INDEX gatherings_created_by_idx ON gatherings (created_by);

-- RSVPs
CREATE TABLE rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gathering_id UUID NOT NULL REFERENCES gatherings(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  status rsvp_status NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (gathering_id, member_id)
);

-- Channels
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  type channel_type NOT NULL DEFAULT 'general',
  is_archived BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX channels_sort_order_idx ON channels (sort_order);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES members(id),
  content TEXT NOT NULL,
  media_urls JSONB DEFAULT '[]'::jsonb,
  is_deleted BOOLEAN DEFAULT false,
  reply_to_id UUID REFERENCES messages(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_channel_idx ON messages (channel_id, created_at DESC);
CREATE INDEX messages_author_idx ON messages (author_id);

-- Albums
CREATE TABLE albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cover_photo_url TEXT,
  created_by UUID NOT NULL REFERENCES members(id),
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX albums_created_at_idx ON albums (created_at DESC);

-- Photos
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES members(id),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  taken_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX photos_album_idx ON photos (album_id, sort_order);

-- House Settings
CREATE TABLE house_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES members(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default channels
INSERT INTO channels (name, slug, description, type, sort_order)
VALUES
  ('General', 'general', 'Open discussion for the family', 'general', 0),
  ('Announcements', 'announcements', 'Important family announcements', 'announcement', 1),
  ('Elders Only', 'elders-only', 'Private discussions for Elders', 'private', 2);

-- RLS for realtime (messages table)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
        AND members.is_active = true
    )
  );

CREATE POLICY "members_insert_messages" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
        AND members.is_active = true
        AND members.id = messages.author_id
    )
  );

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_channels" ON channels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
        AND members.is_active = true
    )
  );
