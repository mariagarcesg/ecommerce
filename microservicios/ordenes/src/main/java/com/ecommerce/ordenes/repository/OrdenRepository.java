package com.ecommerce.ordenes.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ecommerce.ordenes.model.Orden;

import java.util.List;

@Repository
public interface OrdenRepository extends JpaRepository<Orden, Long> {
    List<Orden> findByUsuarioIdOrderByFechaCreacionDesc(Long usuarioId);

    List<Orden> findAllByOrderByFechaCreacionDesc();
}
