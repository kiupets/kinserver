// updateExtraordinaryExpenses.js
const mongoose = require('mongoose');
const Ganancias = require('./src/models/Ganancias');

async function updateExtraordinaryExpenses() {
    try {
        // Gastos extraordinarios faltantes del documento original
        const missingExpenses = [
            { concepto: "sabanas matri 5/6", monto: 8000, categoria: "Habitaciones" },
            { concepto: "acolchado matri 4/6", monto: 24000, categoria: "Habitaciones" },
            { concepto: "acolchado 1pl x 4/6", monto: 10000, categoria: "Habitaciones" },
            { concepto: "HIDRO 3/3", monto: 26000, categoria: "Mantenimiento" },
            { concepto: "HEDREON 3/6", monto: 18500, categoria: "Habitaciones" },
            { concepto: "televisor 2/12 cuotas", monto: 27500, categoria: "Equipamiento" },
            { concepto: "shampoo", monto: 44000, categoria: "Insumos" },
            { concepto: "termo agua cailente  1/6", monto: 10000, categoria: "Equipamiento" },
            { concepto: "mermelada", monto: 54720, categoria: "Insumos" },
            { concepto: "tv 1/9", monto: 32000, categoria: "Equipamiento" },
            { concepto: "memoria kingstone", monto: 39000, categoria: "Equipamiento" },
            { concepto: "fundas x 20", monto: 52000, categoria: "Habitaciones" },
            { concepto: "colchon", monto: 153500, categoria: "Habitaciones" },
            { concepto: "ventilador 2/3", monto: 32000, categoria: "Equipamiento" }
        ];

        // Buscar el documento de noviembre y actualizar
        const result = await Ganancias.findOneAndUpdate(
            {
                userId: "65d62a555fcb84dd438ce091",
                year: 2023,
                month: "11"
            },
            {
                $push: {
                    gastosExtraordinarios: {
                        $each: missingExpenses
                    }
                }
            },
            { new: true }
        );

        console.log('Gastos extraordinarios actualizados exitosamente:', result);
        return result;

    } catch (error) {
        console.error('Error al actualizar gastos extraordinarios:', error);
        throw error;
    }
}

async function runUpdate() {
    try {
        await mongoose.connect('mongodb+srv://kiupets:julietaygonzalo2023@cluster0.cpgytzo.mongodb.net/db-name?retryWrites=true&w=majority', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        await updateExtraordinaryExpenses();
        console.log('Actualización completada exitosamente');

        await mongoose.connection.close();

    } catch (error) {
        console.error('Error durante la actualización:', error);
        process.exit(1);
    }
}

runUpdate();