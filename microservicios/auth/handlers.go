package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

const (
	maxIntentosLogin = 5
	bloqueoLogin     = 15 * time.Minute
)

type Servidor struct {
	db        *sql.DB
	redis     *redis.Client
	jwtSecret []byte
}

type Usuario struct {
	ID     int    `json:"id"`
	Nombre string `json:"nombre"`
	Email  string `json:"email"`
	Rol    string `json:"rol"`
}

type respuestaSesion struct {
	Token   string  `json:"token"`
	Usuario Usuario `json:"usuario"`
}

func (s *Servidor) health(w http.ResponseWriter, r *http.Request) {
	responderJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "auth"})
}

// POST /registro {nombre, email, password} -> crea un usuario "cliente" y lo deja logueado.
func (s *Servidor) registro(w http.ResponseWriter, r *http.Request) {
	var datos struct {
		Nombre   string `json:"nombre"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&datos); err != nil {
		responderError(w, http.StatusBadRequest, "Datos inválidos.")
		return
	}
	datos.Nombre = strings.TrimSpace(datos.Nombre)
	datos.Email = normalizarEmail(datos.Email)

	switch {
	case datos.Nombre == "" || len(datos.Nombre) > 100:
		responderError(w, http.StatusBadRequest, "El nombre es obligatorio (máximo 100 caracteres).")
		return
	case !emailValido(datos.Email):
		responderError(w, http.StatusBadRequest, "El correo no es válido.")
		return
	case len(datos.Password) < 8 || len(datos.Password) > 72: // bcrypt solo usa los primeros 72 bytes
		responderError(w, http.StatusBadRequest, "La contraseña debe tener entre 8 y 72 caracteres.")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(datos.Password), bcrypt.DefaultCost)
	if err != nil {
		errorInterno(w, err)
		return
	}

	u := Usuario{Nombre: datos.Nombre, Email: datos.Email, Rol: "cliente"}
	err = s.db.QueryRowContext(r.Context(),
		`INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id`,
		u.Nombre, u.Email, string(hash), u.Rol,
	).Scan(&u.ID)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
		responderError(w, http.StatusConflict, "Ya existe una cuenta con ese correo.")
		return
	}
	if err != nil {
		errorInterno(w, err)
		return
	}

	s.responderSesion(w, http.StatusCreated, u)
}

// POST /login {email, password} -> devuelve un JWT.
// Redis cuenta los intentos fallidos por email y bloquea durante 15 minutos tras 5 fallos.
func (s *Servidor) login(w http.ResponseWriter, r *http.Request) {
	var datos struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&datos); err != nil {
		responderError(w, http.StatusBadRequest, "Datos inválidos.")
		return
	}
	datos.Email = normalizarEmail(datos.Email)
	ctx := r.Context()
	claveIntentos := "intentos_login:" + datos.Email

	intentos, err := s.redis.Get(ctx, claveIntentos).Int()
	if err != nil && !errors.Is(err, redis.Nil) {
		errorInterno(w, err)
		return
	}
	if intentos >= maxIntentosLogin {
		responderError(w, http.StatusTooManyRequests, "Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.")
		return
	}

	var u Usuario
	var hash string
	err = s.db.QueryRowContext(ctx,
		`SELECT id, nombre, email, rol, password_hash FROM usuarios WHERE email = $1`, datos.Email,
	).Scan(&u.ID, &u.Nombre, &u.Email, &u.Rol, &hash)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		errorInterno(w, err)
		return
	}

	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(datos.Password)) != nil {
		// Mismo mensaje si el email no existe o la contraseña es incorrecta,
		// para no revelar qué correos están registrados.
		pipe := s.redis.TxPipeline()
		pipe.Incr(ctx, claveIntentos)
		pipe.Expire(ctx, claveIntentos, bloqueoLogin)
		if _, err := pipe.Exec(ctx); err != nil {
			log.Printf("No se pudo registrar el intento fallido: %v", err)
		}
		responderError(w, http.StatusUnauthorized, "Correo o contraseña incorrectos.")
		return
	}

	s.redis.Del(ctx, claveIntentos)
	s.responderSesion(w, http.StatusOK, u)
}

// POST /logout (Authorization: Bearer <token>) -> revoca el token en Redis hasta que expire.
func (s *Servidor) logout(w http.ResponseWriter, r *http.Request) {
	claims, err := s.validarToken(r)
	if err != nil {
		responderError(w, http.StatusUnauthorized, "Sesión no válida.")
		return
	}
	restante := time.Until(claims.ExpiresAt.Time)
	if restante > 0 {
		if err := s.redis.Set(r.Context(), claveRevocado(claims.ID), 1, restante).Err(); err != nil {
			errorInterno(w, err)
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /me (Authorization: Bearer <token>) -> datos del usuario de la sesión.
func (s *Servidor) me(w http.ResponseWriter, r *http.Request) {
	claims, err := s.validarToken(r)
	if err != nil {
		responderError(w, http.StatusUnauthorized, "Sesión no válida.")
		return
	}
	id, _ := strconv.Atoi(claims.Subject)

	var u Usuario
	err = s.db.QueryRowContext(r.Context(),
		`SELECT id, nombre, email, rol FROM usuarios WHERE id = $1`, id,
	).Scan(&u.ID, &u.Nombre, &u.Email, &u.Rol)
	if errors.Is(err, sql.ErrNoRows) {
		responderError(w, http.StatusUnauthorized, "Sesión no válida.")
		return
	}
	if err != nil {
		errorInterno(w, err)
		return
	}
	responderJSON(w, http.StatusOK, u)
}

// GET /usuarios/total (Authorization: Bearer <token de admin>) -> {"total": n}.
// Lo usa analitica para su dashboard sin acceder a la BD de auth.
func (s *Servidor) totalUsuarios(w http.ResponseWriter, r *http.Request) {
	claims, err := s.validarToken(r)
	if err != nil {
		responderError(w, http.StatusUnauthorized, "Sesión no válida.")
		return
	}
	if claims.Rol != "admin" {
		responderError(w, http.StatusForbidden, "No tienes permisos para realizar esta acción.")
		return
	}

	var total int
	if err := s.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM usuarios`).Scan(&total); err != nil {
		errorInterno(w, err)
		return
	}
	responderJSON(w, http.StatusOK, map[string]int{"total": total})
}

func (s *Servidor) responderSesion(w http.ResponseWriter, status int, u Usuario) {
	token, err := s.generarToken(u)
	if err != nil {
		errorInterno(w, err)
		return
	}
	responderJSON(w, status, respuestaSesion{Token: token, Usuario: u})
}

func normalizarEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func emailValido(email string) bool {
	if len(email) > 255 {
		return false
	}
	dir, err := mail.ParseAddress(email)
	return err == nil && dir.Address == email && strings.Contains(email[strings.LastIndex(email, "@"):], ".")
}

func responderJSON(w http.ResponseWriter, status int, cuerpo any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(cuerpo)
}

func responderError(w http.ResponseWriter, status int, mensaje string) {
	responderJSON(w, status, map[string]string{"error": mensaje})
}

func errorInterno(w http.ResponseWriter, err error) {
	log.Printf("Error interno: %v", err)
	responderError(w, http.StatusInternalServerError, "Error interno del servidor.")
}
