const calculatePaymentTotals = (reservation, options = {}) => {
    const {
        startDate = null,
        endDate = null
    } = options;

    console.log('\nCalculando totales para reserva:', {
        nombre: reservation.name,
        inicio: reservation.start,
        fin: reservation.end,
        precioTotal: reservation.precioTotal
    });

    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    const reservationStart = new Date(reservation.start);
    const reservationEnd = new Date(reservation.end);

    // Si la reserva está completamente en un mes
    if (reservationStart.getMonth() === reservationEnd.getMonth() &&
        reservationStart.getYear() === reservationEnd.getYear()) {
        console.log('Reserva en un solo mes - usando total completo');
        return sumPaymentsByMethod(reservation.payments || []);
    }

    // Para reservas que cruzan meses
    console.log('Reserva cruza meses - calculando proporción');

    // Calcular precio por noche
    const totalNights = Math.ceil((reservationEnd - reservationStart) / (1000 * 60 * 60 * 24)) + 1;
    const pricePerNight = reservation.precioTotal / totalNights;

    console.log('Detalles de cálculo:', {
        totalNights,
        pricePerNight,
        rangeStart,
        rangeEnd,
        reservationStart,
        reservationEnd
    });

    // Calcular noches en el rango solicitado
    const startOfPeriod = new Date(Math.max(rangeStart.getTime(), reservationStart.getTime()));
    const endOfPeriod = new Date(Math.min(rangeEnd.getTime(), reservationEnd.getTime()));
    const nightsInRange = Math.ceil((endOfPeriod - startOfPeriod) / (1000 * 60 * 60 * 24)) + 1;

    console.log('Noches en rango:', {
        startOfPeriod,
        endOfPeriod,
        nightsInRange
    });

    // Calcular monto para el período
    const amountForPeriod = pricePerNight * nightsInRange;
    const proportion = amountForPeriod / reservation.precioTotal;

    console.log('Montos calculados:', {
        amountForPeriod,
        proportion
    });

    const totals = {
        efectivo: 0,
        tarjeta: 0,
        transferencia: 0,
        total: amountForPeriod
    };

    // Distribuir los pagos
    (reservation.payments || []).forEach(payment => {
        if (!payment.method || !payment.amount) return;
        const proportionalPayment = payment.amount * proportion;
        totals[payment.method] += proportionalPayment;
    });

    console.log('Totales finales:', totals);

    return totals;
};