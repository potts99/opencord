package keys

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/opencord/api/internal/auth"
)

type Handler struct {
	repo Repository
}

func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req UploadKeysRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.repo.UpsertDeviceKey(userID, req.DeviceID, req.IdentityKey, req.SigningKey); err != nil {
		writeError(w, "failed to upload device key", http.StatusInternalServerError)
		return
	}

	if len(req.OneTimeKeys) > 0 {
		otks := make([]struct{ KeyID, Key string }, len(req.OneTimeKeys))
		for i, k := range req.OneTimeKeys {
			otks[i] = struct{ KeyID, Key string }{k.KeyID, k.Key}
		}
		if err := h.repo.InsertOneTimeKeys(userID, req.DeviceID, otks); err != nil {
			writeError(w, "failed to upload one-time keys", http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"data": "ok"})
}

func (h *Handler) Query(w http.ResponseWriter, r *http.Request) {
	userIDStr := r.URL.Query().Get("userId")
	if userIDStr == "" {
		writeError(w, "userId query parameter required", http.StatusBadRequest)
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		writeError(w, "invalid userId", http.StatusBadRequest)
		return
	}

	deviceKeys, err := h.repo.GetDeviceKeys(userID)
	if err != nil {
		writeError(w, "failed to query keys", http.StatusInternalServerError)
		return
	}
	if deviceKeys == nil {
		deviceKeys = []DeviceKey{}
	}

	writeJSON(w, deviceKeys, http.StatusOK)
}

func (h *Handler) Claim(w http.ResponseWriter, r *http.Request) {
	var req ClaimKeysRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		writeError(w, "invalid userId", http.StatusBadRequest)
		return
	}

	otk, err := h.repo.ClaimOneTimeKey(userID, req.DeviceID)
	if err != nil {
		writeError(w, "no one-time keys available", http.StatusNotFound)
		return
	}

	writeJSON(w, otk, http.StatusOK)
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
