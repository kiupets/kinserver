const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const moment = require('moment');
const Reservation = require('../models/Reservation');

router.get('/export-detailed', async (req, res) => {
    try {
        const { userId, startDate, endDate } = req.query;

        // Query similar a Billing
        const dateQuery = {
            user: userId,
            start: {
                $gte: moment(startDate).startOf('month').toDate(),
                $lte: moment(endDate).endOf('month').toDate()
            }
        };

        const reservations = await Reservation.find(dateQuery)
            .sort({ start: 1 })
            .lean();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reservaciones');

        // Columnas del Excel
        worksheet.columns = [
            { header: 'Fecha', key: 'date', width: 12 },
            { header: 'Nombre', key: 'name', width: 20 },
            { header: 'Apellido', key: 'surname', width: 20 },
            { header: 'Habitación', key: 'room', width: 12 },
            { header: 'Tipo', key: 'roomType', width: 15 },
            { header: 'Check-in', key: 'checkIn', width: 12 },
            { header: 'Check-out', key: 'checkOut', width: 12 },
            { header: 'Noches', key: 'nights', width: 10 },
            { header: 'Huéspedes', key: 'guests', width: 12 },
            { header: 'Total', key: 'total', width: 15 },
            { header: 'Efectivo', key: 'efectivo', width: 15 },
            { header: 'Tarjeta', key: 'tarjeta', width: 15 },
            { header: 'Transferencia', key: 'transferencia', width: 15 },
            { header: 'Estado Pago', key: 'paymentStatus', width: 20 },
            { header: 'Estado Hab.', key: 'roomStatus', width: 15 },
            { header: 'Recepcionista', key: 'receptionist', width: 20 },
            { header: 'Comentarios', key: 'comments', width: 30 }
        ];

        // Estilos de encabezado
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4167B1' }
        };

        // Formato de moneda
        ['total', 'efectivo', 'tarjeta', 'transferencia'].forEach(col => {
            worksheet.getColumn(col).numFmt = '"$"#,##0.00';
        });

        let totales = {
            efectivo: 0,
            tarjeta: 0,
            transferencia: 0,
            total: 0,
            transacciones: {
                efectivo: 0,
                tarjeta: 0,
                transferencia: 0
            }
        };

        // Procesar cada reservación - usando la lógica de paymentTotals.js
        reservations.forEach(reservation => {
            let method = 'efectivo'; // valor por defecto
            const amount = reservation.adelanto || reservation.precioTotal || 0;

            // Determinar método de pago usando la misma lógica que paymentTotals
            if (reservation.billingStatus === 'pagado_efectivo' || reservation.paymentMethod === 'efectivo') {
                method = 'efectivo';
            } else if (reservation.billingStatus === 'pagado_tarjeta' || reservation.paymentMethod === 'tarjeta') {
                method = 'tarjeta';
            } else if (reservation.billingStatus === 'pagado_transferencia' || reservation.paymentMethod === 'transferencia') {
                method = 'transferencia';
            }

            // Crear objeto para la fila
            const row = {
                date: moment(reservation.time).format('DD/MM/YYYY'),
                name: reservation.name || '',
                surname: reservation.surname || '',
                room: Array.isArray(reservation.room) ? reservation.room.join(', ') : reservation.room || '',
                roomType: reservation.roomType || '',
                checkIn: moment(reservation.start).format('DD/MM/YYYY'),
                checkOut: moment(reservation.end).format('DD/MM/YYYY'),
                nights: reservation.nights || 0,
                guests: reservation.numberOfGuests || 0,
                total: amount,
                efectivo: method === 'efectivo' ? amount : 0,
                tarjeta: method === 'tarjeta' ? amount : 0,
                transferencia: method === 'transferencia' ? amount : 0,
                paymentStatus: reservation.billingStatus || '',
                roomStatus: reservation.housekeepingStatus || '',
                receptionist: reservation.nombre_recepcionista || '',
                comments: reservation.comments || ''
            };

            worksheet.addRow(row);

            // Actualizar totales
            totales[method] += amount;
            totales.total += amount;
            totales.transacciones[method]++;
        });

        // Calcular porcentajes
        const porcentajes = {
            efectivo: totales.total > 0 ? (totales.efectivo / totales.total * 100).toFixed(2) : 0,
            tarjeta: totales.total > 0 ? (totales.tarjeta / totales.total * 100).toFixed(2) : 0,
            transferencia: totales.total > 0 ? (totales.transferencia / totales.total * 100).toFixed(2) : 0
        };

        // Agregar resumen
        worksheet.addRow({});
        worksheet.addRow({
            name: 'RESUMEN DE TRANSACCIONES Y PORCENTAJES',
            efectivo: `${totales.transacciones.efectivo} trans. (${porcentajes.efectivo}%)`,
            tarjeta: `${totales.transacciones.tarjeta} trans. (${porcentajes.tarjeta}%)`,
            transferencia: `${totales.transacciones.transferencia} trans. (${porcentajes.transferencia}%)`
        });

        // Agregar totales
        worksheet.addRow({});
        const totalRow = worksheet.addRow({
            name: 'TOTALES',
            total: totales.total,
            efectivo: totales.efectivo,
            tarjeta: totales.tarjeta,
            transferencia: totales.transferencia
        });

        // Estilo para totales
        totalRow.font = { bold: true };
        totalRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6E6E6' }
        };

        // Agregar estadísticas adicionales
        worksheet.addRow({});
        worksheet.addRow({
            name: 'ESTADÍSTICAS ADICIONALES',
            total: `Promedio por reserva: $${(totales.total / reservations.length || 0).toFixed(2)}`,
            efectivo: `Total reservas: ${reservations.length}`
        });

        // Bordes para todas las celdas
        worksheet.eachRow((row) => {
            row.eachCell({ includeEmpty: true }, cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();

        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename=reporte-reservas-${moment().format('YYYYMMDD')}.xlsx`,
            'Content-Length': buffer.length
        });

        res.send(buffer);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            message: "Error generando Excel",
            error: error.message
        });
    }
});

module.exports = router;