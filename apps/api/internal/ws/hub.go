package ws

import (
	"encoding/json"
	"log"
	"sync"
)

type Event struct {
	Type string      `json:"event"`
	Data interface{} `json:"data"`
}

type Hub struct {
	clients    map[*Client]bool
	channels   map[string]map[*Client]bool // channelID -> clients
	register   chan *Client
	unregister chan *Client
	broadcast  chan channelEvent
	mu         sync.RWMutex
}

type channelEvent struct {
	channelID string
	event     Event
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		channels:   make(map[string]map[*Client]bool),
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
			h.mu.Unlock()

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
