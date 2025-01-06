const moment = require('moment');
const Reservation = require('../models/Reservation');

const TOTAL_HABITACIONES = 15;

const calcularOcupacionMensual = async (mes, anio) => {
    const fechaInicio = moment(`${anio}-${mes}-01`);
    const primerDiaMes = fechaInicio.clone().startOf('month').toDate();
    const ultimoDiaMes = fechaInicio.clone().endOf('month').toDate();
    const diasEnMes = fechaInicio.daysInMonth();

    try {
        const query = {
            end: { $gte: primerDiaMes },
            start: { $lte: ultimoDiaMes }
        };

        const reservaciones = await Reservation.find(query);

        let totalNochesOcupadas = 0;
        reservaciones.forEach(reservacion => {
            totalNochesOcupadas += reservacion.nights || 0;
        });

        const habitacionesDisponiblesMes = TOTAL_HABITACIONES * diasEnMes;
        const porcentajeOcupacion = Number(((totalNochesOcupadas / habitacionesDisponiblesMes) * 100).toFixed(2));

        return {
            porcentajeOcupacion,
            diasOcupados: totalNochesOcupadas,
            promedioOcupacionDiaria: Number((totalNochesOcupadas / diasEnMes).toFixed(2))
        };
    } catch (error) {
        console.error('Error al calcular ocupación:', error);
        throw error;
    }
};

module.exports = calcularOcupacionMensual;