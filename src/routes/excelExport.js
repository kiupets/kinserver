const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const moment = require('moment');
const Reservation = require('../models/Reservation');

router.get('/export-detailed', async (req, res) => {
    try {
        const { userId, startDate, endDate } = req.query;
        console.log('Generating report for dates:', { startDate, endDate });

        // Query alineada con Billing
        const dateQuery = {
            user: userId,
            $expr: {
                $and: [
                    // Mes de la fecha de inicio de la reserva debe estar en el rango seleccionado
                    {
                        $gte: [
                            { $month: "$start" },
                            parseInt(moment(startDate).format('M'))
                        ]
                    },
                    {
                        $lte: [
                            { $month: "$start" },
                            parseInt(moment(endDate).format('M'))
                        ]
                    },
                    // Año de la fecha de inicio debe coincidir
                    {
                        $eq: [
                            { $year: "$start" },
                            parseInt(moment(startDate).format('YYYY'))
                        ]
                    }
                ]
            }
        };

        console.log('Query:', JSON.stringify(dateQuery, null, 2));

        const reservations = await Reservation.find(dateQuery)
            .sort({ start: 1 })
            .lean();

        console.log(`Found ${reservations.length} reservations`);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reservaciones');

        worksheet.columns = [
            { header: 'Fecha Reserva', key: 'fechaReserva', width: 20 },
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
            { header: 'Pendiente', key: 'pending', width: 15 },
            { header: 'Estado Pago', key: 'paymentStatus', width: 20 },
            { header: 'Estado Hab.', key: 'roomStatus', width: 15 },
            { header: 'Recepcionista', key: 'receptionist', width: 20 },
            { header: 'Comentarios', key: 'comments', width: 30 }
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4167B1' }
        };

        ['total', 'efectivo', 'tarjeta', 'transferencia', 'pending'].forEach(col => {
            worksheet.getColumn(col).numFmt = '"$"#,##0.00';
        });

        let totales = {
            noches: 0,
            huespedes: 0,
            total: 0,
            efectivo: 0,
            tarjeta: 0,
            transferencia: 0,
            pendiente: 0
        };

        // Procesar reservaciones
        reservations.forEach(reservation => {
            const precioTotal = reservation.precioTotal || 0;
            let montos = {
                efectivo: 0,
                tarjeta: 0,
                transferencia: 0
            };

            // Procesar pagos usando la misma lógica que Billing
            if (Array.isArray(reservation.payments)) {
                reservation.payments.forEach(payment => {
                    if (payment.method && payment.amount) {
                        montos[payment.method] += Number(payment.amount);
                    }
                });
            }

            const totalPagado = Object.values(montos).reduce((sum, amount) => sum + amount, 0);
            const pendiente = precioTotal - totalPagado;

            const row = {
                fechaReserva: moment(reservation.time || reservation.createdAt).toDate(),
                name: reservation.name || '',
                surname: reservation.surname || '',
                room: Array.isArray(reservation.room) ? reservation.room.join(', ') : reservation.room || '',
                roomType: reservation.roomType || '',
                checkIn: moment(reservation.start).toDate(),
                checkOut: moment(reservation.end).toDate(),
                nights: reservation.nights || 0,
                guests: reservation.numberOfGuests || 0,
                total: precioTotal,
                efectivo: montos.efectivo,
                tarjeta: montos.tarjeta,
                transferencia: montos.transferencia,
                pending: pendiente,
                paymentStatus: mapPaymentStatus(reservation.billingStatus),
                roomStatus: mapRoomStatus(reservation.housekeepingStatus),
                receptionist: reservation.nombre_recepcionista || '',
                comments: reservation.comments || ''
            };

            worksheet.addRow(row);

            // Actualizar totales
            totales.noches += row.nights;
            totales.huespedes += row.guests;
            totales.total += precioTotal;
            totales.efectivo += montos.efectivo;
            totales.tarjeta += montos.tarjeta;
            totales.transferencia += montos.transferencia;
            totales.pendiente += pendiente;
        });

        // Agregar fila de totales
        worksheet.addRow({});
        const totalRow = worksheet.addRow({
            name: 'TOTALES',
            nights: totales.noches,
            guests: totales.huespedes,
            total: totales.total,
            efectivo: totales.efectivo,
            tarjeta: totales.tarjeta,
            transferencia: totales.transferencia,
            pending: totales.pendiente
        });

        totalRow.font = { bold: true };
        totalRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6E6E6' }
        };

        // Aplicar bordes
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

function mapPaymentStatus(status) {
    const statuses = {
        'pendiente': 'Pendiente',
        'pagado': 'Pagado',
        'pagado_efectivo': 'Pagado (Efectivo)',
        'pagado_tarjeta': 'Pagado (Tarjeta)',
        'pagado_transferencia': 'Pagado (Transferencia)'
    };
    return statuses[status] || status;
}

function mapRoomStatus(status) {
    const statuses = {
        'limpio': 'Limpio',
        'sucio': 'Sucio',
        'mantenimiento': 'Mantenimiento',
        'pendiente': 'Pendiente'
    };
    return statuses[status] || status;
}

module.exports = router;