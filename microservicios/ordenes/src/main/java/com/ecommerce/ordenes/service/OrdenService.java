package com.ecommerce.ordenes.service;

import com.ecommerce.ordenes.model.Orden;
import com.ecommerce.ordenes.repository.OrdenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
        
        if (orden.getDetalles() != null) {
            orden.getDetalles().forEach(detalle -> {
                detalle.setOrden(orden);
            });
        }
        
        return ordenRepository.save(orden);
    }

    public List<Orden> listarOrdenesPorUsuario(Long usuarioId) {
        return ordenRepository.findByUsuarioId(usuarioId);
    }
    public Orden buscarOrdenPorId(Long id) {
    return ordenRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Orden no encontrada con el ID: " + id));
}
}