const Ganancias = require('../models/Ganancias');
const express = require('express');
const router = express.Router();
const calcularOcupacionMensual = require('../utils/occupancyCalculator');

router.post('/save-ganancias/:userId', async (req, res) => {
    try {
        const {
            ingresos,
            gastosOrdinarios,
            gastosExtraordinarios,
            entradas,
            occupancyRate,
            month,
            year
        } = req.body;
        const { userId } = req.params;

        // Calcular mes y año anterior
        let mesAnterior = parseInt(month) - 1;
        let añoAnterior = parseInt(year);
        if (mesAnterior === 0) {
            mesAnterior = 12;
            añoAnterior--;
        }
        mesAnterior = mesAnterior.toString().padStart(2, '0');

        // Buscar registro del mes anterior para obtener el saldo final
        const registroAnterior = await Ganancias.findOne({
            userId,
            month: mesAnterior,
            year: añoAnterior
        });

        // Calcular saldo final del mes anterior
        let cajaAnterior = 0;
        if (registroAnterior) {
            const ingresosEfectivoAnterior = registroAnterior.ingresos
                .find(i => i.subcategoria === 'Efectivo')?.monto || 0;

            const gastosEfectivoAnterior = registroAnterior.gastosOrdinarios
                .filter(g => g.metodoPago === 'EFECTIVO')
                .reduce((sum, g) => sum + (g.monto || 0), 0);
                
            const entradasEfectivoAnterior = Array.isArray(registroAnterior.entradas) ? 
                registroAnterior.entradas
                    .filter(entrada => entrada.metodoPago === 'EFECTIVO')
                    .reduce((sum, entrada) => sum + (Number(entrada.monto) || 0), 0) : 0;

            cajaAnterior = registroAnterior.cajaAnterior + ingresosEfectivoAnterior + entradasEfectivoAnterior - gastosEfectivoAnterior;
        }

        // Buscar si ya existe un registro para ese mes y año
        let ganancias = await Ganancias.findOne({
            userId,
            month,
            year
        });

        if (ganancias) {
            // Actualizar registro existente
            ganancias.ingresos = ingresos;
            ganancias.gastosOrdinarios = gastosOrdinarios;
            ganancias.gastosExtraordinarios = gastosExtraordinarios.map(gasto => ({
                ...gasto,
                metodoPago: 'TARJETA'
            }));
            ganancias.entradas = entradas || [];
            ganancias.occupancyRate = occupancyRate;
            ganancias.cajaAnterior = cajaAnterior;
            await ganancias.save();
        } else {
            // Modify gastosExtraordinarios before creating new record
            const processedGastosExtraordinarios = gastosExtraordinarios.map(gasto => ({
                ...gasto,
                metodoPago: 'TARJETA'
            }));
            
            // Crear nuevo registro
            ganancias = new Ganancias({
                userId,
                month,
                year,
                ingresos,
                gastosOrdinarios,
                gastosExtraordinarios: processedGastosExtraordinarios,
                entradas: entradas || [],
                occupancyRate,
                cajaAnterior
            });
            await ganancias.save();
        }

        res.json({
            message: 'Datos guardados exitosamente',
            data: ganancias
        });

    } catch (error) {
        console.error('Error al guardar ganancias:', error);
        res.status(400).json({
            message: 'Error al guardar los datos',
            error: error.message
        });
    }
});

router.post('/save-ganancias', async (req, res) => {
    try {
        const { gastosOrdinarios } = req.body;
        console.log('Gastos Ordinarios recibidos:', gastosOrdinarios);
        // ... resto del código
    } catch (error) {
        // ... manejo de error
    }
});

// Endpoint para obtener estadísticas de ocupación
router.get('/ocupacion', async (req, res) => {
    try {
        const { month, year, userId } = req.query;

        if (!month || !year || !userId) {
            return res.status(400).json({ message: 'Se requiere mes, año y userId' });
        }

        console.log('Solicitando estadísticas de ocupación:', { month, year, userId });

        // Validar que month y year sean números válidos
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);

        if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
            return res.status(400).json({ message: 'Mes inválido' });
        }

        if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
            return res.status(400).json({ message: 'Año inválido' });
        }

        const estadisticas = await calcularOcupacionMensual(month, year, userId);
        console.log('Estadísticas calculadas:', estadisticas);

        res.json(estadisticas);

    } catch (error) {
        console.error('Error al obtener estadísticas de ocupación:', error);
        res.status(500).json({
            message: 'Error al obtener estadísticas de ocupación',
            error: error.message
        });
    }
});

module.exports = router; 