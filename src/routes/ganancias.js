const Ganancias = require('../models/Ganancias');

router.post('/save-ganancias/:userId', async (req, res) => {
    try {
        const {
            ingresos,
            gastosOrdinarios,
            gastosExtraordinarios,
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

            cajaAnterior = registroAnterior.cajaAnterior + ingresosEfectivoAnterior - gastosEfectivoAnterior;
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
            ganancias.gastosExtraordinarios = gastosExtraordinarios;
            ganancias.occupancyRate = occupancyRate;
            ganancias.cajaAnterior = cajaAnterior;
            await ganancias.save();
        } else {
            // Crear nuevo registro
            ganancias = new Ganancias({
                userId,
                month,
                year,
                ingresos,
                gastosOrdinarios,
                gastosExtraordinarios,
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