package ws

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/google/uuid"
)

type Event struct {
	Type string      `json:"event"`
	Data interface{} `json:"data"`
}

type Hub struct {
	clients    map[*Client]bool
	channels   map[string]map[*Client]bool   // channelID -> clients
	users      map[uuid.UUID]map[*Client]bool // userID -> clients (multi-tab)
	register   chan *Client
	unregister chan *Client
	broadcast  chan channelEvent
	mu         sync.RWMutex

	// OnUserOffline is called when a user's last connection disconnects.
	// Wired in main.go to persist last_seen_at.
	OnUserOffline func(userID uuid.UUID)
}

type channelEvent struct {
	channelID string
	event     Event
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		channels:   make(map[string]map[*Client]bool),
		users:      make(map[uuid.UUID]map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan channelEvent, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true

			// Track user presence
			wasOffline := len(h.users[client.UserID]) == 0
			if h.users[client.UserID] == nil {
				h.users[client.UserID] = make(map[*Client]bool)
			}
			h.users[client.UserID][client] = true
			h.mu.Unlock()

			// Broadcast online if user was offline
			if wasOffline {
				h.BroadcastToAll(Event{
					Type: "presence_update",
					Data: map[string]interface{}{
						"userId": client.UserID,
						"status": "online",
					},
				})
			}

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				// Remove from all channel subscriptions
				for chID, clients := range h.channels {
					delete(clients, client)
					if len(clients) == 0 {
						delete(h.channels, chID)
					}
				}

				// Remove from user presence tracking
				if userClients, ok := h.users[client.UserID]; ok {
					delete(userClients, client)
					if len(userClients) == 0 {
						delete(h.users, client.UserID)
						h.mu.Unlock()

						// Broadcast offline
						h.BroadcastToAll(Event{
							Type: "presence_update",
							Data: map[string]interface{}{
								"userId": client.UserID,
								"status": "offline",
							},
						})

						// Persist last_seen_at
						if h.OnUserOffline != nil {
							go h.OnUserOffline(client.UserID)
						}
						continue
					}
				}
			}
			h.mu.Unlock()

		case ce := <-h.broadcast:
			h.mu.RLock()
			if clients, ok := h.channels[ce.channelID]; ok {
				data, err := json.Marshal(ce.event)
				if err != nil {
					log.Printf("failed to marshal event: %v", err)
					h.mu.RUnlock()
					continue
				}
				for client := range clients {
					select {
					case client.send <- data:
					default:
						close(client.send)
						delete(clients, client)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) BroadcastToChannel(channelID string, event Event) {
	h.broadcast <- channelEvent{channelID: channelID, event: event}
}

func (h *Hub) BroadcastToAll(event Event) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	data, err := json.Marshal(event)
	if err != nil {
		return
	}

	for client := range h.clients {
		select {
		case client.send <- data:
		default:
			close(client.send)
			delete(h.clients, client)
		}
	}
}

func (h *Hub) SubscribeToChannel(client *Client, channelID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.channels[channelID] == nil {
		h.channels[channelID] = make(map[*Client]bool)
	}
	h.channels[channelID][client] = true
}

func (h *Hub) UnsubscribeFromChannel(client *Client, channelID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if clients, ok := h.channels[channelID]; ok {
		delete(clients, client)
		if len(clients) == 0 {
			delete(h.channels, channelID)
		}
	}
}

// GetOnlineUserIDs returns a set of user IDs that currently have at least one connected client.
func (h *Hub) GetOnlineUserIDs() map[uuid.UUID]bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	online := make(map[uuid.UUID]bool, len(h.users))
	for userID := range h.users {
		online[userID] = true
	}
	return online
}

// IsUserOnline returns true if the user has at least one connected client.
func (h *Hub) IsUserOnline(userID uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.users[userID]) > 0
}
