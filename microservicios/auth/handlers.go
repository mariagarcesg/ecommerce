package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
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
	duracionTicket   = 10 * time.Minute // igual que la vigencia del código de otp
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
	if err := s.enviarCodigoOTP(r.Context(), u.Email, propositoRegistro); err != nil {
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

	if err := s.validarCodigoOTP(ctx, u.Email, propositoRegistro, datos.Codigo); err != nil {
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

	if err := s.enviarCodigoOTP(ctx, datos.Email, propositoRegistro); err != nil {
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

// POST /login {email, password} -> primer paso del inicio de sesión. Si la
// contraseña es correcta, otp envía un código al correo y se responde 202 con
// un ticket; el JWT se entrega en /login/verificar.
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

	// El ticket prueba que la contraseña ya se comprobó: sin él, /login/verificar
	// no acepta el código y no se puede entrar solo con acceso al correo.
	ticket, err := generarTicket()
	if err != nil {
		errorInterno(w, err)
		return
	}
	if err := s.redis.Set(ctx, claveTicket(ticket), u.ID, duracionTicket).Err(); err != nil {
		errorInterno(w, err)
		return
	}

	respuesta := map[string]any{
		"codigo":         "otp_requerido",
		"ticket":         ticket,
		"email":          u.Email,
		"correo_enviado": true,
	}
	if err := s.enviarCodigoOTP(ctx, u.Email, propositoLogin); err != nil {
		var eOTP *errorOTP
		if !errors.As(err, &eOTP) || eOTP.Status != http.StatusTooManyRequests {
			s.redis.Del(ctx, claveTicket(ticket))
			s.responderErrorOTP(w, err, "No se pudo enviar el código de inicio de sesión. Intenta de nuevo.")
			return
		}
		// Se pidió un código hace poco y sigue vigente: se usa ese.
		respuesta["correo_enviado"] = false
		respuesta["aviso"] = eOTP.Mensaje
		respuesta["reintentar_en"] = eOTP.ReintentarEn
	}
	responderJSON(w, http.StatusAccepted, respuesta)
}

// POST /login/verificar {ticket, codigo} -> segundo paso del inicio de sesión:
// valida con otp el código enviado al correo y devuelve el JWT.
func (s *Servidor) loginVerificar(w http.ResponseWriter, r *http.Request) {
	var datos struct {
		Ticket string `json:"ticket"`
		Codigo string `json:"codigo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&datos); err != nil {
		responderError(w, http.StatusBadRequest, "Datos inválidos.")
		return
	}
	ctx := r.Context()

	u, ok := s.usuarioDelTicket(w, r, datos.Ticket)
	if !ok {
		return
	}
	if err := s.validarCodigoOTP(ctx, u.Email, propositoLogin, datos.Codigo); err != nil {
		s.responderErrorOTP(w, err, "No se pudo validar el código. Intenta de nuevo.")
		return
	}

	// El ticket es de un solo uso: si otra petición lo consumió primero, esta no recibe sesión.
	borrados, err := s.redis.Del(ctx, claveTicket(datos.Ticket)).Result()
	if err != nil {
		errorInterno(w, err)
		return
	}
	if borrados == 0 {
		responderTicketExpirado(w)
		return
	}
	s.responderSesion(w, http.StatusOK, u)
}

// POST /login/reenviar {ticket} -> pide a otp otro código de inicio de sesión
// (otp limita a uno cada 60 s y 5 por hora).
func (s *Servidor) loginReenviar(w http.ResponseWriter, r *http.Request) {
	var datos struct {
		Ticket string `json:"ticket"`
	}
	if err := json.NewDecoder(r.Body).Decode(&datos); err != nil {
		responderError(w, http.StatusBadRequest, "Datos inválidos.")
		return
	}

	u, ok := s.usuarioDelTicket(w, r, datos.Ticket)
	if !ok {
		return
	}
	if err := s.enviarCodigoOTP(r.Context(), u.Email, propositoLogin); err != nil {
		s.responderErrorOTP(w, err, "No se pudo enviar el código. Intenta de nuevo.")
		return
	}
	responderJSON(w, http.StatusAccepted, map[string]string{"mensaje": "Te enviamos un código nuevo."})
}

// Busca el usuario dueño de un ticket de login vigente. Si no hay, responde 401.
func (s *Servidor) usuarioDelTicket(w http.ResponseWriter, r *http.Request, ticket string) (Usuario, bool) {
	var u Usuario
	if len(ticket) != 64 {
		responderTicketExpirado(w)
		return u, false
	}
	ctx := r.Context()

	id, err := s.redis.Get(ctx, claveTicket(ticket)).Int()
	if errors.Is(err, redis.Nil) {
		responderTicketExpirado(w)
		return u, false
	}
	if err != nil {
		errorInterno(w, err)
		return u, false
	}

	err = s.db.QueryRowContext(ctx,
		`SELECT id, nombre, email, rol FROM usuarios WHERE id = $1`, id,
	).Scan(&u.ID, &u.Nombre, &u.Email, &u.Rol)
	if errors.Is(err, sql.ErrNoRows) {
		responderTicketExpirado(w)
		return u, false
	}
	if err != nil {
		errorInterno(w, err)
		return u, false
	}
	return u, true
}

func responderTicketExpirado(w http.ResponseWriter) {
	responderJSON(w, http.StatusUnauthorized, map[string]string{
		"error":  "Tu inicio de sesión expiró. Ingresa tu contraseña de nuevo.",
		"codigo": "ticket_expirado",
	})
}

// Ticket aleatorio de 256 bits en hexadecimal (64 caracteres).
func generarTicket() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func claveTicket(ticket string) string {
	return "login_pendiente:" + ticket
}

// Los 4xx de otp traen un mensaje apto para el usuario y se devuelven tal cual;
// cualquier otro error se registra y se responde 502 con `mensaje`.
func (s *Servidor) responderErrorOTP(w http.ResponseWriter, err error, mensaje string) {
	var eOTP *errorOTP
	if errors.As(err, &eOTP) {
		responderJSON(w, eOTP.Status, eOTP)
		return
	}
	log.Printf("Error llamando a otp: %v", err)
	responderError(w, http.StatusBadGateway, mensaje)
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

// GET /usuarios (Authorization: Bearer <token de admin>) -> [{id, nombre, email, rol, verificado}].
// Lo usan analitica (detalle por rol) y la pestaña Usuarios del panel admin;
// nunca devuelve el hash de la contraseña.
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

	filas, err := s.db.QueryContext(r.Context(), `SELECT id, nombre, email, rol, verificado FROM usuarios ORDER BY id`)
	if err != nil {
		errorInterno(w, err)
		return
	}
	defer filas.Close()

	type usuarioListado struct {
		Usuario
		Verificado bool `json:"verificado"`
	}
	usuarios := []usuarioListado{}
	for filas.Next() {
		var u usuarioListado
		if err := filas.Scan(&u.ID, &u.Nombre, &u.Email, &u.Rol, &u.Verificado); err != nil {
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
