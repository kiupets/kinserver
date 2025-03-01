// Simple script to check the database for entradas data
require('dotenv').config();
const mongoose = require('mongoose');
const Ganancias = require('./models/Ganancias');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
    
    // Get the current month and year
    const now = new Date();
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentYear = now.getFullYear().toString();
    
    // Find all ganancias records
    Ganancias.find({})
        .then(records => {
            console.log(`Found ${records.length} ganancias records`);
            
            records.forEach(record => {
                console.log(`Record for Month: ${record.month}, Year: ${record.year}`);
                console.log('Entradas:', JSON.stringify(record.entradas, null, 2));
                
                // Calculate and log entradasEfectivo
                const entradasEfectivo = Array.isArray(record.entradas) ? 
                    record.entradas
                        .filter(entrada => entrada.metodoPago === 'EFECTIVO')
                        .reduce((sum, entrada) => sum + (Number(entrada.monto) || 0), 0) : 0;
                
                console.log('entradasEfectivo calculated:', entradasEfectivo);
                console.log('entradasEfectivo in caja:', record.caja.entradasEfectivo);
                console.log('----------------------------------------------------');
            });
        })
        .catch(err => {
            console.error('Error finding records:', err);
        })
        .finally(() => {
            mongoose.disconnect();
            console.log('Disconnected from MongoDB');
        });
}).catch(err => {
    console.error('MongoDB connection error:', err);
}); 