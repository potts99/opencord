package ws

import (
	"encoding/json"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	send     chan []byte
	UserID   uuid.UUID
	Username string
}

type IncomingEvent struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

func NewClient(hub *Hub, conn *websocket.Conn, userID uuid.UUID, username string) *Client {
	return &Client{
		hub:      hub,
		conn:     conn,
		send:     make(chan []byte, 256),
		UserID:   userID,
		Username: username,
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			break
		}

		var event IncomingEvent
		if err := json.Unmarshal(message, &event); err != nil {
			continue
		}

		c.handleEvent(event)
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleEvent(event IncomingEvent) {
	switch event.Event {
	case "ping":
		data, _ := json.Marshal(Event{Type: "pong", Data: nil})
		c.send <- data

	case "subscribe_channel":
		var payload struct {
			ChannelID string `json:"channelId"`
		}
		if err := json.Unmarshal(event.Data, &payload); err != nil {
			return
		}
		c.hub.SubscribeToChannel(c, payload.ChannelID)

	case "unsubscribe_channel":
		var payload struct {
			ChannelID string `json:"channelId"`
		}
		if err := json.Unmarshal(event.Data, &payload); err != nil {
			return
		}
		c.hub.UnsubscribeFromChannel(c, payload.ChannelID)

	case "typing_start":
		var payload struct {
			ChannelID string `json:"channelId"`
		}
		if err := json.Unmarshal(event.Data, &payload); err != nil {
			return
		}
		c.hub.BroadcastToChannel(payload.ChannelID, Event{
			Type: "typing_start",
			Data: map[string]interface{}{
				"userId":    c.UserID,
				"username":  c.Username,
				"channelId": payload.ChannelID,
			},
		})

	default:
		// Handle RTC events
		if len(event.Event) > 4 && event.Event[:4] == "rtc:" {
			c.handleRTCEvent(event)
			return
		}
		log.Printf("unknown event: %s", event.Event)
	}
}

func (c *Client) handleRTCEvent(event IncomingEvent) {
	// Relay RTC signaling messages to the target peer
	var payload struct {
		ChannelID string `json:"channelId"`
		TargetID  string `json:"targetId"`
	}
	if err := json.Unmarshal(event.Data, &payload); err != nil {
		return
	}

	// Add sender info and broadcast to channel
	c.hub.BroadcastToChannel(payload.ChannelID, Event{
		Type: event.Event,
		Data: json.RawMessage(event.Data),
	})
}
