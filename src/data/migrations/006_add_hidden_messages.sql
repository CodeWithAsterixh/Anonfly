-- Create hidden_messages table to support "Delete for Me" feature
CREATE TABLE IF NOT EXISTS hidden_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, identity_id)
);

-- Optimize message fetching by indexing the hidden_messages table
CREATE INDEX IF NOT EXISTS idx_hidden_messages_identity_id ON hidden_messages(identity_id);
CREATE INDEX IF NOT EXISTS idx_hidden_messages_message_id ON hidden_messages(message_id);
