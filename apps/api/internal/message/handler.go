package message

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/opencord/api/internal/auth"
	"github.com/opencord/api/internal/ws"
)

type Handler struct {
	repo Repository
	hub  *ws.Hub
}

func NewHandler(repo Repository, hub *ws.Hub) *Handler {
	return &Handler{repo: repo, hub: hub}
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	channelID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, "invalid channel ID", http.StatusBadRequest)
		return
	}

	userID, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Content == "" && req.ImageURL == nil {
		writeError(w, "content or image is required", http.StatusBadRequest)
		return
	}

	msg, err := h.repo.Create(channelID, userID, req.Content, req.ImageURL)
	if err != nil {
		writeError(w, "failed to create message", http.StatusInternalServerError)
		return
	}

	// Broadcast via WebSocket
	h.hub.BroadcastToChannel(channelID.String(), ws.Event{
		Type: "message_create",
		Data: msg,
	})

	writeJSON(w, msg, http.StatusCreated)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	channelID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, "invalid channel ID", http.StatusBadRequest)
		return
	}

	var before *uuid.UUID
	if b := r.URL.Query().Get("before"); b != "" {
		parsed, err := uuid.Parse(b)
		if err == nil {
			before = &parsed
		}
	}

	limit := 50
	messages, err := h.repo.GetByChannel(channelID, before, limit)
	if err != nil {
		writeError(w, "failed to list messages", http.StatusInternalServerError)
		return
	}
	if messages == nil {
		messages = []Message{}
	}

	hasMore := len(messages) == limit
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":    messages,
		"hasMore": hasMore,
	})
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	msgID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, "invalid message ID", http.StatusBadRequest)
		return
	}

	userID, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Check ownership
	existing, err := h.repo.GetByID(msgID)
	if err != nil {
		writeError(w, "message not found", http.StatusNotFound)
		return
	}
	if existing.AuthorID != userID {
		writeError(w, "not your message", http.StatusForbidden)
		return
	}

	var req UpdateMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	msg, err := h.repo.Update(msgID, req.Content)
	if err != nil {
		writeError(w, "failed to update message", http.StatusInternalServerError)
		return
	}

	h.hub.BroadcastToChannel(existing.ChannelID.String(), ws.Event{
		Type: "message_update",
		Data: msg,
	})

	writeJSON(w, msg, http.StatusOK)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	msgID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, "invalid message ID", http.StatusBadRequest)
		return
	}

	userID, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	existing, err := h.repo.GetByID(msgID)
	if err != nil {
		writeError(w, "message not found", http.StatusNotFound)
		return
	}
	if existing.AuthorID != userID {
		writeError(w, "not your message", http.StatusForbidden)
		return
	}

	if err := h.repo.Delete(msgID); err != nil {
		writeError(w, "failed to delete message", http.StatusInternalServerError)
		return
	}

	h.hub.BroadcastToChannel(existing.ChannelID.String(), ws.Event{
		Type: "message_delete",
		Data: map[string]interface{}{
			"id":        msgID,
			"channelId": existing.ChannelID,
		},
	})

	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, data interface{}, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{"data": data})
}

func writeError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
