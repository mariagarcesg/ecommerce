package com.ecommerce.ordenes.controller;

import com.ecommerce.ordenes.model.Orden;
import com.ecommerce.ordenes.service.OrdenService;

import jakarta.validation.Valid;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ordenes")
public class OrdenesController {

    @Autowired
    private OrdenService ordenService;

    @PostMapping
    public ResponseEntity<Orden> crearOrden(@Valid @RequestBody Orden orden) {
        Orden nuevaOrden = ordenService.crearOrden(orden);
        return new ResponseEntity<>(nuevaOrden, HttpStatus.CREATED);
    }

    @GetMapping("/usuario/{usuarioId}")
    public ResponseEntity<List<Orden>> listarOrdenesPorUsuario(@PathVariable Long usuarioId) {
        List<Orden> ordenes = ordenService.listarOrdenesPorUsuario(usuarioId);
        return ResponseEntity.ok(ordenes);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Orden> obtenerOrdenPorId(@PathVariable Long id) {
        Orden orden = ordenService.buscarOrdenPorId(id);
        return ResponseEntity.ok(orden);
    }

}