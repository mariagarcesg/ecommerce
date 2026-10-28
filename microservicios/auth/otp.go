package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Cliente del microservicio otp: auth le pide enviar y validar los códigos
// de verificación de correo y de inicio de sesión. otp solo acepta tokens con
// rol "servicio".

const (
	propositoRegistro = "registro"
	propositoLogin    = "login"
)

// Respuesta 4xx de otp (código incorrecto, expirado, esperar para reenviar...).
// Su mensaje es apto para el usuario, así que auth la devuelve tal cual.
type errorOTP struct {
	Status       int    `json:"-"`
	Mensaje      string `json:"error"`
	Codigo       string `json:"codigo,omitempty"`
	ReintentarEn int    `json:"reintentar_en,omitempty"`
}

func (e *errorOTP) Error() string { return fmt.Sprintf("otp %d: %s", e.Status, e.Mensaje) }

func (s *Servidor) enviarCodigoOTP(ctx context.Context, email, proposito string) error {
	return s.llamarOTP(ctx, "/otp/enviar", map[string]string{"email": email, "proposito": proposito})
}

func (s *Servidor) validarCodigoOTP(ctx context.Context, email, proposito, codigo string) error {
	return s.llamarOTP(ctx, "/otp/validar", map[string]string{"email": email, "proposito": proposito, "codigo": codigo})
}

// Devuelve nil si otp respondió 2xx, *errorOTP si respondió 4xx, y otro error
// si no respondió o falló (5xx).
func (s *Servidor) llamarOTP(ctx context.Context, ruta string, cuerpo any) error {
	datos, err := json.Marshal(cuerpo)
	if err != nil {
		return err
	}
	token, err := s.tokenServicio()
	if err != nil {
		return err
	}
	peticion, err := http.NewRequestWithContext(ctx, http.MethodPost, s.otpURL+ruta, bytes.NewReader(datos))
	if err != nil {
		return err
	}
	peticion.Header.Set("Content-Type", "application/json")
	peticion.Header.Set("Authorization", "Bearer "+token)

	respuesta, err := s.http.Do(peticion)
	if err != nil {
		return err
	}
	defer respuesta.Body.Close()

	if respuesta.StatusCode < 300 {
		return nil
	}
	// 401 significa que otp rechazó el token de servicio (JWT_SECRET distinto):
	// es un error de configuración, no algo que deba ver el usuario.
	if respuesta.StatusCode < 500 && respuesta.StatusCode != http.StatusUnauthorized {
		e := &errorOTP{Status: respuesta.StatusCode}
		if err := json.NewDecoder(respuesta.Body).Decode(e); err != nil || e.Mensaje == "" {
			return fmt.Errorf("otp respondió %d", respuesta.StatusCode)
		}
		return e
	}
	return fmt.Errorf("otp respondió %d", respuesta.StatusCode)
}

// JWT de un minuto con rol "servicio": identifica a auth ante otp. Ningún otro
// servicio acepta ese rol, así que no sirve como sesión de usuario.
func (s *Servidor) tokenServicio() (string, error) {
	ahora := time.Now()
	claims := Claims{
		Nombre: "servicio-auth",
		Rol:    "servicio",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "0",
			IssuedAt:  jwt.NewNumericDate(ahora),
			ExpiresAt: jwt.NewNumericDate(ahora.Add(time.Minute)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.jwtSecret)
}
