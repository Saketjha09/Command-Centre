package tasks

import "errors"

// ErrInvalidTransition is returned when a requested status change is not
// permitted by the workflow state machine.
var ErrInvalidTransition = errors.New("tasks: invalid status transition")

// validTransitions defines the directed edges of the task status workflow.
// The map key is the current status; the slice is the set of reachable statuses.
//
// Sequential Workflow (PRD §5c):
//   unassigned  → assigned
//   assigned    → in_progress
//   in_progress → in_review
//   in_review   → done
var validTransitions = map[string][]string{
	"unassigned":  {"assigned"},
	"assigned":    {"in_progress"},
	"in_progress": {"in_review"},
	"in_review":   {"done"},
	"done":        {}, // terminal
}

// ValidateTransition checks whether the transition from → to is permitted
// by the state machine. Returns nil on success, ErrInvalidTransition otherwise.
func ValidateTransition(from, to string) error {
	allowed, ok := validTransitions[from]
	if !ok {
		return ErrInvalidTransition
	}
	for _, s := range allowed {
		if s == to {
			return nil
		}
	}
	return ErrInvalidTransition
}
