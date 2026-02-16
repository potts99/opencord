package auth

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"sync"
	"time"
)

type JWK struct {
	KTY string `json:"kty"`
	CRV string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
	KID string `json:"kid"`
	Use string `json:"use"`
	Alg string `json:"alg"`
}

type jwksResponse struct {
	Keys []JWK `json:"keys"`
}

// JWKSClient fetches and caches ES256 public keys from the central auth server.
type JWKSClient struct {
	authServerURL string
	keys          map[string]*ecdsa.PublicKey // kid → public key
	mu            sync.RWMutex
	stopCh        chan struct{}
}

// NewJWKSClient creates a JWKS client and fetches keys immediately.
func NewJWKSClient(authServerURL string) (*JWKSClient, error) {
	c := &JWKSClient{
		authServerURL: authServerURL,
		keys:          make(map[string]*ecdsa.PublicKey),
		stopCh:        make(chan struct{}),
	}

	if err := c.fetchKeys(); err != nil {
		return nil, fmt.Errorf("initial JWKS fetch failed: %w", err)
	}

	return c, nil
}

// StartRefreshLoop starts a background goroutine that refreshes keys every 5 minutes.
func (c *JWKSClient) StartRefreshLoop() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				if err := c.fetchKeys(); err != nil {
					log.Printf("JWKS refresh error: %v", err)
				}
			case <-c.stopCh:
				return
			}
		}
	}()
}

// Stop stops the background refresh loop.
func (c *JWKSClient) Stop() {
	close(c.stopCh)
}

// GetKey returns the public key for the given kid.
// If the kid is unknown, it triggers an immediate refetch.
func (c *JWKSClient) GetKey(kid string) (*ecdsa.PublicKey, error) {
	c.mu.RLock()
	key, ok := c.keys[kid]
	c.mu.RUnlock()
	if ok {
		return key, nil
	}

	// Unknown kid — try refetching
	if err := c.fetchKeys(); err != nil {
		return nil, fmt.Errorf("JWKS refetch failed: %w", err)
	}

	c.mu.RLock()
	key, ok = c.keys[kid]
	c.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("unknown key id: %s", kid)
	}
	return key, nil
}

func (c *JWKSClient) fetchKeys() error {
	url := c.authServerURL + "/.well-known/jwks.json"
	resp, err := http.Get(url)
	if err != nil {
		return fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("JWKS endpoint returned status %d", resp.StatusCode)
	}

	var jwks jwksResponse
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return fmt.Errorf("failed to decode JWKS: %w", err)
	}

	newKeys := make(map[string]*ecdsa.PublicKey)
	for _, jwk := range jwks.Keys {
		if jwk.KTY != "EC" || jwk.CRV != "P-256" {
			continue
		}
		pub, err := parseJWK(jwk)
		if err != nil {
			log.Printf("skipping invalid JWK kid=%s: %v", jwk.KID, err)
			continue
		}
		newKeys[jwk.KID] = pub
	}

	c.mu.Lock()
	c.keys = newKeys
	c.mu.Unlock()

	log.Printf("JWKS: loaded %d key(s) from %s", len(newKeys), c.authServerURL)
	return nil
}

func parseJWK(jwk JWK) (*ecdsa.PublicKey, error) {
	xBytes, err := base64.RawURLEncoding.DecodeString(jwk.X)
	if err != nil {
		return nil, fmt.Errorf("failed to decode x: %w", err)
	}
	yBytes, err := base64.RawURLEncoding.DecodeString(jwk.Y)
	if err != nil {
		return nil, fmt.Errorf("failed to decode y: %w", err)
	}

	return &ecdsa.PublicKey{
		Curve: elliptic.P256(),
		X:     new(big.Int).SetBytes(xBytes),
		Y:     new(big.Int).SetBytes(yBytes),
	}, nil
}
