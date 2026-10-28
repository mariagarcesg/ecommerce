package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/mail"
	"regexp"
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
		`INSERT INTO usuarios (nombre, email, password_hash, rol_id, verificado) VALUES ($1, $2, $3, (SELECT id FROM roles WHERE nombre = $4), false) RETURNING id`,
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
	var verificado, activo bool
	err := s.db.QueryRowContext(ctx,
		`SELECT u.id, u.nombre, u.email, r.nombre, u.verificado, u.activo FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.email = $1`, datos.Email,
	).Scan(&u.ID, &u.Nombre, &u.Email, &u.Rol, &verificado, &activo)
	if errors.Is(err, sql.ErrNoRows) {
		responderError(w, http.StatusBadRequest, "El código no es válido.")
		return
	}
	if err != nil {
		errorInterno(w, err)
		return
	}
	if !activo {
		responderCuentaDesactivada(w)
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

	var verificado, activo bool
	err := s.db.QueryRowContext(ctx,
		`SELECT verificado, activo FROM usuarios WHERE email = $1`, datos.Email,
	).Scan(&verificado, &activo)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && (verificado || !activo)) {
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
	var verificado, activo bool
	err = s.db.QueryRowContext(ctx,
		`SELECT u.id, u.nombre, u.email, r.nombre, u.password_hash, u.verificado, u.activo FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.email = $1`, datos.Email,
	).Scan(&u.ID, &u.Nombre, &u.Email, &u.Rol, &hash, &verificado, &activo)
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
	if !activo {
		responderCuentaDesactivada(w)
		return
	}
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

	// Si el admin desactivó la cuenta a mitad del login, el ticket deja de servir
	err = s.db.QueryRowContext(ctx,
		`SELECT u.id, u.nombre, u.email, r.nombre FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = $1 AND u.activo`, id,
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
		`SELECT u.id, u.nombre, u.email, r.nombre FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = $1 AND u.activo`, id,
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

	filas, err := s.db.QueryContext(r.Context(), `SELECT u.id, u.nombre, u.email, r.nombre, u.verificado, u.activo FROM usuarios u JOIN roles r ON r.id = u.rol_id ORDER BY u.id`)
	if err != nil {
		errorInterno(w, err)
		return
	}
	defer filas.Close()

	usuarios := []usuarioListado{}
	for filas.Next() {
		var u usuarioListado
		if err := filas.Scan(&u.ID, &u.Nombre, &u.Email, &u.Rol, &u.Verificado, &u.Activo); err != nil {
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

// Usuario tal como lo ve el panel admin (nunca incluye el hash de la contraseña).
type usuarioListado struct {
	Usuario
	Verificado bool `json:"verificado"`
	Activo     bool `json:"activo"`
}

// POST /usuarios {nombre, email, rol, password} (admin) -> crea una cuenta ya
// verificada: la crea el admin a propósito, no hace falta el código de registro.
// Cada inicio de sesión sigue pidiendo el código OTP.
func (s *Servidor) crearUsuario(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.exigirAdmin(w, r); !ok {
		return
	}
	var datos struct {
		Nombre   string `json:"nombre"`
		Email    string `json:"email"`
		Rol      string `json:"rol"`
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
	case len(datos.Password) < 8 || len(datos.Password) > 72:
		responderError(w, http.StatusBadRequest, "La contraseña debe tener entre 8 y 72 caracteres.")
		return
	}
	if !s.validarRol(w, r, datos.Rol) {
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(datos.Password), bcrypt.DefaultCost)
	if err != nil {
		errorInterno(w, err)
		return
	}

	u := usuarioListado{Usuario: Usuario{Nombre: datos.Nombre, Email: datos.Email, Rol: datos.Rol}, Verificado: true, Activo: true}
	err = s.db.QueryRowContext(r.Context(),
		`INSERT INTO usuarios (nombre, email, password_hash, rol_id, verificado, activo) VALUES ($1, $2, $3, (SELECT id FROM roles WHERE nombre = $4), true, true) RETURNING id`,
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
	responderJSON(w, http.StatusCreated, u)
}

// PUT /usuarios/{id} {nombre, rol, verificado, activo, password?} (admin) -> edita
// la cuenta. El correo no se edita (los códigos OTP llegarían a una dirección sin
// comprobar). password vacío = no se cambia. Las cuentas no se borran: se desactivan.
// Si cambian el rol, la contraseña o el estado, se cierran las sesiones abiertas del
// usuario para que el cambio aplique de inmediato.
func (s *Servidor) actualizarUsuario(w http.ResponseWriter, r *http.Request) {
	adminID, ok := s.exigirAdmin(w, r)
	if !ok {
		return
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		responderError(w, http.StatusNotFound, "Usuario no encontrado.")
		return
	}
	var datos struct {
		Nombre     string `json:"nombre"`
		Rol        string `json:"rol"`
		Verificado bool   `json:"verificado"`
		Activo     bool   `json:"activo"`
		Password   string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&datos); err != nil {
		responderError(w, http.StatusBadRequest, "Datos inválidos.")
		return
	}
	datos.Nombre = strings.TrimSpace(datos.Nombre)

	switch {
	case datos.Nombre == "" || len(datos.Nombre) > 100:
		responderError(w, http.StatusBadRequest, "El nombre es obligatorio (máximo 100 caracteres).")
		return
	case datos.Password != "" && (len(datos.Password) < 8 || len(datos.Password) > 72):
		responderError(w, http.StatusBadRequest, "La contraseña debe tener entre 8 y 72 caracteres.")
		return
	// Quien edita es un admin activo y no puede dejar de serlo: así nunca se
	// queda la tienda sin administradores.
	case id == adminID && (datos.Rol != "admin" || !datos.Activo):
		responderError(w, http.StatusBadRequest, "No puedes quitarte el rol de admin ni desactivar tu propia cuenta.")
		return
	}
	if !s.validarRol(w, r, datos.Rol) {
		return
	}

	ctx := r.Context()
	var antes usuarioListado
	err = s.db.QueryRowContext(ctx,
		`SELECT u.id, u.nombre, u.email, r.nombre, u.verificado, u.activo FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = $1`, id,
	).Scan(&antes.ID, &antes.Nombre, &antes.Email, &antes.Rol, &antes.Verificado, &antes.Activo)
	if errors.Is(err, sql.ErrNoRows) {
		responderError(w, http.StatusNotFound, "Usuario no encontrado.")
		return
	}
	if err != nil {
		errorInterno(w, err)
		return
	}

	consulta := `UPDATE usuarios SET nombre = $1, rol_id = (SELECT id FROM roles WHERE nombre = $2), verificado = $3, activo = $4 WHERE id = $5`
	args := []any{datos.Nombre, datos.Rol, datos.Verificado, datos.Activo, id}
	if datos.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(datos.Password), bcrypt.DefaultCost)
		if err != nil {
			errorInterno(w, err)
			return
		}
		consulta = `UPDATE usuarios SET nombre = $1, rol_id = (SELECT id FROM roles WHERE nombre = $2), verificado = $3, activo = $4, password_hash = $6 WHERE id = $5`
		args = append(args, string(hash))
	}
	if _, err := s.db.ExecContext(ctx, consulta, args...); err != nil {
		errorInterno(w, err)
		return
	}

	// El propio admin no se cierra la sesión con la que está editando
	cambioSensible := datos.Rol != antes.Rol || datos.Activo != antes.Activo || datos.Password != ""
	if cambioSensible && id != adminID {
		if err := s.invalidarSesiones(ctx, id); err != nil {
			log.Printf("No se pudieron cerrar las sesiones del usuario %d: %v", id, err)
		}
	}

	responderJSON(w, http.StatusOK, usuarioListado{
		Usuario:    Usuario{ID: id, Nombre: datos.Nombre, Email: antes.Email, Rol: datos.Rol},
		Verificado: datos.Verificado,
		Activo:     datos.Activo,
	})
}

// Comprueba que quien llama sea un admin activo según la base de datos, no solo
// según el JWT (que conserva el rol con el que se emitió). Devuelve su id.
func (s *Servidor) exigirAdmin(w http.ResponseWriter, r *http.Request) (int, bool) {
	claims, err := s.validarToken(r)
	if err != nil {
		responderError(w, http.StatusUnauthorized, "Sesión no válida.")
		return 0, false
	}
	id, _ := strconv.Atoi(claims.Subject)
	var esAdmin bool
	err = s.db.QueryRowContext(r.Context(),
		`SELECT r.nombre = 'admin' AND u.activo FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = $1`, id,
	).Scan(&esAdmin)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		errorInterno(w, err)
		return 0, false
	}
	if !esAdmin {
		responderError(w, http.StatusForbidden, "No tienes permisos para realizar esta acción.")
		return 0, false
	}
	return id, true
}

type Rol struct {
	ID          int    `json:"id"`
	Nombre      string `json:"nombre"`
	Descripcion string `json:"descripcion"`
	Usuarios    int    `json:"usuarios"` // cuántas cuentas lo tienen
	Base        bool   `json:"base"`     // admin y cliente: el código depende de su nombre
}

// Los permisos están en el código y se deciden por el nombre del rol ("admin"
// abre el panel; el resto compra como cliente). Por eso estos dos no se
// renombran ni se borran. Un rol nuevo funciona como cliente.
var rolesBase = map[string]bool{"admin": true, "cliente": true}

// Minúsculas, números, guion y guion bajo: el nombre viaja en el JWT
var formatoNombreRol = regexp.MustCompile(`^[a-z][a-z0-9_-]{1,19}$`)

// GET /roles (admin) -> [{id, nombre, descripcion, usuarios, base}] de la tabla roles.
func (s *Servidor) listarRoles(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.exigirAdmin(w, r); !ok {
		return
	}
	filas, err := s.db.QueryContext(r.Context(), `
		SELECT r.id, r.nombre, r.descripcion, COUNT(u.id)
		FROM roles r LEFT JOIN usuarios u ON u.rol_id = r.id
		GROUP BY r.id ORDER BY r.id`)
	if err != nil {
		errorInterno(w, err)
		return
	}
	defer filas.Close()

	roles := []Rol{}
	for filas.Next() {
		var rol Rol
		if err := filas.Scan(&rol.ID, &rol.Nombre, &rol.Descripcion, &rol.Usuarios); err != nil {
			errorInterno(w, err)
			return
		}
		rol.Base = rolesBase[rol.Nombre]
		roles = append(roles, rol)
	}
	if err := filas.Err(); err != nil {
		errorInterno(w, err)
		return
	}
	responderJSON(w, http.StatusOK, roles)
}

// Lee y valida {nombre, descripcion} del body. Si algo falla responde 400 y devuelve false.
func leerRol(w http.ResponseWriter, r *http.Request) (Rol, bool) {
	var datos Rol
	if err := json.NewDecoder(r.Body).Decode(&datos); err != nil {
		responderError(w, http.StatusBadRequest, "Datos inválidos.")
		return datos, false
	}
	datos.Nombre = strings.ToLower(strings.TrimSpace(datos.Nombre))
	datos.Descripcion = strings.TrimSpace(datos.Descripcion)
	switch {
	case !formatoNombreRol.MatchString(datos.Nombre):
		responderError(w, http.StatusBadRequest, "El nombre del rol debe tener de 2 a 20 caracteres: minúsculas, números, - o _, y empezar con una letra.")
		return datos, false
	case len(datos.Descripcion) > 200:
		responderError(w, http.StatusBadRequest, "La descripción no puede tener más de 200 caracteres.")
		return datos, false
	}
	return datos, true
}

// POST /roles {nombre, descripcion} (admin) -> crea un rol nuevo.
func (s *Servidor) crearRol(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.exigirAdmin(w, r); !ok {
		return
	}
	rol, ok := leerRol(w, r)
	if !ok {
		return
	}
	err := s.db.QueryRowContext(r.Context(),
		`INSERT INTO roles (nombre, descripcion) VALUES ($1, $2) RETURNING id`, rol.Nombre, rol.Descripcion,
	).Scan(&rol.ID)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
		responderError(w, http.StatusConflict, "Ya existe un rol con ese nombre.")
		return
	}
	if err != nil {
		errorInterno(w, err)
		return
	}
	responderJSON(w, http.StatusCreated, rol)
}

// PUT /roles/{id} {nombre, descripcion} (admin) -> edita un rol. De admin y
// cliente solo se cambia la descripción.
func (s *Servidor) actualizarRol(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.exigirAdmin(w, r); !ok {
		return
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		responderError(w, http.StatusNotFound, "Rol no encontrado.")
		return
	}
	rol, ok := leerRol(w, r)
	if !ok {
		return
	}
	ctx := r.Context()

	var nombreActual string
	err = s.db.QueryRowContext(ctx, `SELECT nombre FROM roles WHERE id = $1`, id).Scan(&nombreActual)
	if errors.Is(err, sql.ErrNoRows) {
		responderError(w, http.StatusNotFound, "Rol no encontrado.")
		return
	}
	if err != nil {
		errorInterno(w, err)
		return
	}
	if rolesBase[nombreActual] && rol.Nombre != nombreActual {
		responderError(w, http.StatusBadRequest, "Los roles admin y cliente no se pueden renombrar: el sistema depende de esos nombres.")
		return
	}

	_, err = s.db.ExecContext(ctx, `UPDATE roles SET nombre = $1, descripcion = $2 WHERE id = $3`, rol.Nombre, rol.Descripcion, id)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		responderError(w, http.StatusConflict, "Ya existe un rol con ese nombre.")
		return
	}
	if err != nil {
		errorInterno(w, err)
		return
	}
	// El nombre viaja en el JWT: si cambió, las sesiones abiertas de esos
	// usuarios quedan con el nombre viejo y se cierran.
	if rol.Nombre != nombreActual {
		if err := s.invalidarSesionesDeRol(ctx, id); err != nil {
			log.Printf("No se pudieron cerrar las sesiones del rol %d: %v", id, err)
		}
	}
	rol.ID = id
	rol.Base = rolesBase[rol.Nombre]
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM usuarios WHERE rol_id = $1`, id).Scan(&rol.Usuarios); err != nil {
		errorInterno(w, err)
		return
	}
	responderJSON(w, http.StatusOK, rol)
}

// DELETE /roles/{id} (admin) -> elimina un rol que nadie usa. admin y cliente no se borran.
func (s *Servidor) eliminarRol(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.exigirAdmin(w, r); !ok {
		return
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		responderError(w, http.StatusNotFound, "Rol no encontrado.")
		return
	}
	ctx := r.Context()

	var nombre string
	var usuarios int
	err = s.db.QueryRowContext(ctx,
		`SELECT r.nombre, COUNT(u.id) FROM roles r LEFT JOIN usuarios u ON u.rol_id = r.id WHERE r.id = $1 GROUP BY r.id`, id,
	).Scan(&nombre, &usuarios)
	if errors.Is(err, sql.ErrNoRows) {
		responderError(w, http.StatusNotFound, "Rol no encontrado.")
		return
	}
	if err != nil {
		errorInterno(w, err)
		return
	}
	switch {
	case rolesBase[nombre]:
		responderError(w, http.StatusBadRequest, "Los roles admin y cliente no se pueden eliminar.")
		return
	case usuarios > 0:
		responderError(w, http.StatusConflict, fmt.Sprintf("No se puede eliminar: %d usuario(s) tienen este rol. Cámbiales el rol primero.", usuarios))
		return
	}

	// La clave foránea usuarios.rol_id también impide borrarlo si alguien lo
	// tomó entre la consulta anterior y esta
	_, err = s.db.ExecContext(ctx, `DELETE FROM roles WHERE id = $1`, id)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" { // foreign_key_violation
		responderError(w, http.StatusConflict, "No se puede eliminar: hay usuarios con este rol.")
		return
	}
	if err != nil {
		errorInterno(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Servidor) invalidarSesionesDeRol(ctx context.Context, rolID int) error {
	filas, err := s.db.QueryContext(ctx, `SELECT id FROM usuarios WHERE rol_id = $1`, rolID)
	if err != nil {
		return err
	}
	defer filas.Close()
	for filas.Next() {
		var id int
		if err := filas.Scan(&id); err != nil {
			return err
		}
		if err := s.invalidarSesiones(ctx, id); err != nil {
			return err
		}
	}
	return filas.Err()
}

// Responde 400 si el rol no está en la tabla roles. Devuelve true si es válido.
func (s *Servidor) validarRol(w http.ResponseWriter, r *http.Request, nombre string) bool {
	var existe bool
	if err := s.db.QueryRowContext(r.Context(),
		`SELECT EXISTS (SELECT 1 FROM roles WHERE nombre = $1)`, nombre,
	).Scan(&existe); err != nil {
		errorInterno(w, err)
		return false
	}
	if !existe {
		responderError(w, http.StatusBadRequest, "El rol no existe.")
		return false
	}
	return true
}

func responderCuentaDesactivada(w http.ResponseWriter) {
	responderJSON(w, http.StatusForbidden, map[string]string{
		"error":  "Tu cuenta está desactivada. Contacta al administrador de la tienda.",
		"codigo": "cuenta_desactivada",
	})
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
