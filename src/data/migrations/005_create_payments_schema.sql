-- Migration 005: Create Transactions and Vouchers table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id UUID REFERENCES identities(id) ON DELETE SET NULL,
    provider_transaction_id TEXT UNIQUE,
    provider TEXT NOT NULL, -- 'monero', 'lightning', 'stripe'
    amount DECIMAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    features TEXT[] NOT NULL,
    is_redeemed BOOLEAN DEFAULT FALSE,
    redeemed_by_identity_id UUID REFERENCES identities(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    redeemed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_transactions_provider_id ON transactions(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
