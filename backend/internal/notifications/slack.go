// Package notifications handles all outbound Slack communication.
// Every function in this package may be called from a background goroutine —
// none of them should panic. All errors are returned to the caller (the
// dispatcher) for logging and notification_failed flagging.
package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	sentry "github.com/getsentry/sentry-go"
	"github.com/saket/command-center/backend/pkg/config"
)

// slackHTTPClient is a dedicated client with an explicit timeout.
// Using the default http.Client has no timeout — a Slack outage would hang
// the goroutine forever.
var slackHTTPClient = &http.Client{
	Timeout: 10 * time.Second,
}

// slackPostMessageURL is the Slack Web API endpoint for sending messages.
const slackPostMessageURL = "https://slack.com/api/chat.postMessage"

// slackRequest is the JSON body sent to chat.postMessage.
type slackRequest struct {
	Channel string `json:"channel"`
	Text    string `json:"text,omitempty"`
	Blocks  []Block `json:"blocks,omitempty"`
}

// Block represents a Slack Block Kit element.
type Block struct {
	Type     string      `json:"type"`
	Text     *TextObject `json:"text,omitempty"`
	Elements []Element   `json:"elements,omitempty"`
	BlockID  string      `json:"block_id,omitempty"`
}

type TextObject struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type Element struct {
	Type     string      `json:"type"`
	ActionID string      `json:"action_id,omitempty"`
	Text     *TextObject `json:"text,omitempty"`
	Value    string      `json:"value,omitempty"`
	Style    string      `json:"style,omitempty"`
}

// slackResponse is the subset of the Slack API response we inspect.
type slackResponse struct {
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

// SendDM sends a direct message to a Slack user via their Slack user ID.
// Uses the bot token from config. Returns nil on success.
func SendDM(cfg *config.Config, slackUserID, message string) error {
	return postMessage(cfg, slackUserID, message)
}

// SendChannelMessage posts a message to the configured Slack channel.
func SendChannelMessage(cfg *config.Config, message string) error {
	return postMessage(cfg, cfg.SlackChannelID, message)
}

// SendInteractiveMessage sends a message with buttons using Slack Block Kit.
func SendInteractiveMessage(ctx context.Context, cfg *config.Config, channel, text string, blocks []Block) error {
	defer func() {
		if r := recover(); r != nil {
			slog.Error("goroutine_panic", "routine", "SendInteractiveMessage", "error", r)
			if err, ok := r.(error); ok {
				sentry.CaptureException(err)
			} else {
				sentry.CaptureMessage(fmt.Sprintf("%v", r))
			}
		}
	}()
	body, err := json.Marshal(slackRequest{Channel: channel, Text: text, Blocks: blocks})
	if err != nil {
		return fmt.Errorf("slack: marshal interactive request: %w", err)
	}
	return postMessageRaw(cfg, body)
}

// postMessageRaw is a lower-level helper for sending JSON payloads to Slack.
func postMessageRaw(cfg *config.Config, body []byte) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, slackPostMessageURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("slack: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.SlackBotToken)

	resp, err := slackHTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("slack: POST chat.postMessage: %w", err)
	}
	defer resp.Body.Close()

	var slackResp slackResponse
	if err := json.NewDecoder(resp.Body).Decode(&slackResp); err != nil {
		return fmt.Errorf("slack: decode response: %w", err)
	}

	if !slackResp.OK {
		return fmt.Errorf("slack: API error: %s", slackResp.Error)
	}
	return nil
}

// postMessage is the shared implementation for DM and channel messages.
func postMessage(cfg *config.Config, channel, text string) error {
	body, err := json.Marshal(slackRequest{Channel: channel, Text: text})
	if err != nil {
		return fmt.Errorf("slack: marshal request: %w", err)
	}
	return postMessageRaw(cfg, body)
}


// standupMessage is the DM body sent to each intern during the morning standup ping.
const standupMessage = "Good morning! Please reply with your " +
	"tasks for today and any blockers before 10 AM standup."

// SendStandupPing sends a standup reminder DM to each intern in the list.
// Failures for individual IDs are logged but do not stop the remaining sends —
// a single bad Slack ID must not silence everyone else.
// Returns the first error encountered (nil if all succeed).
func SendStandupPing(cfg *config.Config, internSlackIDs []string) error {
	var firstErr error
	for _, id := range internSlackIDs {
		if err := SendDM(cfg, id, standupMessage); err != nil {
			slog.Error("notifications: standup ping failed", "user_id", id, "error", err)
			if firstErr == nil {
				firstErr = err
			}
			// Continue — do not stop for remaining interns.
		}
	}
	return firstErr
}

// SendTaskAssignmentDM sends a formatted task assignment notification to a user.
func SendTaskAssignmentDM(cfg *config.Config, slackUserID, taskTitle, brand, deadline string) error {
	msg := fmt.Sprintf(
		"You have been assigned a new task:\n*Task:* %s\n*Brand:* %s\n*Deadline:* %s\nPlease check the Command Center for the full brief.",
		taskTitle, brand, deadline,
	)
	return SendDM(cfg, slackUserID, msg)
}
