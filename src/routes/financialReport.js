const express = require('express');
const router = express.Router();
const moment = require('moment');
const Reservation = require('../models/Reservation');

router.get('/:userId/:month/:year', async (req, res) => {
    console.log('\n================== INICIO REPORTE FINANCIERO ==================');
    try {
        const { userId, month, year } = req.params;
        console.log('Parámetros recibidos:', { userId, month, year });

        const monthStart = moment([year, month - 1]).startOf('month');
        const monthEnd = moment([year, month - 1]).endOf('month');

        console.log('Período:', {
            inicio: monthStart.format('YYYY-MM-DD'),
            fin: monthEnd.format('YYYY-MM-DD')
        });

        const reservations = await Reservation.find({
            user: userId,
            $or: [
                { start: { $gte: monthStart.toDate(), $lte: monthEnd.toDate() } },
                { end: { $gte: monthStart.toDate(), $lte: monthEnd.toDate() } },
                {
                    $and: [
                        { start: { $lte: monthStart.toDate() } },
                        { end: { $gte: monthEnd.toDate() } }
                    ]
                }
            ],
            status: { $ne: 'cancelled' }
        }).lean();

        console.log(`\nReservaciones encontradas: ${reservations.length}`);

        let totalPendiente = 0;
        console.log('\nDETALLE DE RESERVAS CON MONTOS PENDIENTES:');
        reservations.forEach((reserva, index) => {
            if (reserva.montoPendiente > 0) {
                totalPendiente += reserva.montoPendiente;
                console.log(`Reserva ${index + 1}:`, {
                    id: reserva._id,
                    huesped: reserva.name,
                    habitacion: reserva.room,
                    precioTotal: reserva.precioTotal,
                    montoPendiente: reserva.montoPendiente
                });
            }
        });

        console.log(`\nTotal Pendiente Acumulado: ${totalPendiente}`);

        const totals = {
            efectivo: 0,
            tarjeta: 0,
            transferencia: 0,
            pendiente: totalPendiente,
            total: 0
        };

        console.log('\nRESUMEN FINAL:', totals);

        res.json({
            success: true,
            data: {
                totals,
                month: parseInt(month),
                year: parseInt(year)
            }
        });

    } catch (error) {
        console.error('Error generando reporte financiero:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router; 