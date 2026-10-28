package main

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"mime"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"net/smtp"
	"time"
)

// Servidor SMTP. En desarrollo es Mailpit (sin usuario ni TLS); en un servidor
// real se usa el puerto 587 con usuario y contraseña (se activa STARTTLS si el
// servidor lo ofrece). El puerto 465 (TLS directo) no está soportado.
type ConfigSMTP struct {
	Host      string
	Port      string
	Usuario   string
	Password  string
	Remitente string // ej. "ECOMMERCE <no-responder@ecommerce.local>"
}

// Asunto y textos del correo según el propósito del código.
var textosCorreo = map[string]struct{ asunto, motivo, aviso string }{
	"registro": {"Tu código de verificación: ", "verificar tu cuenta", "Si no creaste una cuenta, ignora este correo."},
	"login":    {"Tu código para iniciar sesión: ", "iniciar sesión", "Si no fuiste tú, alguien conoce tu contraseña: cámbiala."},
}

func (c ConfigSMTP) enviarCodigo(destino, codigo, proposito string, vigencia time.Duration) error {
	remitente, err := mail.ParseAddress(c.Remitente)
	if err != nil {
		return fmt.Errorf("SMTP_FROM no es válido: %w", err)
	}
	para, err := mail.ParseAddress(destino)
	if err != nil {
		return fmt.Errorf("destinatario no válido: %w", err)
	}

	conn, err := net.DialTimeout("tcp", net.JoinHostPort(c.Host, c.Port), 10*time.Second)
	if err != nil {
		return err
	}
	conn.SetDeadline(time.Now().Add(30 * time.Second))

	cliente, err := smtp.NewClient(conn, c.Host)
	if err != nil {
		conn.Close()
		return err
	}
	defer cliente.Close()

	if ok, _ := cliente.Extension("STARTTLS"); ok {
		if err := cliente.StartTLS(&tls.Config{ServerName: c.Host}); err != nil {
			return err
		}
	}
	if c.Usuario != "" {
		if err := cliente.Auth(smtp.PlainAuth("", c.Usuario, c.Password, c.Host)); err != nil {
			return err
		}
	}

	if err := cliente.Mail(remitente.Address); err != nil {
		return err
	}
	if err := cliente.Rcpt(para.Address); err != nil {
		return err
	}
	escritor, err := cliente.Data()
	if err != nil {
		return err
	}
	if _, err := escritor.Write(armarMensaje(remitente, para, codigo, proposito, vigencia)); err != nil {
		return err
	}
	if err := escritor.Close(); err != nil {
		return err
	}
	return cliente.Quit()
}

func armarMensaje(remitente, para *mail.Address, codigo, proposito string, vigencia time.Duration) []byte {
	textos := textosCorreo[proposito]
	var cuerpo bytes.Buffer
	qp := quotedprintable.NewWriter(&cuerpo)
	fmt.Fprintf(qp, "Hola,\r\n\r\n"+
		"Tu código para %s en ECOMMERCE es:\r\n\r\n"+
		"    %s\r\n\r\n"+
		"Vence en %d minutos y solo se puede usar una vez.\r\n"+
		"%s\r\n",
		textos.motivo, codigo, int(vigencia.Minutes()), textos.aviso)
	qp.Close()

	var msg bytes.Buffer
	fmt.Fprintf(&msg, "From: %s\r\n", remitente.String())
	fmt.Fprintf(&msg, "To: %s\r\n", para.String())
	fmt.Fprintf(&msg, "Subject: %s\r\n", mime.QEncoding.Encode("utf-8", textos.asunto+codigo))
	fmt.Fprintf(&msg, "Date: %s\r\n", time.Now().Format(time.RFC1123Z))
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	msg.WriteString("Content-Transfer-Encoding: quoted-printable\r\n\r\n")
	msg.Write(cuerpo.Bytes())
	return msg.Bytes()
}
