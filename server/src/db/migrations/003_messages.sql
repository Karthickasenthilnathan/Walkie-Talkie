CREATE TYPE message_type AS ENUM ('text', 'code_snippet', 'file');

CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq BIGSERIAL UNIQUE,
  sender_id   UUID REFERENCES users(id),
  channel_id  UUID REFERENCES channels(id),        -- NULL if DM
  dm_to       UUID REFERENCES users(id),           -- NULL if channel message
  content     TEXT NOT NULL,
   type        message_type DEFAULT 'text',
  language    VARCHAR(50),                          -- for code snippets
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_channel ON messages(channel_id, created_at DESC);
CREATE INDEX idx_messages_dm      ON messages(sender_id, dm_to, created_at DESC);