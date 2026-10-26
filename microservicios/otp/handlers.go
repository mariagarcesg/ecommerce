package main

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
)

const (
	duracionCodigo   = 10 * time.Minute
	maxIntentos      = 5
	esperaReenvio    = 60 * time.Second
	maxEnviosPorHora = 5
)

// Para qué se pide el código. Cada propósito tiene sus propias claves en
// Redis, así un código de registro no sirve para otra acción.
var propositosValidos = map[string]bool{"registro": true}

var formatoCodigo = regexp.MustCompile(`^\d{6}$`)

type Servidor struct {
	redis     *redis.Client
	jwtSecret []byte
	otpSecret []byte
	correo    ConfigSMTP
}

type solicitud struct {
	Email     string `json:"email"`
	Proposito string `json:"proposito"`
	Codigo    string `json:"codigo"`
}

// Respuesta de error: `codigo` permite a auth y al frontend distinguir el caso
// sin depender del texto; `reintentar_en` (segundos) acompaña a los 429.
type respuestaError struct {
	Error        string `json:"error"`
	Codigo       string `json:"codigo,omitempty"`
	ReintentarEn int    `json:"reintentar_en,omitempty"`
}

func (s *Servidor) health(w http.ResponseWriter, r *http.Request) {
	responderJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "otp"})
}

// POST /otp/enviar {email, proposito} -> genera un código de 6 dígitos y lo envía por correo.
// Solo se puede pedir uno cada 60 s y como máximo 5 por hora para el mismo correo.
func (s *Servidor) enviar(w http.ResponseWriter, r *http.Request) {
	if !s.esServicio(r) {
		responderJSON(w, http.StatusUnauthorized, respuestaError{Error: "No autorizado."})
		return
	}
	datos, ok := leerSolicitud(w, r)
	if !ok {
		return
	}
	ctx := r.Context()

	libre, err := s.redis.SetNX(ctx, clave("espera", datos), 1, esperaReenvio).Result()
	if err != nil {
		errorInterno(w, err)
		return
	}
	if !libre {
		espera := s.segundosRestantes(ctx, clave("espera", datos))
		responderJSON(w, http.StatusTooManyRequests, respuestaError{
			Error:        fmt.Sprintf("Espera %d segundos antes de pedir otro código.", espera),
			Codigo:       "espera",
			ReintentarEn: espera,
		})
		return
	}

	envios, err := s.redis.Incr(ctx, clave("envios", datos)).Result()
	if err != nil {
		errorInterno(w, err)
		return
	}
	if envios == 1 {
		s.redis.Expire(ctx, clave("envios", datos), time.Hour)
	}
	if envios > maxEnviosPorHora {
		responderJSON(w, http.StatusTooManyRequests, respuestaError{
			Error:        "Pediste demasiados códigos. Intenta de nuevo más tarde.",
			Codigo:       "limite",
			ReintentarEn: s.segundosRestantes(ctx, clave("envios", datos)),
		})
		return
	}

	codigo, err := generarCodigo()
	if err != nil {
		errorInterno(w, err)
		return
	}

	// Se guarda solo el HMAC del código; un código nuevo reemplaza al anterior
	// y reinicia los intentos.
	pipe := s.redis.TxPipeline()
	pipe.Set(ctx, clave("codigo", datos), s.hashCodigo(datos, codigo), duracionCodigo)
	pipe.Del(ctx, clave("intentos", datos))
	if _, err := pipe.Exec(ctx); err != nil {
		errorInterno(w, err)
		return
	}

	if err := s.correo.enviarCodigo(datos.Email, codigo, duracionCodigo); err != nil {
		log.Printf("No se pudo enviar el correo a %s: %v", datos.Email, err)
		// Sin correo el código no sirve: se borra y se permite pedir otro enseguida.
		s.redis.Del(ctx, clave("codigo", datos), clave("espera", datos))
		responderJSON(w, http.StatusBadGateway, respuestaError{Error: "No se pudo enviar el correo con el código."})
		return
	}

	responderJSON(w, http.StatusAccepted, map[string]any{
		"mensaje":   "Código enviado.",
		"expira_en": int(duracionCodigo.Seconds()),
	})
}

