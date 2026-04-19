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
	"log"
	"net/http"
	"time"

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
	Text    string `json:"text"`
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

// postMessage is the shared implementation for DM and channel messages.
func postMessage(cfg *config.Config, channel, text string) error {
	body, err := json.Marshal(slackRequest{Channel: channel, Text: text})
	if err != nil {
		return fmt.Errorf("slack: marshal request: %w", err)
	}

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
			log.Printf("notifications: standup ping failed for %s: %v", id, err)
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
