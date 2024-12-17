const moment = require('moment');
const Reservation = require('../models/Reservation');

const TOTAL_HABITACIONES = 15;

const calcularOcupacionMensual = async (mes, anio) => {
    const fechaInicio = moment(`${anio}-${mes}-01`);
    const primerDiaMes = fechaInicio.startOf('month').toDate();
    const ultimoDiaMes = fechaInicio.endOf('month').toDate();
    const diasEnMes = fechaInicio.daysInMonth();

    try {
        console.log(`Calculando ocupación para ${mes}/${anio}`);

        const reservaciones = await Reservation.find({
            $or: [
                { start: { $gte: primerDiaMes, $lte: ultimoDiaMes } },
                { end: { $gte: primerDiaMes, $lte: ultimoDiaMes } },
                { start: { $lte: primerDiaMes }, end: { $gte: ultimoDiaMes } }
            ]
        });

        let totalNochesOcupadas = 0;

        reservaciones.forEach(reservacion => {
            const startDate = moment.max(moment(reservacion.start), moment(primerDiaMes));
            const endDate = moment.min(moment(reservacion.end), moment(ultimoDiaMes));
            const nightsInMonth = endDate.diff(startDate, 'days');

            if (nightsInMonth > 0) {
                totalNochesOcupadas += reservacion.nights || 0;
            }
        });

        const habitacionesDisponiblesMes = TOTAL_HABITACIONES * diasEnMes;
        const porcentajeOcupacion = (totalNochesOcupadas / habitacionesDisponiblesMes) * 100;

        console.log(`Total noches ocupadas: ${totalNochesOcupadas}`);
        console.log(`Habitaciones disponibles en el mes: ${habitacionesDisponiblesMes}`);
        console.log(`Porcentaje de ocupación calculado: ${porcentajeOcupacion.toFixed(2)}%`);

        return {
            porcentajeOcupacion,
            diasOcupados: totalNochesOcupadas,
            promedioOcupacionDiaria: totalNochesOcupadas / diasEnMes
        };
    } catch (error) {
        console.error('Error calculando ocupación:', error);
        return {
            porcentajeOcupacion: 0,
            diasOcupados: 0,
            promedioOcupacionDiaria: 0
        };
    }
};

module.exports = calcularOcupacionMensual;