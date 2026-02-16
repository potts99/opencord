package auth

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
)

type KeyPair struct {
	PrivateKey *ecdsa.PrivateKey
	PublicKey  *ecdsa.PublicKey
	KID        string
}

// LoadOrGenerateKeyPair loads an ES256 key pair from PEM files in keyDir,
// or generates a new one if the files don't exist.
func LoadOrGenerateKeyPair(keyDir string) (*KeyPair, error) {
	privPath := filepath.Join(keyDir, "private.pem")
	pubPath := filepath.Join(keyDir, "public.pem")

	if err := os.MkdirAll(keyDir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create key directory: %w", err)
	}

	// Try to load existing keys
	if _, err := os.Stat(privPath); err == nil {
		return loadKeyPair(privPath, pubPath)
	}

	// Generate new key pair
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate key: %w", err)
	}

	// Save private key
	privBytes, err := x509.MarshalECPrivateKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal private key: %w", err)
	}
	privPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: privBytes})
	if err := os.WriteFile(privPath, privPEM, 0600); err != nil {
		return nil, fmt.Errorf("failed to write private key: %w", err)
	}

	// Save public key
	pubBytes, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal public key: %w", err)
	}
	pubPEM := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubBytes})
	if err := os.WriteFile(pubPath, pubPEM, 0644); err != nil {
		return nil, fmt.Errorf("failed to write public key: %w", err)
	}

	kid := computeKID(&privateKey.PublicKey)
	return &KeyPair{
		PrivateKey: privateKey,
		PublicKey:  &privateKey.PublicKey,
		KID:        kid,
	}, nil
}

func loadKeyPair(privPath, pubPath string) (*KeyPair, error) {
	privPEM, err := os.ReadFile(privPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read private key: %w", err)
	}
	block, _ := pem.Decode(privPEM)
	if block == nil {
		return nil, fmt.Errorf("failed to decode private key PEM")
	}
	privateKey, err := x509.ParseECPrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key: %w", err)
	}

	kid := computeKID(&privateKey.PublicKey)
	return &KeyPair{
		PrivateKey: privateKey,
		PublicKey:  &privateKey.PublicKey,
		KID:        kid,
	}, nil
}

// computeKID returns a truncated SHA-256 hash of the public key as the key ID.
func computeKID(pub *ecdsa.PublicKey) string {
	pubBytes, _ := x509.MarshalPKIXPublicKey(pub)
	hash := sha256.Sum256(pubBytes)
	return base64.RawURLEncoding.EncodeToString(hash[:8])
}

// JWK represents a JSON Web Key.
type JWK struct {
	KTY string `json:"kty"`
	CRV string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
	KID string `json:"kid"`
	Use string `json:"use"`
	Alg string `json:"alg"`
}

// JWKS represents a JSON Web Key Set.
type JWKS struct {
	Keys []JWK `json:"keys"`
}

// PublicKeyToJWK converts an ECDSA public key to JWK format.
func PublicKeyToJWK(pub *ecdsa.PublicKey, kid string) JWK {
	return JWK{
		KTY: "EC",
		CRV: "P-256",
		X:   base64.RawURLEncoding.EncodeToString(pub.X.Bytes()),
		Y:   base64.RawURLEncoding.EncodeToString(pub.Y.Bytes()),
		KID: kid,
		Use: "sig",
		Alg: "ES256",
	}
}

// JWKSHandler returns an HTTP handler that serves the JWKS endpoint.
func JWKSHandler(kp *KeyPair) http.HandlerFunc {
	jwks := JWKS{
		Keys: []JWK{PublicKeyToJWK(kp.PublicKey, kp.KID)},
	}

	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "public, max-age=300")
		json.NewEncoder(w).Encode(jwks)
	}
}

// ParseJWKToPublicKey converts a JWK to an ecdsa.PublicKey.
func ParseJWKToPublicKey(jwk JWK) (*ecdsa.PublicKey, error) {
	if jwk.KTY != "EC" || jwk.CRV != "P-256" {
		return nil, fmt.Errorf("unsupported key type: %s/%s", jwk.KTY, jwk.CRV)
	}

	xBytes, err := base64.RawURLEncoding.DecodeString(jwk.X)
	if err != nil {
		return nil, fmt.Errorf("failed to decode x coordinate: %w", err)
	}
	yBytes, err := base64.RawURLEncoding.DecodeString(jwk.Y)
	if err != nil {
		return nil, fmt.Errorf("failed to decode y coordinate: %w", err)
	}

	return &ecdsa.PublicKey{
		Curve: elliptic.P256(),
		X:     new(big.Int).SetBytes(xBytes),
		Y:     new(big.Int).SetBytes(yBytes),
	}, nil
}
