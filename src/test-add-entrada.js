// Simple script to add a test entrada with metodoPago EFECTIVO
require('dotenv').config();
const mongoose = require('mongoose');
const Ganancias = require('./models/Ganancias');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('Connected to MongoDB');
    
    try {
        // Get the current month and year
        const now = new Date();
        const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
        const currentYear = now.getFullYear().toString();
        
        console.log(`Adding test entrada for Month: ${currentMonth}, Year: ${currentYear}`);
        
        // Find the record for the current month and year
        let record = await Ganancias.findOne({
            month: currentMonth,
            year: currentYear
        });
        
        if (!record) {
            console.log('No record found for current month and year. Creating a new one.');
            record = new Ganancias({
                month: currentMonth,
                year: currentYear,
                userId: '619e7c95b5f89f001ceb0b6e', // Use a valid userId from your database
                cajaAnterior: 0,
                ingresos: [],
                gastosOrdinarios: [],
                gastosExtraordinarios: [],
                entradas: [],
            });
        }
        
        // Add a test entrada with metodoPago EFECTIVO
        const testEntrada = {
            concepto: 'Test Entrada Efectivo',
            monto: 1000000, // 1,000,000
            tipo: 'GERENCIA',
            metodoPago: 'EFECTIVO',
            fecha: new Date(),
        };
        
        if (!Array.isArray(record.entradas)) {
            record.entradas = [];
        }
        
        record.entradas.push(testEntrada);
        
        // Save the record
        await record.save();
        
        console.log('Test entrada added successfully');
        console.log('New entradas array:', JSON.stringify(record.entradas, null, 2));
        
    } catch (err) {
        console.error('Error adding test entrada:', err);
    } finally {
        mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}).catch(err => {
    console.error('MongoDB connection error:', err);
}); 