const moment = require('moment');
const Reservation = require('../models/Reservation');
const mongoose = require('mongoose');

const TOTAL_HABITACIONES = 15;

const calcularOcupacionMensual = async (mes, anio, userId) => {
    try {
        // Asegurar que mes y año sean números
        const mesNum = parseInt(mes);
        const anioNum = parseInt(anio);

        // Crear fechas de inicio y fin del mes
        const fechaInicio = moment(`${anioNum}-${mesNum.toString().padStart(2, '0')}-01`);
        const primerDiaMes = fechaInicio.clone().startOf('month').toDate();
        const ultimoDiaMes = fechaInicio.clone().endOf('month').toDate();
        const diasEnMes = fechaInicio.daysInMonth();

        console.log('Calculando ocupación para:', {
            mes: mesNum,
            anio: anioNum,
            userId,
            primerDiaMes,
            ultimoDiaMes,
            diasEnMes
        });

        // Buscar todas las reservaciones que se solapan con el mes
        const reservaciones = await Reservation.find({
            user: new mongoose.Types.ObjectId(userId),
            status: { $ne: 'cancelled' }, // Excluir reservaciones canceladas
            $or: [
                // Caso 1: La reserva empieza en el mes
                {
                    start: { $gte: primerDiaMes, $lte: ultimoDiaMes }
                },
                // Caso 2: La reserva termina en el mes
                {
                    end: { $gte: primerDiaMes, $lte: ultimoDiaMes }
                },
                // Caso 3: La reserva abarca todo el mes
                {
                    start: { $lte: primerDiaMes },
                    end: { $gte: ultimoDiaMes }
                }
            ]
        });

        console.log('Reservaciones encontradas:', reservaciones.length);

        // Log detallado de cada reservación encontrada
        reservaciones.forEach(res => {
            console.log('Detalle reservación:', {
                id: res._id,
                start: res.start,
                end: res.end,
                room: res.room,
                status: res.status
            });
        });

        let totalNochesOcupadas = 0;
        let habitacionesPorDia = new Array(diasEnMes).fill(0);
        let diasConOcupacion = new Set(); // Conjunto para rastrear días únicos con ocupación

        // Calcular ocupación día por día
        reservaciones.forEach(reservacion => {
            const inicio = moment.max(moment(reservacion.start), moment(primerDiaMes));
            const fin = moment.min(moment(reservacion.end), moment(ultimoDiaMes));
            const diasReservacion = fin.diff(inicio, 'days');

            console.log('Procesando reservación:', {
                id: reservacion._id,
                inicio: inicio.format('YYYY-MM-DD'),
                fin: fin.format('YYYY-MM-DD'),
                dias: diasReservacion,
                habitaciones: reservacion.room ? (Array.isArray(reservacion.room) ? reservacion.room.length : 1) : 1
            });

            // Contar habitaciones ocupadas por día
            for (let i = 0; i < diasReservacion; i++) {
                const diaIndex = inicio.clone().add(i, 'days').date() - 1;
                const numHabitaciones = reservacion.room ?
                    (Array.isArray(reservacion.room) ? reservacion.room.length : 1) : 1;
                habitacionesPorDia[diaIndex] += numHabitaciones;
                totalNochesOcupadas += numHabitaciones;
                diasConOcupacion.add(diaIndex); // Agregar el día al conjunto de días ocupados
            }
        });

        const habitacionesDisponiblesMes = TOTAL_HABITACIONES * diasEnMes;
        const porcentajeOcupacion = Number(((totalNochesOcupadas / habitacionesDisponiblesMes) * 100).toFixed(2));
        const promedioOcupacionDiaria = habitacionesPorDia.reduce((sum, hab) => sum + hab, 0) / diasEnMes;

        console.log('Resultados:', {
            totalNochesOcupadas,
            habitacionesDisponiblesMes,
            porcentajeOcupacion,
            promedioOcupacionDiaria,
            habitacionesPorDia,
            diasConOcupacion: diasConOcupacion.size
        });

        return {
            porcentajeOcupacion,
            diasOcupados: diasConOcupacion.size, // Usar el tamaño del conjunto para días únicos
            promedioOcupacionDiaria: Number(promedioOcupacionDiaria.toFixed(2)),
            totalReservaciones: reservaciones.length,
            diasEnMes,
            habitacionesDisponiblesMes
        };
    } catch (error) {
        console.error('Error al calcular ocupación:', error);
        throw error;
    }
};

module.exports = calcularOcupacionMensual;