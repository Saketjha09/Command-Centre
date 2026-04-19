package tasks

import "errors"

// ErrInvalidTransition is returned when a requested status change is not
// permitted by the workflow state machine.
var ErrInvalidTransition = errors.New("tasks: invalid status transition")

// validTransitions defines the directed edges of the task status workflow.
// The map key is the current status; the slice is the set of reachable statuses.
//
//	brief_pending → in_progress
//	in_progress   → review
//	review        → in_progress  (revision cycle — back to drafting)
//	review        → approved
//	approved      → paid         (terminal state — no outgoing edges)
var validTransitions = map[string][]string{
	"brief_pending": {"in_progress"},
	"in_progress":   {"review"},
	"review":        {"in_progress", "approved"},
	"approved":      {"paid"},
	"paid":          {}, // terminal
}

// ValidateTransition checks whether the transition from → to is permitted
// by the state machine. Returns nil on success, ErrInvalidTransition otherwise.
//
// Pure function: zero I/O, zero database, zero HTTP. Safe to call in any context.
func ValidateTransition(from, to string) error {
	allowed, ok := validTransitions[from]
	if !ok {
		// Unknown source status — treat as invalid.
		return ErrInvalidTransition
	}
	for _, s := range allowed {
		if s == to {
			return nil
		}
	}
	return ErrInvalidTransition
}
