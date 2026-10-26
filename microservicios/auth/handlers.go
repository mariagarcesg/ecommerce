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
	otpURL    string
	http      *http.Client
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

// POST /registro {nombre, email, password} -> crea un usuario "cliente" sin verificar
// y le pide a otp que envíe el código al correo. La sesión se entrega en /verificar.
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
		`INSERT INTO usuarios (nombre, email, password_hash, rol, verificado) VALUES ($1, $2, $3, $4, false) RETURNING id`,
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

	// La cuenta ya existe aunque falle el correo: el usuario puede pedir
	// el código otra vez desde la pantalla de verificación.
	enviado := true
	if err := s.enviarCodigoOTP(r.Context(), u.Email); err != nil {
		log.Printf("No se pudo enviar el código de verificación a %s: %v", u.Email, err)
		enviado = false
	}
	responderJSON(w, http.StatusCreated, map[string]any{
		"mensaje":        "Cuenta creada. Revisa tu correo para verificarla.",
		"email":          u.Email,
		"correo_enviado": enviado,
	})
}

// POST /verificar {email, codigo} -> valida el código con otp, marca el correo
// como verificado y deja al usuario logueado.
func (s *Servidor) verificar(w http.ResponseWriter, r *http.Request) {
	var datos struct {
		Email  string `json:"email"`
		Codigo string `json:"codigo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&datos); err != nil {
		responderError(w, http.StatusBadRequest, "Datos inválidos.")
		return
	}
	datos.Email = normalizarEmail(datos.Email)
	ctx := r.Context()

	var u Usuario
	var verificado bool
	err := s.db.QueryRowContext(ctx,
		`SELECT id, nombre, email, rol, verificado FROM usuarios WHERE email = $1`, datos.Email,
	).Scan(&u.ID, &u.Nombre, &u.Email, &u.Rol, &verificado)
	if errors.Is(err, sql.ErrNoRows) {
		responderError(w, http.StatusBadRequest, "El código no es válido.")
		return
	}
	if err != nil {
		errorInterno(w, err)
		return
	}
	if verificado {
		responderError(w, http.StatusConflict, "Este correo ya está verificado. Inicia sesión.")
		return
	}

	if err := s.validarCodigoOTP(ctx, u.Email, datos.Codigo); err != nil {
		var eOTP *errorOTP
		if errors.As(err, &eOTP) {
			responderJSON(w, eOTP.Status, eOTP)
			return
		}
		log.Printf("Error validando el código con otp: %v", err)
		responderError(w, http.StatusBadGateway, "No se pudo validar el código. Intenta de nuevo.")
		return
	}

	if _, err := s.db.ExecContext(ctx, `UPDATE usuarios SET verificado = true WHERE id = $1`, u.ID); err != nil {
		errorInterno(w, err)
		return
	}
	s.responderSesion(w, http.StatusOK, u)
}

// POST /reenviar-codigo {email} -> pide a otp un código nuevo si la cuenta existe
// y no está verificada. Si no, responde lo mismo para no revelar qué correos hay.
func (s *Servidor) reenviarCodigo(w http.ResponseWriter, r *http.Request) {
	var datos struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&datos); err != nil {
		responderError(w, http.StatusBadRequest, "Datos inválidos.")
		return
	}
	datos.Email = normalizarEmail(datos.Email)
	ctx := r.Context()
	respuesta := map[string]string{"mensaje": "Si la cuenta existe y no está verificada, te enviamos un código nuevo."}

	var verificado bool
	err := s.db.QueryRowContext(ctx,
		`SELECT verificado FROM usuarios WHERE email = $1`, datos.Email,
	).Scan(&verificado)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && verificado) {
		responderJSON(w, http.StatusAccepted, respuesta)
		return
	}
	if err != nil {
		errorInterno(w, err)
		return
	}

	if err := s.enviarCodigoOTP(ctx, datos.Email); err != nil {
		var eOTP *errorOTP
		if errors.As(err, &eOTP) {
			responderJSON(w, eOTP.Status, eOTP)
			return
		}
		log.Printf("Error pidiendo el código a otp: %v", err)
		responderError(w, http.StatusBadGateway, "No se pudo enviar el código. Intenta de nuevo.")
		return
	}
	responderJSON(w, http.StatusAccepted, respuesta)
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
	var verificado bool
	err = s.db.QueryRowContext(ctx,
		`SELECT id, nombre, email, rol, password_hash, verificado FROM usuarios WHERE email = $1`, datos.Email,
	).Scan(&u.ID, &u.Nombre, &u.Email, &u.Rol, &hash, &verificado)
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

	// Solo se avisa después de comprobar la contraseña, para no revelar
	// a terceros si un correo está registrado.
	if !verificado {
		responderJSON(w, http.StatusForbidden, map[string]string{
			"error":  "Verifica tu correo para iniciar sesión.",
			"codigo": "correo_no_verificado",
		})
		return
	}
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

// GET /usuarios (Authorization: Bearer <token de admin>) -> [{id, nombre, email, rol}].
// Lo usa analitica para el detalle por rol; nunca devuelve el hash de la contraseña.
func (s *Servidor) listarUsuarios(w http.ResponseWriter, r *http.Request) {
	claims, err := s.validarToken(r)
	if err != nil {
		responderError(w, http.StatusUnauthorized, "Sesión no válida.")
		return
	}
	if claims.Rol != "admin" {
		responderError(w, http.StatusForbidden, "No tienes permisos para realizar esta acción.")
		return
	}

	filas, err := s.db.QueryContext(r.Context(), `SELECT id, nombre, email, rol FROM usuarios ORDER BY id`)
	if err != nil {
		errorInterno(w, err)
		return
	}
	defer filas.Close()

	usuarios := []Usuario{}
	for filas.Next() {
		var u Usuario
		if err := filas.Scan(&u.ID, &u.Nombre, &u.Email, &u.Rol); err != nil {
			errorInterno(w, err)
			return
		}
		usuarios = append(usuarios, u)
	}
	if err := filas.Err(); err != nil {
		errorInterno(w, err)
		return
	}
	responderJSON(w, http.StatusOK, usuarios)
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
