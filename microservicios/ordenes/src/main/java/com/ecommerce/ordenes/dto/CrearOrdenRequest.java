package com.ecommerce.ordenes.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

// Lo que manda la pasarela de pagos al confirmar una compra aprobada.
// Solo productos y cantidades: nombres y precios se toman del catálogo.
public record CrearOrdenRequest(
        @NotEmpty(message = "La orden debe tener al menos un producto")
        List<@Valid Linea> productos,

        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 80) @Pattern(regexp = "^[\\p{L} ]+$", message = "El nombre solo admite letras")
        String clienteNombre,

        @NotBlank(message = "El teléfono es obligatorio")
        @Pattern(regexp = "^\\d{7,15}$", message = "El teléfono debe tener entre 7 y 15 dígitos")
        String telefono,

        @NotBlank(message = "La dirección es obligatoria")
        @Size(max = 150) @Pattern(regexp = "^[\\p{L}0-9 _/-]+$", message = "La dirección solo admite letras, números, espacios y - _ /")
        String direccion,

        @NotBlank(message = "La ciudad es obligatoria")
        @Size(max = 60) @Pattern(regexp = "^[\\p{L} ]+$", message = "La ciudad solo admite letras")
        String ciudad,

        @Pattern(regexp = "^\\d{4}$", message = "Los últimos 4 dígitos de la tarjeta no son válidos")
        String tarjetaUltimos4,

        @Size(max = 20)
        String cupon
) {
    public record Linea(
            @NotBlank(message = "Falta el producto")
            String productoId,

            @NotNull(message = "Falta la cantidad")
            @Min(value = 1, message = "La cantidad debe ser al menos 1")
            @Max(value = 99, message = "La cantidad máxima por producto es 99")
            Integer cantidad
    ) {}
}
