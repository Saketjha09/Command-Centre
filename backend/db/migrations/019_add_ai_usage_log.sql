CREATE TABLE ops.ai_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES ops.users(id),
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    feature VARCHAR(50) NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost_usd NUMERIC(10,6) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_user_date ON ops.ai_usage_log(user_id, created_at);
CREATE INDEX idx_ai_usage_feature ON ops.ai_usage_log(feature);
