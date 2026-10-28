package com.ecommerce.ordenes.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

// JWT HS256 firmados con el JWT_SECRET compartido con auth, sin librerías extra:
// la firma es un HMAC-SHA256 de "header.payload".
@Component
public class JwtService {

    public record Sesion(long usuarioId, String rol) {
        public boolean esAdmin() { return "admin".equals(rol); }
    }

    private final byte[] secreto;
    private final ObjectMapper mapper;

    public JwtService(@Value("${jwt.secret}") String secreto, ObjectMapper mapper) {
        this.secreto = secreto.getBytes(StandardCharsets.UTF_8);
        this.mapper = mapper;
    }

    // Lee "Authorization: Bearer <token>" y verifica firma, algoritmo y vencimiento.
    public Sesion verificar(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw noAutorizado("Inicia sesión para continuar.");
        }
        String[] partes = authorization.substring(7).trim().split("\\.");
        if (partes.length != 3) throw noAutorizado("Sesión no válida.");
        try {
            Map<String, Object> header = leerJson(partes[0]);
            byte[] firmaEsperada = firmar(partes[0] + "." + partes[1]);
            byte[] firmaRecibida = Base64.getUrlDecoder().decode(partes[2]);
            if (!"HS256".equals(header.get("alg")) || !MessageDigest.isEqual(firmaEsperada, firmaRecibida)) {
                throw noAutorizado("Sesión no válida.");
            }
            Map<String, Object> claims = leerJson(partes[1]);
            if (!(claims.get("exp") instanceof Number exp) || exp.longValue() <= Instant.now().getEpochSecond()) {
                throw noAutorizado("Tu sesión expiró. Vuelve a iniciar sesión.");
            }
            return new Sesion(Long.parseLong(String.valueOf(claims.get("sub"))), String.valueOf(claims.get("rol")));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw noAutorizado("Sesión no válida.");
        }
    }

    // Token de un minuto con rol admin para que ordenes descuente stock en catálogo
    // (catálogo exige admin para PATCH /products/{id}/stock).
    public String tokenServicio() {
        long ahora = Instant.now().getEpochSecond();
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("sub", "0");
        claims.put("nombre", "servicio-ordenes");
        claims.put("rol", "admin");
        claims.put("iat", ahora);
        claims.put("exp", ahora + 60);
        try {
            String header = base64(mapper.writeValueAsBytes(Map.of("alg", "HS256", "typ", "JWT")));
            String payload = base64(mapper.writeValueAsBytes(claims));
            return header + "." + payload + "." + base64(firmar(header + "." + payload));
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo firmar el token de servicio", e);
        }
    }

    private byte[] firmar(String datos) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secreto, "HmacSHA256"));
        return mac.doFinal(datos.getBytes(StandardCharsets.UTF_8));
    }

    private Map<String, Object> leerJson(String parteBase64) throws Exception {
        return mapper.readValue(Base64.getUrlDecoder().decode(parteBase64), new TypeReference<>() {});
    }

    private static String base64(byte[] datos) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(datos);
    }

    private static ResponseStatusException noAutorizado(String mensaje) {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, mensaje);
    }
}
