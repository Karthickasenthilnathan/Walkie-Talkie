CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id varchar(50) not null unique,
    username varchar(255) not null,
    avatar_url TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()

);