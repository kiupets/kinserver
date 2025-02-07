const express = require('express');
const router = express.Router();
const Ganancias = require('../models/Ganancias');
const moment = require('moment');

// Obtener datos históricos de los últimos 6 meses
router.get('/historical/:userId/:month/:year', async (req, res) => {
    try {
        const { userId, month, year } = req.params;
        const currentDate = moment([parseInt(year), parseInt(month) - 1]);
        const historicalData = [];

        // Obtener datos de los últimos 6 meses
        for (let i = 5; i >= 0; i--) {
            const targetDate = moment(currentDate).subtract(i, 'months');
            const targetMonth = (targetDate.month() + 1).toString().padStart(2, '0');
            const targetYear = targetDate.year();

            const monthData = await Ganancias.findOne({
                userId,
                month: targetMonth,
                year: targetYear
            });

            if (monthData) {
                const totalIngresos = monthData.ingresos.reduce((sum, i) => sum + (i.monto || 0), 0);
                const totalGastosOrd = monthData.gastosOrdinarios.reduce((sum, g) => sum + (g.monto || 0), 0);
                const totalGastosExt = monthData.gastosExtraordinarios.reduce((sum, g) => sum + (g.monto || 0), 0);
                const totalGastos = totalGastosOrd + totalGastosExt;

                historicalData.push({
                    fecha: targetDate.format('MMM YYYY'),
                    ingresos: totalIngresos,
                    gastos: totalGastos,
                    balance: totalIngresos - totalGastos,
                    detalles: {
                        gastosOrdinarios: totalGastosOrd,
                        gastosExtraordinarios: totalGastosExt,
                        ingresosDesglose: monthData.ingresos
                    }
                });
            } else {
                historicalData.push({
                    fecha: targetDate.format('MMM YYYY'),
                    ingresos: 0,
                    gastos: 0,
                    balance: 0,
                    detalles: {
                        gastosOrdinarios: 0,
                        gastosExtraordinarios: 0,
                        ingresosDesglose: []
                    }
                });
            }
        }

        // Calcular comparaciones con el mes anterior
        const currentMonth = historicalData[historicalData.length - 1];
        const previousMonth = historicalData[historicalData.length - 2];

        let comparisons = {};
        if (currentMonth && previousMonth) {
            const calculatePercentageChange = (current, previous) => {
                if (previous === 0) return current > 0 ? 100 : 0;
                return ((current - previous) / previous) * 100;
            };

            comparisons = {
                ingresos: calculatePercentageChange(currentMonth.ingresos, previousMonth.ingresos),
                gastos: calculatePercentageChange(currentMonth.gastos, previousMonth.gastos),
                balance: calculatePercentageChange(currentMonth.balance, previousMonth.balance)
            };
        }

        res.json({
            historicalData,
            comparisons
        });

    } catch (error) {
        console.error('Error obteniendo datos históricos:', error);
        res.status(500).json({
            message: "Error obteniendo datos históricos",
            error: error.message
        });
    }
});

module.exports = router; 