// POST /otp/validar {email, proposito, codigo} -> 200 {valido: true} o 400 con el motivo.
// Cada código admite 5 intentos; al agotarlos se invalida y hay que pedir otro.
func (s *Servidor) validar(w http.ResponseWriter, r *http.Request) {
	if !s.esServicio(r) {
		responderJSON(w, http.StatusUnauthorized, respuestaError{Error: "No autorizado."})
		return
	}
	datos, ok := leerSolicitud(w, r)
	if !ok {
		return
	}
	datos.Codigo = strings.TrimSpace(datos.Codigo)
	if !formatoCodigo.MatchString(datos.Codigo) {
		responderJSON(w, http.StatusBadRequest, respuestaError{Error: "El código debe tener 6 dígitos.", Codigo: "invalido"})
		return
	}
	ctx := r.Context()

	guardado, err := s.redis.Get(ctx, clave("codigo", datos)).Result()
	if errors.Is(err, redis.Nil) {
		responderJSON(w, http.StatusBadRequest, respuestaError{Error: "El código expiró o ya no es válido. Pide uno nuevo.", Codigo: "expirado"})
		return
	}
	if err != nil {
		errorInterno(w, err)
		return
	}

	intentos, err := s.redis.Incr(ctx, clave("intentos", datos)).Result()
	if err != nil {
		errorInterno(w, err)
		return
	}
	if intentos == 1 {
		s.redis.Expire(ctx, clave("intentos", datos), duracionCodigo)
	}
	if intentos > maxIntentos {
		s.redis.Del(ctx, clave("codigo", datos))
		responderJSON(w, http.StatusBadRequest, respuestaError{Error: "Demasiados intentos. Pide un código nuevo.", Codigo: "bloqueado"})
		return
	}

	if !hmac.Equal([]byte(guardado), []byte(s.hashCodigo(datos, datos.Codigo))) {
		restantes := maxIntentos - intentos
		if restantes == 0 {
			s.redis.Del(ctx, clave("codigo", datos))
			responderJSON(w, http.StatusBadRequest, respuestaError{Error: "Código incorrecto. Pide un código nuevo.", Codigo: "bloqueado"})
			return
		}
		texto := fmt.Sprintf("Código incorrecto. Te quedan %d intentos.", restantes)
		if restantes == 1 {
			texto = "Código incorrecto. Te queda 1 intento."
		}
		responderJSON(w, http.StatusBadRequest, respuestaError{Error: texto, Codigo: "invalido"})
		return
	}

	// Un código solo sirve una vez.
	s.redis.Del(ctx, clave("codigo", datos), clave("intentos", datos))
	responderJSON(w, http.StatusOK, map[string]bool{"valido": true})
}

func leerSolicitud(w http.ResponseWriter, r *http.Request) (solicitud, bool) {
	var datos solicitud
	if err := json.NewDecoder(r.Body).Decode(&datos); err != nil {
		responderJSON(w, http.StatusBadRequest, respuestaError{Error: "Datos inválidos."})
		return datos, false
	}
	datos.Email = strings.ToLower(strings.TrimSpace(datos.Email))
	if datos.Email == "" || len(datos.Email) > 255 || strings.ContainsAny(datos.Email, "\r\n") {
		responderJSON(w, http.StatusBadRequest, respuestaError{Error: "El correo no es válido."})
		return datos, false
	}
	if !propositosValidos[datos.Proposito] {
		responderJSON(w, http.StatusBadRequest, respuestaError{Error: "Propósito no válido."})
		return datos, false
	}
	return datos, true
}

// Claves de Redis, ej. otp:codigo:registro:ana@correo.com
func clave(tipo string, datos solicitud) string {
	return "otp:" + tipo + ":" + datos.Proposito + ":" + datos.Email
}

// Código de 6 dígitos con un generador criptográfico (nunca math/rand).
func generarCodigo() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// HMAC-SHA256 con OTP_SECRET: quien lea Redis no puede deducir el código.
func (s *Servidor) hashCodigo(datos solicitud, codigo string) string {
	mac := hmac.New(sha256.New, s.otpSecret)
	mac.Write([]byte(datos.Proposito + ":" + datos.Email + ":" + codigo))
	return hex.EncodeToString(mac.Sum(nil))
}

func (s *Servidor) segundosRestantes(ctx context.Context, clave string) int {
	ttl, err := s.redis.TTL(ctx, clave).Result()
	if err != nil || ttl < time.Second {
		return 1
	}
	return int(ttl.Seconds())
}

// Solo acepta JWT firmados con JWT_SECRET y rol "servicio" (los emite auth para
// llamar a otp). Un token de usuario, aunque sea de admin, no sirve.
func (s *Servidor) esServicio(r *http.Request) bool {
	tokenStr, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok || tokenStr == "" {
		return false
	}
	claims := struct {
		Rol string `json:"rol"`
		jwt.RegisteredClaims
	}{}
	_, err := jwt.ParseWithClaims(tokenStr, &claims, func(t *jwt.Token) (any, error) {
		return s.jwtSecret, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithExpirationRequired())
	return err == nil && claims.Rol == "servicio"
}

func conectarRedis(addr, password string) (*redis.Client, error) {
	rdb := redis.NewClient(&redis.Options{Addr: addr, Password: password})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, err
	}
	return rdb, nil
}

func responderJSON(w http.ResponseWriter, status int, cuerpo any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(cuerpo)
}

func errorInterno(w http.ResponseWriter, err error) {
	log.Printf("Error interno: %v", err)
	responderJSON(w, http.StatusInternalServerError, respuestaError{Error: "Error interno del servidor."})
}
