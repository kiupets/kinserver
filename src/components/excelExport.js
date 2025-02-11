const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const workbook = new ExcelJS.Workbook();

// Crear una hoja de debug al inicio
const debugSheet = workbook.addWorksheet('Debug Info');
debugSheet.columns = [
    { header: 'Reserva', key: 'reserva', width: 50 },
    { header: 'Información', key: 'info', width: 100 }
];

// Crear la hoja principal
const worksheet = workbook.addWorksheet('Reservaciones');

// Configurar columnas
worksheet.columns = [
    { header: 'Reserva', key: 'reserva', width: 50 },
    { header: 'Información', key: 'info', width: 100 }
];

// Procesar pagos
if (reserva.payments && Array.isArray(reserva.payments)) {
    // Agregar información detallada a la hoja de debug
    debugSheet.addRow({
        reserva: `RESERVA: ${reserva.name}`,
        info: `Fechas: ${moment(reserva.start).format('DD/MM/YYYY')} al ${moment(reserva.end).format('DD/MM/YYYY')}`
    });
    debugSheet.addRow({
        reserva: 'Período analizado:',
        info: `${monthStart.format('MM/YYYY')} al ${monthEnd.format('MM/YYYY')}`
    });

    console.log('\n----------------------------------------');
    console.log(`RESERVA: ${reserva.name}`);
    console.log(`Fechas: ${moment(reserva.start).format('DD/MM/YYYY')} al ${moment(reserva.end).format('DD/MM/YYYY')}`);
    console.log(`Mes procesado: ${monthStart.format('MM/YYYY')} al ${monthEnd.format('MM/YYYY')}`);
    console.log(`Total pagos en reserva: ${reserva.payments.length}`);
    console.log('----------------------------------------');

    let totalReserva = 0;
    reserva.payments.forEach((payment, index) => {
        if (payment.method && payment.amount) {
            debugSheet.addRow({
                reserva: `PAGO #${index + 1}`,
                info: `Monto: ${payment.amount} - Método: ${payment.method} - Fecha: ${moment(payment.date).format('DD/MM/YYYY HH:mm')}`
            });

            console.log(`\nPAGO #${index + 1}:`);
            console.log(`- Monto: ${payment.amount}`);
            console.log(`- Método: ${payment.method}`);
            console.log(`- Fecha raw: ${payment.date}`);

            const paymentDate = moment(payment.date);
            console.log(`- Fecha parseada: ${paymentDate.isValid() ? paymentDate.format('DD/MM/YYYY HH:mm') : 'FECHA INVÁLIDA'}`);

            const shouldCountPayment = paymentDate.isBetween(monthStart, monthEnd, 'month', '[]');
            console.log(`- ¿Contar en este mes?: ${shouldCountPayment}`);
            console.log(`  (Mes inicio: ${monthStart.format('DD/MM/YYYY')}, Mes fin: ${monthEnd.format('DD/MM/YYYY')})`);

            if (shouldCountPayment) {
                // Si el método es "pendiente", asegurar sumar solo una vez.
                if (payment.method === 'pendiente') {
                    if (!payment.__counted) { // Solo se suma si no se ha marcado
                        totals[payment.method] = (totals[payment.method] || 0) + payment.amount;
                        totals.total += payment.amount;
                        totalReserva += payment.amount;
                        // Marcar para evitar duplicación en próximas iteraciones
                        payment.__counted = true;
                        debugSheet.addRow({
                            reserva: '→ CONTABILIZADO - pendiente',
                            info: `Suma al método ${payment.method}: ${payment.amount} - Total del método hasta ahora: ${totals[payment.method]}`
                        });
                        console.log('  → PAGO PENDIENTE CONTABILIZADO ✓');
                    } else {
                        debugSheet.addRow({
                            reserva: '→ OMITIDO',
                            info: 'Pago pendiente ya contabilizado'
                        });
                        console.log('  → Pago pendiente ya contabilizado, se omite');
                    }
                } else {
                    // Para pagos que no sean "pendiente", sumar normalmente.
                    totals[payment.method] = (totals[payment.method] || 0) + payment.amount;
                    totals.total += payment.amount;
                    totalReserva += payment.amount;
                    debugSheet.addRow({
                        reserva: '→ CONTABILIZADO',
                        info: `Suma al método ${payment.method}: ${payment.amount} - Total del método hasta ahora: ${totals[payment.method]}`
                    });
                    console.log('  → PAGO CONTABILIZADO ✓');
                }
            } else {
                debugSheet.addRow({
                    reserva: '→ NO CONTABILIZADO',
                    info: 'Pago fuera del período'
                });
                console.log('  → PAGO NO CONTABILIZADO ✗');
            }
        }
    });

    debugSheet.addRow({
        reserva: 'TOTAL RESERVA',
        info: `${totalReserva}`
    });
    debugSheet.addRow({
        reserva: '----------------------------------------',
        info: ''
    });

    console.log('\nTOTALES ACTUALIZADOS:');
    console.log(JSON.stringify(totals, null, 2));
    console.log('----------------------------------------\n');
} 