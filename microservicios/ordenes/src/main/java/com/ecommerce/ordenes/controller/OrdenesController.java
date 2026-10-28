package com.ecommerce.ordenes.controller;

import com.ecommerce.ordenes.dto.CrearOrdenRequest;
import com.ecommerce.ordenes.model.Orden;
import com.ecommerce.ordenes.security.JwtService;
import com.ecommerce.ordenes.service.OrdenService;

import jakarta.validation.Valid;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

// Todas las rutas exigen sesión (Authorization: Bearer <token de auth>).
@RestController
@RequestMapping("/api/ordenes")
public class OrdenesController {

    @Autowired
    private OrdenService ordenService;

    @Autowired
    private JwtService jwtService;

    // POST /api/ordenes: la pasarela confirma una compra con el pago aprobado.
    // El comprador sale del token, no del body.
    @PostMapping
    public ResponseEntity<Orden> crearOrden(@RequestHeader(value = "Authorization", required = false) String authorization,
                                            @Valid @RequestBody CrearOrdenRequest datos) {
        JwtService.Sesion sesion = jwtService.verificar(authorization);
        return new ResponseEntity<>(ordenService.registrarVenta(sesion.usuarioId(), datos), HttpStatus.CREATED);
    }

    // GET /api/ordenes: todas las ventas (panel admin y microservicio analitica)
    @GetMapping
    public List<Orden> listarTodas(@RequestHeader(value = "Authorization", required = false) String authorization) {
        exigirAdmin(jwtService.verificar(authorization));
        return ordenService.listarTodas();
    }

    // GET /api/ordenes/mias: compras de quien inició sesión ("Mis pedidos")
    @GetMapping("/mias")
    public List<Orden> listarMias(@RequestHeader(value = "Authorization", required = false) String authorization) {
        return ordenService.listarOrdenesPorUsuario(jwtService.verificar(authorization).usuarioId());
    }

    @GetMapping("/usuario/{usuarioId}")
    public List<Orden> listarOrdenesPorUsuario(@RequestHeader(value = "Authorization", required = false) String authorization,
                                               @PathVariable Long usuarioId) {
        JwtService.Sesion sesion = jwtService.verificar(authorization);
        if (!sesion.esAdmin() && sesion.usuarioId() != usuarioId) exigirAdmin(sesion);
        return ordenService.listarOrdenesPorUsuario(usuarioId);
    }

    @GetMapping("/{id}")
    public Orden obtenerOrdenPorId(@RequestHeader(value = "Authorization", required = false) String authorization,
                                   @PathVariable Long id) {
        JwtService.Sesion sesion = jwtService.verificar(authorization);
        Orden orden = ordenService.buscarOrdenPorId(id);
        if (!sesion.esAdmin() && orden.getUsuarioId() != sesion.usuarioId()) {
            // Mismo mensaje que si no existiera: no se revela que la orden es de otro
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Orden no encontrada con el ID: " + id);
        }
        return orden;
    }

    private static void exigirAdmin(JwtService.Sesion sesion) {
        if (!sesion.esAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes permisos para realizar esta acción.");
        }
    }
}
