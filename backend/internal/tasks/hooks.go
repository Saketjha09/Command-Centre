package tasks

// WSBroadcaster is the interface the tasks package uses to push real-time
// events to connected WebSocket clients. Defining it here (rather than in
// package ws) keeps tasks decoupled from the ws implementation:
//   - No import cycle: ws imports auth; tasks importing ws would be fine
//     directionally, but the interface is cleaner and makes unit-testing trivial
//     (mock the interface, no real hub needed).
//   - ws.Hub satisfies WSBroadcaster automatically via structural typing —
//     no explicit declaration required.
type WSBroadcaster interface {
	Broadcast(msgType string, payload interface{}) error
	BroadcastToRole(role string, msgType string, payload interface{}) error
	BroadcastToUser(userID string, msgType string, payload interface{}) error
}

// BroadcastTaskCreated sends a "task.created" event to all WebSocket clients.
// Called by HandleCreateTask after a successful DB write.
// Errors from Broadcast are silently discarded — a missed WS push must never
// fail an HTTP response.
func BroadcastTaskCreated(hub WSBroadcaster, task TaskDetail) {
	_ = hub.Broadcast("task.created", task)
}

// BroadcastTaskAssigned sends a "task.assigned" event to all WebSocket clients.
// Called by HandleAssignTask after a successful DB write.
func BroadcastTaskAssigned(hub WSBroadcaster, task TaskDetail) {
	_ = hub.Broadcast("task.assigned", task)
}

// BroadcastStatusChanged sends a "task.status_changed" event to all WebSocket clients.
// Called by HandleTransitionStatus after a successful DB write.
func BroadcastStatusChanged(hub WSBroadcaster, task TaskDetail) {
	_ = hub.Broadcast("task.status_changed", task)
}
