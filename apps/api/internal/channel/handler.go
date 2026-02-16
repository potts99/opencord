package channel

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type Handler struct {
	repo Repository
}

func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateChannelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		writeError(w, "name is required", http.StatusBadRequest)
		return
	}

	ch, err := h.repo.Create(req.Name, req.Type)
	if err != nil {
		writeError(w, "failed to create channel", http.StatusInternalServerError)
		return
	}

	writeJSON(w, ch, http.StatusCreated)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	channels, err := h.repo.GetAll()
	if err != nil {
		writeError(w, "failed to list channels", http.StatusInternalServerError)
		return
	}
	if channels == nil {
		channels = []Channel{}
	}
	writeJSON(w, channels, http.StatusOK)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, "invalid channel ID", http.StatusBadRequest)
		return
	}

	ch, err := h.repo.GetByID(id)
	if err != nil {
		writeError(w, "channel not found", http.StatusNotFound)
		return
	}

	writeJSON(w, ch, http.StatusOK)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, "invalid channel ID", http.StatusBadRequest)
		return
	}

	var req UpdateChannelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	ch, err := h.repo.Update(id, req)
	if err != nil {
		writeError(w, "failed to update channel", http.StatusInternalServerError)
		return
	}

	writeJSON(w, ch, http.StatusOK)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, "invalid channel ID", http.StatusBadRequest)
		return
	}

	if err := h.repo.Delete(id); err != nil {
		writeError(w, "failed to delete channel", http.StatusInternalServerError)
		return
	}

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
