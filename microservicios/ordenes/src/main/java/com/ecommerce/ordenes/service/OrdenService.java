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
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class OrdenService {

    private static final Logger log = LoggerFactory.getLogger(OrdenService.class);

    // Cupones que acepta la tienda (los mismos que ofrece el carrito): el
    // porcentaje se aplica solo a los productos de esa categoría del catálogo
    private record Cupon(int porcentaje, String categoria) {}
    private static final Map<String, Cupon> CUPONES = Map.of("PROFE20", new Cupon(20, "Laptops"));

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

        // El cupón se valida antes de tocar el stock
        Cupon cupon = null;
        String codigoCupon = datos.cupon() == null || datos.cupon().isBlank() ? null : datos.cupon().trim().toUpperCase();
        if (codigoCupon != null) {
            cupon = CUPONES.get(codigoCupon);
            if (cupon == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El cupón " + codigoCupon + " no es válido.");
            }
            Cupon aplicable = cupon;
            if (productos.stream().noneMatch(p -> esDeCategoria(p, aplicable.categoria()))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "El cupón " + codigoCupon + " solo aplica a productos de la categoría " + cupon.categoria() + ".");
            }
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
            return ordenRepository.saveAndFlush(armarOrden(usuarioId, datos, productos, cantidades, codigoCupon, cupon));
        } catch (RuntimeException e) {
            devolverStock(descontados);
            throw e;
        }
    }

    private Orden armarOrden(long usuarioId, CrearOrdenRequest datos, List<CatalogoClient.Producto> productos,
                             Map<String, Integer> cantidades, String codigoCupon, Cupon cupon) {
        Orden orden = new Orden();
        orden.setUsuarioId(usuarioId);
        orden.setEstado(Orden.ESTADO_PAGADA);
        orden.setClienteNombre(datos.clienteNombre().trim());
        orden.setTelefono(datos.telefono());
        orden.setDireccion(datos.direccion().trim());
        orden.setCiudad(datos.ciudad().trim());
        orden.setTarjetaUltimos4(datos.tarjetaUltimos4());

        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal conDescuento = BigDecimal.ZERO; // suma de las líneas a las que aplica el cupón
        for (var p : productos) {
            int cantidad = cantidades.get(p.id());
            BigDecimal linea = p.precio().multiply(BigDecimal.valueOf(cantidad));
            orden.agregarDetalle(new DetalleOrden(p.id(), p.nombre(), p.precio(), cantidad));
            subtotal = subtotal.add(linea);
            if (cupon != null && esDeCategoria(p, cupon.categoria())) conDescuento = conDescuento.add(linea);
        }

        BigDecimal descuento = BigDecimal.ZERO;
        if (cupon != null) {
            orden.setCupon(codigoCupon);
            descuento = conDescuento.multiply(BigDecimal.valueOf(cupon.porcentaje())).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        }
        orden.setDescuento(descuento);
        orden.setTotal(subtotal.subtract(descuento).setScale(2, RoundingMode.HALF_UP));
        return orden;
    }

    // Compara nombres de categoría sin distinguir mayúsculas ni tildes (como catálogo)
    private static boolean esDeCategoria(CatalogoClient.Producto p, String categoria) {
        return sinTildes(p.categoria()).equalsIgnoreCase(sinTildes(categoria));
    }

    private static String sinTildes(String texto) {
        return Normalizer.normalize(texto == null ? "" : texto.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
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
