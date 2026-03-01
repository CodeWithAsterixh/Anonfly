-- Add reactions table
CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
    emoji_id TEXT NOT NULL,
    emoji_value TEXT NOT NULL,
    emoji_type TEXT DEFAULT 'unicode',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, identity_id, emoji_id)
);

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON reactions(message_id);
