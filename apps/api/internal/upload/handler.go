package upload

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

type Handler struct {
	uploadPath string
	baseURL    string
}

func NewHandler(uploadPath, baseURL string) *Handler {
	os.MkdirAll(uploadPath, 0755)
	return &Handler{uploadPath: uploadPath, baseURL: baseURL}
}

func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	r.ParseMultipartForm(10 << 20) // 10 MB max

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, "file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate file type
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowed := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}
	if !allowed[ext] {
		writeError(w, "unsupported file type", http.StatusBadRequest)
		return
	}

	// Generate unique filename
	filename := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	dst, err := os.Create(filepath.Join(h.uploadPath, filename))
	if err != nil {
		writeError(w, "failed to save file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		writeError(w, "failed to save file", http.StatusInternalServerError)
		return
	}

	url := fmt.Sprintf("%s/uploads/%s", h.baseURL, filename)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	fmt.Fprintf(w, `{"data":{"url":"%s"}}`, url)
}

func writeError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	fmt.Fprintf(w, `{"error":"%s"}`, message)
}
