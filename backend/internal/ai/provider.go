package ai

import "context"

type ScriptRequest struct {
    BrandContext  map[string]string
    UserBrief     string
    Language      string // "hi", "en", "hinglish"
}

type ScriptResponse struct {
    Content      string
    InputTokens  int
    OutputTokens int
    Provider     string
}

type PromptRequest struct {
    BrandContext map[string]string
    VideoTool    string // "veo3", "runway"
    UserBrief    string
}

type PromptResponse struct {
    Content      string
    InputTokens  int
    OutputTokens int
    Provider     string
}

type Provider interface {
    GenerateScript(ctx context.Context, req ScriptRequest) (*ScriptResponse, error)
    GenerateVideoPrompt(ctx context.Context, req PromptRequest) (*PromptResponse, error)
    Name() string
}
