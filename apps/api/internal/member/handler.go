package member

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

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	members, err := h.repo.GetAll()
	if err != nil {
		writeError(w, "failed to list members", http.StatusInternalServerError)
		return
	}
	if members == nil {
		members = []Member{}
	}

	// Annotate online status from hub
	onlineUsers := h.hub.GetOnlineUserIDs()
	for i := range members {
		members[i].Online = onlineUsers[members[i].UserID]
	}

	writeJSON(w, members, http.StatusOK)
}

func (h *Handler) Kick(w http.ResponseWriter, r *http.Request) {
	targetUserID, err := uuid.Parse(chi.URLParam(r, "userId"))
	if err != nil {
		writeError(w, "invalid user ID", http.StatusBadRequest)
		return
	}

	callerID, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Self-leave: any member can remove themselves (except owner)
	if targetUserID == callerID {
		caller, err := h.repo.GetByUserID(callerID)
		if err != nil {
			writeError(w, "member not found", http.StatusNotFound)
			return
		}
		if caller.Role == "owner" {
			writeError(w, "owner cannot leave the instance", http.StatusForbidden)
			return
		}
	} else {
		// Kicking someone else: must be admin/owner
		caller, err := h.repo.GetByUserID(callerID)
		if err != nil || (caller.Role != "admin" && caller.Role != "owner") {
			writeError(w, "insufficient permissions", http.StatusForbidden)
			return
		}
	}

	if err := h.repo.Delete(targetUserID); err != nil {
		writeError(w, "failed to kick member", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	targetUserID, err := uuid.Parse(chi.URLParam(r, "userId"))
	if err != nil {
		writeError(w, "invalid user ID", http.StatusBadRequest)
		return
	}

	callerID, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	caller, err := h.repo.GetByUserID(callerID)
	if err != nil || caller.Role != "owner" {
		writeError(w, "only owner can change roles", http.StatusForbidden)
		return
	}

	var req UpdateMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Role != "admin" && req.Role != "member" {
		writeError(w, "role must be admin or member", http.StatusBadRequest)
		return
	}

	member, err := h.repo.UpdateRole(targetUserID, req.Role)
	if err != nil {
		writeError(w, "failed to update role", http.StatusInternalServerError)
		return
	}

	writeJSON(w, member, http.StatusOK)
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
