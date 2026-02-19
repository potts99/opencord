package ws

import (
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // CORS handled elsewhere
	},
}

type AuthValidator func(token string) (uuid.UUID, string, error)

func HandleWebSocket(hub *Hub, validateToken AuthValidator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get token from query param
		token := r.URL.Query().Get("token")
		if token == "" {
			http.Error(w, "token required", http.StatusUnauthorized)
			return
		}

		userID, username, err := validateToken(token)
		if err != nil {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("websocket upgrade error: %v", err)
			return
		}

		client := NewClient(hub, conn, userID, username)
		hub.register <- client

		go client.WritePump()
		go client.ReadPump()
	}
}
