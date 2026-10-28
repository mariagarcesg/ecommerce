// Microservicio de autenticación.
//   PostgreSQL (esquema auth): usuarios y roles.
//   Redis: intentos fallidos de login, tickets de login pendientes de código y
//   tokens revocados (logout).
//   otp: envío y validación de los códigos que verifican el correo al
//   registrarse y que completan cada inicio de sesión.
package main

import (
	"log"
	"net/http"
	"os"
	"time"
)

type Config struct {
	Port          string
	DatabaseURL   string
	RedisAddr     string
	RedisPassword string
	JWTSecret     string
	OTPURL        string
}

func cargarConfig() Config {
	dbURL := "postgres://" + env("DB_USER", "auth") + ":" + env("DB_PASSWORD", "auth") +
		"@" + env("DB_HOST", "db") + ":" + env("DB_PORT", "5432") + "/" + env("DB_NAME", "ecommerce") +
		"?search_path=" + env("DB_SCHEMA", "auth") + "&sslmode=disable"

	cfg := Config{
		Port:          env("PORT", "8081"),
		DatabaseURL:   dbURL,
		RedisAddr:     env("REDIS_ADDR", "redis:6379"),
		RedisPassword: env("REDIS_PASSWORD", ""),
		JWTSecret:     os.Getenv("JWT_SECRET"),
		OTPURL:        env("OTP_URL", "http://otp:8083"),
	}
	if cfg.JWTSecret == "" {
		log.Fatal("Falta la variable de entorno JWT_SECRET")
	}
	return cfg
}

func env(clave, porDefecto string) string {
	if v := os.Getenv(clave); v != "" {
		return v
	}
	return porDefecto
}

func main() {
	cfg := cargarConfig()

	db, err := conectarPostgres(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Error conectando a PostgreSQL: %v", err)
	}
	defer db.Close()

	if err := aplicarMigraciones(db); err != nil {
		log.Fatalf("Error aplicando migraciones: %v", err)
	}

	rdb, err := conectarRedis(cfg.RedisAddr, cfg.RedisPassword)
	if err != nil {
		log.Fatalf("Error conectando a Redis: %v", err)
	}
	defer rdb.Close()

	srv := &Servidor{
		db:        db,
		redis:     rdb,
		jwtSecret: []byte(cfg.JWTSecret),
		otpURL:    cfg.OTPURL,
		http:      &http.Client{Timeout: 45 * time.Second}, // otp espera al servidor de correo
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", srv.health)
	mux.HandleFunc("POST /registro", srv.registro)
	mux.HandleFunc("POST /verificar", srv.verificar)
	mux.HandleFunc("POST /reenviar-codigo", srv.reenviarCodigo)
	mux.HandleFunc("POST /login", srv.login)
	mux.HandleFunc("POST /login/verificar", srv.loginVerificar)
	mux.HandleFunc("POST /login/reenviar", srv.loginReenviar)
	mux.HandleFunc("POST /logout", srv.logout)
	mux.HandleFunc("GET /me", srv.me)
	mux.HandleFunc("GET /usuarios", srv.listarUsuarios)
	mux.HandleFunc("POST /usuarios", srv.crearUsuario)
	mux.HandleFunc("PUT /usuarios/{id}", srv.actualizarUsuario)
	mux.HandleFunc("GET /roles", srv.listarRoles)
	mux.HandleFunc("POST /roles", srv.crearRol)
	mux.HandleFunc("PUT /roles/{id}", srv.actualizarRol)
	mux.HandleFunc("DELETE /roles/{id}", srv.eliminarRol)
	mux.HandleFunc("GET /usuarios/total", srv.totalUsuarios)

	log.Printf("Servicio de autenticación corriendo en puerto %s", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, mux))
}
