// updateInsumos.js
const mongoose = require('mongoose');
const Ganancias = require('./src/models/Ganancias');

async function updateInsumos() {
    try {
        // Los insumos que faltan
        const insumosData = [
            { tipo: "INSUMOS DESAYUNO", concepto: "Viejo almacen", monto: 112000 },
            { tipo: "INSUMOS LIMPIEZA", concepto: "superlimp", monto: 65000 }
        ];

        // Convertir userId a ObjectId
        const userId = new mongoose.Types.ObjectId("65d62a555fcb84dd438ce091");

        // Buscar el documento actual
        const result = await Ganancias.findOneAndUpdate(
            {
                userId,
                year: 2024,
                month: "11"
            },
            {
                $push: {
                    gastosOrdinarios: {
                        $each: insumosData
                    }
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        console.log('Insumos actualizados exitosamente:', result);
        return result;

    } catch (error) {
        console.error('Error al actualizar insumos:', error);
        throw error;
    }
}

async function runUpdate() {
    try {
        await mongoose.connect('mongodb+srv://kiupets:julietaygonzalo2023@cluster0.cpgytzo.mongodb.net/db-name?retryWrites=true&w=majority', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        await updateInsumos();
        console.log('Actualización completada exitosamente');

        await mongoose.connection.close();

    } catch (error) {
        console.error('Error durante la actualización:', error);
        process.exit(1);
    }
}

// Si estás usando variables de entorno
require('dotenv').config();

runUpdate();