package ai

import (
    "context"
    "errors"
)

type ClaudeProvider struct{}

func NewClaudeProvider() *ClaudeProvider {
    return &ClaudeProvider{}
}

func (c *ClaudeProvider) Name() string {
    return "claude"
}

func (c *ClaudeProvider) GenerateScript(ctx context.Context, req ScriptRequest) (*ScriptResponse, error) {
    return nil, errors.New("claude provider: not yet implemented — Phase 4")
}

func (c *ClaudeProvider) GenerateVideoPrompt(ctx context.Context, req PromptRequest) (*PromptResponse, error) {
    return nil, errors.New("claude provider: not yet implemented — Phase 4")
}
