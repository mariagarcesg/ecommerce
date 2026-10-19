package com.ecommerce.ordenes.service;

import com.ecommerce.ordenes.model.Orden;
import com.ecommerce.ordenes.repository.OrdenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class OrdenService {

    @Autowired
    private OrdenRepository ordenRepository;

    @Transactional
    public Orden crearOrden(Orden orden) {
        orden.setFechaCreacion(LocalDateTime.now());
        orden.setEstado("PENDIENTE");
        
        // El total se calcula aquí; se ignora el que envíe el cliente
        BigDecimal total = BigDecimal.ZERO;
        if (orden.getDetalles() != null) {
            for (var detalle : orden.getDetalles()) {
                detalle.setOrden(orden);
                total = total.add(detalle.getPrecioUnitario().multiply(BigDecimal.valueOf(detalle.getCantidad())));
            }
        }
        orden.setTotal(total);

        return ordenRepository.save(orden);
    }

    public List<Orden> listarOrdenesPorUsuario(Long usuarioId) {
        return ordenRepository.findByUsuarioId(usuarioId);
    }
    public Orden buscarOrdenPorId(Long id) {
        return ordenRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Orden no encontrada con el ID: " + id));
    }
}