// Microservicio de códigos de verificación (OTP).
//   Redis: hash del código, intentos y límites de reenvío (todo con expiración).
//   SMTP: envío del código por correo (Mailpit en desarrollo).
// Solo lo llama auth por la red interna de Docker; no pasa por el gateway.
package main

import (
	"log"
	"net/http"
	"os"
)

type Config struct {
	Port          string
	RedisAddr     string
	RedisPassword string
	JWTSecret     string
	OTPSecret     string
	SMTP          ConfigSMTP
}

func cargarConfig() Config {
	cfg := Config{
		Port:          env("PORT", "8083"),
		RedisAddr:     env("REDIS_ADDR", "redis:6379"),
		RedisPassword: env("REDIS_PASSWORD", ""),
		JWTSecret:     os.Getenv("JWT_SECRET"),
		OTPSecret:     os.Getenv("OTP_SECRET"),
		SMTP: ConfigSMTP{
			Host:      env("SMTP_HOST", "mailpit"),
			Port:      env("SMTP_PORT", "1025"),
			Usuario:   os.Getenv("SMTP_USER"),
			Password:  os.Getenv("SMTP_PASSWORD"),
			Remitente: env("SMTP_FROM", "ECOMMERCE <no-responder@ecommerce.local>"),
		},
	}
	if cfg.JWTSecret == "" {
		log.Fatal("Falta la variable de entorno JWT_SECRET")
	}
	if cfg.OTPSecret == "" {
		log.Fatal("Falta la variable de entorno OTP_SECRET")
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

	rdb, err := conectarRedis(cfg.RedisAddr, cfg.RedisPassword)
	if err != nil {
		log.Fatalf("Error conectando a Redis: %v", err)
	}
	defer rdb.Close()

	srv := &Servidor{
		redis:     rdb,
		jwtSecret: []byte(cfg.JWTSecret),
		otpSecret: []byte(cfg.OTPSecret),
		correo:    cfg.SMTP,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", srv.health)
	mux.HandleFunc("POST /otp/enviar", srv.enviar)
	mux.HandleFunc("POST /otp/validar", srv.validar)

	log.Printf("Servicio de códigos OTP corriendo en puerto %s", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, mux))
}
