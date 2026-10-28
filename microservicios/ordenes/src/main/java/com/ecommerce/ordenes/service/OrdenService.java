package com.ecommerce.ordenes.service;

import com.ecommerce.ordenes.client.CatalogoClient;
import com.ecommerce.ordenes.dto.CrearOrdenRequest;
import com.ecommerce.ordenes.model.DetalleOrden;
import com.ecommerce.ordenes.model.Orden;
import com.ecommerce.ordenes.repository.OrdenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class OrdenService {

    private static final Logger log = LoggerFactory.getLogger(OrdenService.class);

    // Cupones que acepta la tienda (los mismos que ofrece el carrito)
    private static final Map<String, Integer> CUPONES = Map.of("PROFE20", 20);

    @Autowired
    private OrdenRepository ordenRepository;

    @Autowired
    private CatalogoClient catalogo;

    // Registra una venta con el pago ya aprobado en la pasarela:
    // 1) toma nombre, precio y stock reales del catálogo,
    // 2) descuenta el stock (y lo devuelve si algo falla después),
    // 3) guarda la orden como PAGADA con el total calculado aquí.
    @Transactional
    public Orden registrarVenta(long usuarioId, CrearOrdenRequest datos) {
        // Si el mismo producto viene en varias líneas se suman las cantidades
        Map<String, Integer> cantidades = new LinkedHashMap<>();
        for (var linea : datos.productos()) {
            cantidades.merge(linea.productoId(), linea.cantidad(), Integer::sum);
        }

        List<CatalogoClient.Producto> productos = new ArrayList<>();
        for (var entrada : cantidades.entrySet()) {
            CatalogoClient.Producto p = catalogo.obtenerProducto(entrada.getKey());
            if (p == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Un producto de tu carrito ya no está en el catálogo. Quítalo y vuelve a intentar.");
            }
            if (p.stock() < entrada.getValue()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, p.stock() == 0
                        ? "\"" + p.nombre() + "\" está agotado."
                        : "Solo quedan " + p.stock() + " unidades de \"" + p.nombre() + "\".");
            }
            productos.add(p);
        }

        // Descuento de stock; catálogo lo hace atómico y rechaza si no alcanza
        Map<String, Integer> descontados = new LinkedHashMap<>();
        try {
            for (var p : productos) {
                int cantidad = cantidades.get(p.id());
                if (!catalogo.ajustarStock(p.id(), -cantidad)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Ya no hay stock suficiente de \"" + p.nombre() + "\". Revisa tu carrito.");
                }
                descontados.put(p.id(), cantidad);
            }
            // saveAndFlush: si la BD falla, el error ocurre aquí y el stock se devuelve
            return ordenRepository.saveAndFlush(armarOrden(usuarioId, datos, productos, cantidades));
        } catch (RuntimeException e) {
            devolverStock(descontados);
            throw e;
        }
    }

    private Orden armarOrden(long usuarioId, CrearOrdenRequest datos,
                             List<CatalogoClient.Producto> productos, Map<String, Integer> cantidades) {
        Orden orden = new Orden();
        orden.setUsuarioId(usuarioId);
        orden.setEstado(Orden.ESTADO_PAGADA);
        orden.setClienteNombre(datos.clienteNombre().trim());
        orden.setTelefono(datos.telefono());
        orden.setDireccion(datos.direccion().trim());
        orden.setCiudad(datos.ciudad().trim());
        orden.setTarjetaUltimos4(datos.tarjetaUltimos4());

        BigDecimal subtotal = BigDecimal.ZERO;
        for (var p : productos) {
            int cantidad = cantidades.get(p.id());
            orden.agregarDetalle(new DetalleOrden(p.id(), p.nombre(), p.precio(), cantidad));
            subtotal = subtotal.add(p.precio().multiply(BigDecimal.valueOf(cantidad)));
        }

        String cupon = datos.cupon() == null ? null : datos.cupon().trim().toUpperCase();
        BigDecimal descuento = BigDecimal.ZERO;
        if (cupon != null && CUPONES.containsKey(cupon)) {
            orden.setCupon(cupon);
            descuento = subtotal.multiply(BigDecimal.valueOf(CUPONES.get(cupon))).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        }
        orden.setDescuento(descuento);
        orden.setTotal(subtotal.subtract(descuento).setScale(2, RoundingMode.HALF_UP));
        return orden;
    }

    // Compensación: si la venta no se completa, catálogo recupera las unidades
    private void devolverStock(Map<String, Integer> descontados) {
        descontados.forEach((productoId, cantidad) -> {
            try {
                catalogo.ajustarStock(productoId, cantidad);
            } catch (RuntimeException e) {
                log.error("No se pudieron devolver {} unidades del producto {}", cantidad, productoId, e);
            }
        });
    }

    public List<Orden> listarTodas() {
        return ordenRepository.findAllByOrderByFechaCreacionDesc();
    }

    public List<Orden> listarOrdenesPorUsuario(Long usuarioId) {
        return ordenRepository.findByUsuarioIdOrderByFechaCreacionDesc(usuarioId);
    }

    public Orden buscarOrdenPorId(Long id) {
        return ordenRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Orden no encontrada con el ID: " + id));
    }
}
