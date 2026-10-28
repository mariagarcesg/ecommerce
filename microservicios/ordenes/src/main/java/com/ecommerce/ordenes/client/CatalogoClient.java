package com.ecommerce.ordenes.client;

import com.ecommerce.ordenes.security.JwtService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

// Consulta el microservicio catálogo (Node + MongoDB) dentro de la red de Docker:
// datos reales del producto y descuento de stock al confirmar una venta.
@Component
public class CatalogoClient {

    public record Producto(String id, String nombre, BigDecimal precio, int stock) {}

    private final String catalogoUrl;
    private final JwtService jwtService;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public CatalogoClient(@Value("${catalogo.url}") String catalogoUrl, JwtService jwtService, ObjectMapper mapper) {
        this.catalogoUrl = catalogoUrl.trim().replaceAll("/+$", "");
        this.jwtService = jwtService;
        this.mapper = mapper;
    }

    // GET /products/{id}. Devuelve null si el producto no existe.
    public Producto obtenerProducto(String productoId) {
        // Los ids de Mongo son 24 caracteres hexadecimales; otro valor ni se consulta
        if (productoId == null || !productoId.matches("^[0-9a-fA-F]{24}$")) return null;
        HttpResponse<String> res = enviar(HttpRequest.newBuilder(URI.create(catalogoUrl + "/products/" + productoId)).GET());
        if (res.statusCode() == 404) return null;
        if (res.statusCode() != 200) throw catalogoNoDisponible();
        try {
            JsonNode p = mapper.readTree(res.body());
            return new Producto(productoId, p.path("name").asText(), p.path("price").decimalValue(), p.path("stock").asInt());
        } catch (Exception e) {
            throw catalogoNoDisponible();
        }
    }

    // PATCH /products/{id}/stock {quantity}. Negativo = venta, positivo = devolver unidades.
    // Catálogo rechaza (400) si el stock quedaría por debajo de 0: devuelve false.
    public boolean ajustarStock(String productoId, int cantidad) {
        try {
            String cuerpo = mapper.writeValueAsString(Map.of("quantity", cantidad));
            HttpResponse<String> res = enviar(HttpRequest.newBuilder(URI.create(catalogoUrl + "/products/" + productoId + "/stock"))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + jwtService.tokenServicio())
                    .method("PATCH", HttpRequest.BodyPublishers.ofString(cuerpo)));
            if (res.statusCode() == 200) return true;
            if (res.statusCode() == 400) return false;
            throw catalogoNoDisponible();
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw catalogoNoDisponible();
        }
    }

    private HttpResponse<String> enviar(HttpRequest.Builder peticion) {
        try {
            return http.send(peticion.timeout(Duration.ofSeconds(5)).build(), HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw catalogoNoDisponible();
        }
    }

    private static ResponseStatusException catalogoNoDisponible() {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "No se pudo consultar el catálogo. Intenta de nuevo.");
    }
}
