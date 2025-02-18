const saveGanancias = async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            ingresos,
            gastosOrdinarios,
            gastosExtraordinarios,
            entradas,
            occupancyRate,
            month,
            year,
            cajaAnterior
        } = req.body;

        console.log('Datos recibidos:', {
            gastosOrdinarios,
            gastosExtraordinarios,
            entradas,
            cajaAnterior
        });

        const ganancias = await Ganancias.findOneAndUpdate(
            {
                userId,
                month,
                year
            },
            {
                $set: {
                    fecha: new Date(year, parseInt(month) - 1),
                    ingresos,
                    entradas: entradas.map(entrada => ({
                        concepto: entrada.concepto,
                        monto: parseFloat(entrada.monto) || 0,
                        metodoPago: entrada.metodoPago || 'EFECTIVO',
                        fecha: entrada.fecha || new Date(),
                        descripcion: entrada.descripcion
                    })),
                    gastosOrdinarios: gastosOrdinarios.map(gasto => ({
                        tipo: gasto.tipo,
                        concepto: gasto.concepto,
                        monto: gasto.monto,
                        metodoPago: gasto.metodoPago || 'EFECTIVO'
                    })),
                    gastosExtraordinarios: gastosExtraordinarios.map(gasto => ({
                        tipo: gasto.tipo,
                        concepto: gasto.concepto,
                        monto: gasto.monto,
                        metodoPago: gasto.metodoPago || 'EFECTIVO'
                    })),
                    occupancyRate,
                    cajaAnterior: parseFloat(cajaAnterior) || 0,
                    userId
                }
            },
            {
                new: true,
                upsert: true
            }
        );

        res.json({
            message: "Datos guardados exitosamente",
            data: ganancias
        });
    } catch (error) {
        console.error('Error al guardar ganancias:', error);
        res.status(500).json({
            message: "Error al guardar los datos",
            error: error.message
        });
    }
}; 