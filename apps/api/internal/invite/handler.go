package invite

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/opencord/api/internal/auth"
	"github.com/opencord/api/internal/member"
)

type Handler struct {
	repo       Repository
	memberRepo member.Repository
}

func NewHandler(repo Repository, memberRepo member.Repository) *Handler {
	return &Handler{repo: repo, memberRepo: memberRepo}
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateInviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Allow empty body (no expiry)
		req = CreateInviteRequest{}
	}

	var expiresAt *time.Time
	if req.ExpiresInHours != nil {
		t := time.Now().Add(time.Duration(*req.ExpiresInHours) * time.Hour)
		expiresAt = &t
	}

	inv, err := h.repo.Create(userID, expiresAt)
	if err != nil {
		writeError(w, "failed to create invite", http.StatusInternalServerError)
		return
	}

	writeJSON(w, inv, http.StatusCreated)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	invites, err := h.repo.GetAll()
	if err != nil {
		writeError(w, "failed to list invites", http.StatusInternalServerError)
		return
	}
	if invites == nil {
		invites = []Invite{}
	}
	writeJSON(w, invites, http.StatusOK)
}

func (h *Handler) Join(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	userID, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	inv, err := h.repo.GetByCode(code)
	if err != nil {
		writeError(w, "invalid invite code", http.StatusNotFound)
		return
	}

	if inv.ExpiresAt != nil && time.Now().After(*inv.ExpiresAt) {
		writeError(w, "invite has expired", http.StatusGone)
		return
	}

	// Check if already a member
	if _, err := h.memberRepo.GetByUserID(userID); err == nil {
		writeError(w, "already a member", http.StatusConflict)
		return
	}

	m, err := h.memberRepo.Create(userID, "member")
	if err != nil {
		writeError(w, "failed to join", http.StatusInternalServerError)
		return
	}

	writeJSON(w, m, http.StatusCreated)
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
