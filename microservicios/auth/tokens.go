package main

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const duracionToken = 2 * time.Hour

// Datos que viajan dentro del JWT. Los demás microservicios los leen
// verificando la firma con JWT_SECRET, sin consultar a auth.
type Claims struct {
	Nombre string `json:"nombre"`
	Rol    string `json:"rol"`
	jwt.RegisteredClaims
}

func (s *Servidor) generarToken(u Usuario) (string, error) {
	jti := make([]byte, 16)
	if _, err := rand.Read(jti); err != nil {
		return "", err
	}
	ahora := time.Now()
	claims := Claims{
		Nombre: u.Nombre,
		Rol:    u.Rol,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.Itoa(u.ID),
			ID:        hex.EncodeToString(jti), // identifica el token para poder revocarlo
			IssuedAt:  jwt.NewNumericDate(ahora),
			ExpiresAt: jwt.NewNumericDate(ahora.Add(duracionToken)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.jwtSecret)
}

// Lee el header "Authorization: Bearer <token>", verifica la firma y la expiración,
// y comprueba en Redis que el token no haya sido revocado por un logout.
func (s *Servidor) validarToken(r *http.Request) (*Claims, error) {
	encabezado := r.Header.Get("Authorization")
	tokenStr, ok := strings.CutPrefix(encabezado, "Bearer ")
	if !ok || tokenStr == "" {
		return nil, errors.New("falta el token")
	}

	claims := &Claims{}
	_, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		return s.jwtSecret, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil {
		return nil, err
	}

	revocado, err := s.redis.Exists(r.Context(), claveRevocado(claims.ID)).Result()
	if err != nil {
		return nil, err
	}
	if revocado > 0 {
		return nil, errors.New("token revocado")
	}
	return claims, nil
}

func claveRevocado(jti string) string { return "token_revocado:" + jti }
