const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const moment = require('moment');
const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');

router.get('/export-detailed', async (req, res) => {
    try {
        const { userId, startDate, endDate } = req.query;
        const TOTAL_ROOMS = 15; // Número fijo de habitaciones

        const monthStart = moment(startDate).startOf('month');
        const monthEnd = moment(endDate).endOf('month');

        const query = {
            user: new mongoose.Types.ObjectId(userId),
            $or: [
                {
                    end: { $gte: monthStart.toDate() },
                    start: { $lte: monthEnd.toDate() }
                }
            ]
        };

        const reservations = await Reservation.find(query).sort({ start: 1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reservaciones');
        const statsWorksheet = workbook.addWorksheet('Estadísticas');
        const paymentsStatsWorksheet = workbook.addWorksheet('Análisis de Pagos');

        // Configurar columnas
        worksheet.columns = [
            { header: 'Fecha', key: 'fecha', width: 12 },
            { header: 'Nombre', key: 'nombre', width: 20 },
            { header: 'Apellido', key: 'apellido', width: 20 },
            { header: 'Habitación', key: 'habitacion', width: 10 },
            { header: 'Tipo', key: 'tipo', width: 15 },
            { header: 'Check-in', key: 'checkin', width: 12 },
            { header: 'Check-out', key: 'checkout', width: 12 },
            { header: 'Noches Totales', key: 'nochesTotales', width: 10 },
            { header: 'Noches en Mes', key: 'nochesEnMes', width: 10 },
            { header: 'Huéspedes', key: 'huespedes', width: 10 },
            { header: 'Total de Pagos', key: 'total', width: 15 },
            { header: 'Pago por Noche', key: 'pagoPorNoche', width: 15 },
            { header: 'Efectivo', key: 'efectivo', width: 15 },
            { header: 'Tarjeta', key: 'tarjeta', width: 15 },
            { header: 'Transferencia', key: 'transferencia', width: 15 },
            { header: 'Pendiente', key: 'pendiente', width: 15 },
            { header: 'Métodos de Pago', key: 'metodosPago', width: 20 },
            { header: 'Recepcionista', key: 'recepcionista', width: 20 }
        ];

        // Estilo para el encabezado
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4167B1' }
        };
        headerRow.eachCell(cell => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        const daysInMonth = monthEnd.diff(monthStart, 'days') + 1;
        const totalPossibleRoomDays = TOTAL_ROOMS * daysInMonth;

        let statsData = {
            totalReservations: 0,
            totalNights: 0,
            totalGuests: 0,
            roomStats: {},
            paymentMethodStats: {
                efectivo: 0,
                tarjeta: 0,
                transferencia: 0,
                total: 0,
                pendiente: 0,
                mixedPayments: 0
            },
            avgNightlyRate: 0,
            totalNightlyRates: 0,
            crossMonthReservations: 0,
            roomTypeStats: {},
            receptionistStats: {}
        };

        // Procesar reservaciones
        reservations.forEach(reservation => {
            const startDate = moment(reservation.start);
            const endDate = moment(reservation.end);
            const effectiveStart = moment.max(startDate, monthStart);
            const effectiveEnd = moment.min(endDate, monthEnd);
            const nightsInMonth = effectiveEnd.diff(effectiveStart, 'days');
            const totalNights = reservation.nights || 0; // Usar nights directamente de la reservación
            const crossesMonths = startDate.month() !== endDate.month();

            if (crossesMonths) {
                statsData.crossMonthReservations++;
            }

            if (nightsInMonth > 0) {
                // Actualizar noches totales
                statsData.totalNights += totalNights;

                const proportionFactor = nightsInMonth / totalNights;
                const payments = reservation.payments || [];
                const totals = {
                    efectivo: 0,
                    tarjeta: 0,
                    transferencia: 0,
                    total: 0
                };

                const recepcionistas = new Set();
                const metodosPago = new Set();

                // Procesar pagos
                payments.forEach(payment => {
                    if (payment.method && payment.amount) {
                        const proportionalAmount = payment.amount * proportionFactor;
                        totals[payment.method] += proportionalAmount;
                        totals.total += proportionalAmount;
                        metodosPago.add(payment.method);
                        if (payment.recepcionista) {
                            recepcionistas.add(payment.recepcionista);
                        }
                    }
                });

                const montoPendiente = reservation.montoPendiente || 0;
                const pagoPorNoche = nightsInMonth > 0 ? totals.total / nightsInMonth : 0;

                // Actualizar estadísticas
                statsData.totalReservations++;
                statsData.totalGuests += reservation.numberOfGuests || 0;
                statsData.totalNightlyRates += pagoPorNoche;
                statsData.paymentMethodStats.pendiente += montoPendiente;

                if (metodosPago.size > 1) {
                    statsData.paymentMethodStats.mixedPayments++;
                }

                // Actualizar estadísticas por tipo de habitación
                const roomType = reservation.roomType || 'No especificado';
                if (!statsData.roomTypeStats[roomType]) {
                    statsData.roomTypeStats[roomType] = {
                        count: 0,
                        revenue: 0,
                        nights: 0,
                        pendiente: 0
                    };
                }
                statsData.roomTypeStats[roomType].count++;
                statsData.roomTypeStats[roomType].revenue += totals.total;
                statsData.roomTypeStats[roomType].nights += nightsInMonth;
                statsData.roomTypeStats[roomType].pendiente += montoPendiente;

                // Actualizar estadísticas por recepcionista
                recepcionistas.forEach(receptionist => {
                    if (!statsData.receptionistStats[receptionist]) {
                        statsData.receptionistStats[receptionist] = {
                            reservations: 0,
                            revenue: 0,
                            payments: {
                                efectivo: 0,
                                tarjeta: 0,
                                transferencia: 0,
                                pendiente: 0
                            }
                        };
                    }
                    const stats = statsData.receptionistStats[receptionist];
                    stats.reservations++;
                    stats.revenue += totals.total;
                    Object.keys(totals).forEach(method => {
                        if (method !== 'total') {
                            stats.payments[method] += totals[method];
                        }
                    });
                    stats.payments.pendiente += montoPendiente;
                });

                // Actualizar estadísticas de pagos
                Object.keys(totals).forEach(method => {
                    if (method !== 'total') {
                        statsData.paymentMethodStats[method] += totals[method];
                    }
                });
                statsData.paymentMethodStats.total += totals.total;

                // Agregar fila al Excel
                const row = worksheet.addRow({
                    fecha: startDate.format('DD/MM/YYYY'),
                    nombre: reservation.name,
                    apellido: reservation.surname,
                    habitacion: Array.isArray(reservation.room) ? reservation.room.join(', ') : reservation.room,
                    tipo: reservation.roomType,
                    checkin: startDate.format('DD/MM/YYYY'),
                    checkout: endDate.format('DD/MM/YYYY'),
                    nochesTotales: totalNights,
                    nochesEnMes: nightsInMonth,
                    huespedes: reservation.numberOfGuests,
                    total: totals.total,
                    pagoPorNoche: pagoPorNoche,
                    efectivo: totals.efectivo,
                    tarjeta: totals.tarjeta,
                    transferencia: totals.transferencia,
                    pendiente: montoPendiente,
                    metodosPago: Array.from(metodosPago).join(', '),
                    recepcionista: Array.from(recepcionistas).join(', ')
                });

                // Aplicar formato de moneda
                ['total', 'pagoPorNoche', 'efectivo', 'tarjeta', 'transferencia', 'pendiente'].forEach(col => {
                    const cell = row.getCell(col);
                    if (cell.value) {
                        cell.numFmt = '"$"#,##0.00';
                    }
                });

                // Si hay un pendiente, resaltar la celda
                if (montoPendiente > 0) {
                    row.getCell('pendiente').fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFF9E9E' }
                    };
                }

                // Aplicar estilo según condiciones
                if (metodosPago.size > 1) {
                    row.eachCell({ includeEmpty: true }, cell => {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFF9800' }
                        };
                    });
                } else if (crossesMonths) {
                    row.eachCell({ includeEmpty: true }, cell => {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFE0B2' }
                        };
                    });
                }

                // Aplicar bordes
                row.eachCell({ includeEmpty: true }, cell => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            }
        });

        // Calcular promedio de pago por noche y porcentaje de ocupación
        statsData.avgNightlyRate = statsData.totalReservations > 0 ?
            statsData.totalNightlyRates / statsData.totalReservations : 0;

        const occupancyRate = (statsData.totalNights / totalPossibleRoomDays) * 100;

        // Configurar hoja de estadísticas con nuevas métricas de ocupación
        const stats = [
            ['Estadísticas Generales', ''],
            ['Total Reservaciones', statsData.totalReservations],
            ['Total Noches', statsData.totalNights],
            ['Total Huéspedes', statsData.totalGuests],
            ['Número de Habitaciones', TOTAL_ROOMS],
            ['Porcentaje de Ocupación', `${occupancyRate.toFixed(2)}%`],
            ['Días en el Mes', daysInMonth],
            ['Noches Totales Ocupadas', statsData.totalNights],
            ['Noches Totales Disponibles', totalPossibleRoomDays],
            ['Reservas que Cruzan Meses', statsData.crossMonthReservations],
            ['Reservas con Pagos Mixtos', statsData.paymentMethodStats.mixedPayments],
            ['Promedio Noches por Reserva', (statsData.totalNights / statsData.totalReservations).toFixed(2)],
            ['Promedio Pago por Noche', statsData.avgNightlyRate],
            ['', ''],
            ['Estadísticas de Pagos', ''],
            ['Ingreso Total', statsData.paymentMethodStats.total],
            ['Efectivo Total', statsData.paymentMethodStats.efectivo],
            ['Tarjeta Total', statsData.paymentMethodStats.tarjeta],
            ['Transferencia Total', statsData.paymentMethodStats.transferencia],
            ['Pendiente Total', statsData.paymentMethodStats.pendiente],
            ['% Efectivo', ((statsData.paymentMethodStats.efectivo / statsData.paymentMethodStats.total) * 100).toFixed(2) + '%'],
            ['% Tarjeta', ((statsData.paymentMethodStats.tarjeta / statsData.paymentMethodStats.total) * 100).toFixed(2) + '%'],
            ['% Transferencia', ((statsData.paymentMethodStats.transferencia / statsData.paymentMethodStats.total) * 100).toFixed(2) + '%'],
            ['% Pendiente', ((statsData.paymentMethodStats.pendiente / (statsData.paymentMethodStats.total + statsData.paymentMethodStats.pendiente)) * 100).toFixed(2) + '%']
        ];

        stats.forEach(row => statsWorksheet.addRow(row));

        // Configurar hoja de análisis de pagos
        const paymentAnalysis = [
            ['Análisis por Recepcionista', '', '', '', '', '', ''],
            ['Recepcionista', 'Reservaciones', 'Total', 'Efectivo', 'Tarjeta', 'Transferencia', 'Pendiente']
        ];

        // Agregar datos de recepcionistas
        Object.entries(statsData.receptionistStats)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .forEach(([receptionist, stats]) => {
                paymentAnalysis.push([
                    receptionist,
                    stats.reservations,
                    stats.revenue,
                    stats.payments.efectivo,
                    stats.payments.tarjeta,
                    stats.payments.transferencia,
                    stats.payments.pendiente
                ]);
            });

        paymentAnalysis.forEach(row => paymentsStatsWorksheet.addRow(row));

        // Dar formato a la hoja de análisis de pagos
        paymentsStatsWorksheet.getColumn(1).width = 20;
        paymentsStatsWorksheet.getColumn(2).width = 15;
        paymentsStatsWorksheet.getColumn(3).width = 15;
        paymentsStatsWorksheet.getColumn(4).width = 15;
        paymentsStatsWorksheet.getColumn(5).width = 15;
        paymentsStatsWorksheet.getColumn(6).width = 15;
        paymentsStatsWorksheet.getColumn(7).width = 15;

        // Formato de moneda para columnas de pagos
        [3, 4, 5, 6, 7].forEach(col => {
            paymentsStatsWorksheet.getColumn(col).numFmt = '"$"#,##0.00';
        });

        // Estilo para encabezados en hoja de análisis
        const analysisHeaders = paymentsStatsWorksheet.getRow(2);
        analysisHeaders.font = { bold: true, color: { argb: 'FFFFFF' } };
        analysisHeaders.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4167B1' }
        };

        // Análisis por tipo de habitación
        paymentsStatsWorksheet.addRow([]);
        paymentsStatsWorksheet.addRow(['Análisis por Tipo de Habitación']);
        const roomTypeHeaderRow = paymentsStatsWorksheet.addRow([
            'Tipo',
            'Reservaciones',
            'Noches',
            'Ingresos',
            'Promedio por Noche',
            'Pendiente'
        ]);

        // Estilo para encabezado de tipos de habitación
        roomTypeHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        roomTypeHeaderRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4167B1' }
        };

        // Agregar datos por tipo de habitación
        Object.entries(statsData.roomTypeStats)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .forEach(([type, stats]) => {
                const avgPerNight = stats.nights > 0 ? stats.revenue / stats.nights : 0;
                paymentsStatsWorksheet.addRow([
                    type,
                    stats.count,
                    stats.nights,
                    stats.revenue,
                    avgPerNight,
                    stats.pendiente
                ]);
            });

        // Formato para la hoja de estadísticas
        statsWorksheet.getColumn(2).numFmt = '#,##0.00';
        statsWorksheet.getRow(1).font = { bold: true };

        // Añadir leyenda de colores
        worksheet.addRow([]);
        const legendRow = worksheet.addRow(['Leyenda:']);
        legendRow.font = { bold: true };

        const crossMonthRow = worksheet.addRow(['Reservas que cruzan meses']);
        crossMonthRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFE0B2' }
        };

        const multiplePaymentsRow = worksheet.addRow(['Pagos con múltiples métodos']);
        multiplePaymentsRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF9800' }
        };

        const pendingRow = worksheet.addRow(['Pagos pendientes']);
        pendingRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF9E9E' }
        };

        // Ajustar ancho de columnas en la hoja de estadísticas
        statsWorksheet.getColumn(1).width = 30;
        statsWorksheet.getColumn(2).width = 15;

        // Dar formato a las celdas de moneda en la hoja de estadísticas
        statsWorksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 9) { // Empezar después de las estadísticas generales
                const cell = row.getCell(2);
                if (typeof cell.value === 'number') {
                    cell.numFmt = '"$"#,##0.00';
                }
            }
        });

        // Bordes para todas las celdas con datos
        [worksheet, statsWorksheet, paymentsStatsWorksheet].forEach(sheet => {
            sheet.eachRow({ includeEmpty: false }, row => {
                row.eachCell({ includeEmpty: false }, cell => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });
        });

        // Generar el buffer y enviar el archivo
        const buffer = await workbook.xlsx.writeBuffer();

        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename=reporte-reservas-${moment().format('YYYYMMDD')}.xlsx`,
            'Content-Length': buffer.length
        });

        res.send(buffer);

    } catch (error) {
        console.error('Error generando Excel:', error);
        res.status(500).json({
            message: "Error generando Excel",
            error: error.message
        });
    }
});

module.exports = router;