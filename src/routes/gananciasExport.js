const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const moment = require('moment');
const Reservation = require('../models/Reservation');
const calcularOcupacionMensual = require('../utils/occupancyCalculator')
const Ganancias = require('../models/Ganancias');
const mongoose = require('mongoose');

// Definir tipos de gastos ordenados y categorías
const tiposGastoOrdenados = [
    'SUELDOS',
    'AGUINALDO',
    'HORAS_EXTRAS',
    'VACACIONES',
    'LIMPIEZA',
    'LAVANDERIA',
    'MANTENIMIENTO',
    'SERVICIOS',
    'INSUMOS',
    'GASTOS_VARIOS',
    'OTROS'
];

const categorias = [
    'MOBILIARIO',
    'ELECTRODOMÉSTICOS',
    'ROPA BLANCA',
    'REPARACIONES',
    'OTROS'
];

// Función para obtener el nombre del mes
const getNombreMes = (mes) => {
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[parseInt(mes) - 1];
};

// Endpoint para exportar el reporte de ganancias
router.post('/export-ganancias', async (req, res) => {
    console.log('\n================== INICIO EXPORTACIÓN GANANCIAS ==================');
    console.log('Datos recibidos:', {
        month: req.body.selectedMonth,
        year: req.body.selectedYear,
        userId: req.body.userId,
        financialReport: req.body.financialReport ? 'presente' : 'ausente'
    });

    try {
        const { ingresos, gastosOrdinarios, gastosExtraordinarios, selectedMonth, selectedYear, userId, cajaAnterior, financialReport } = req.body;

        // 1. Inicializar el workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Sistema de Ganancias';
        workbook.lastModifiedBy = 'Sistema de Ganancias';
        workbook.created = new Date();
        workbook.modified = new Date();

        // 2. Obtener nombre del mes y título
        const nombreMes = getNombreMes(selectedMonth);
        const tituloReporte = `REPORTE FINANCIERO - ${nombreMes.toUpperCase()} ${selectedYear}`;

        // 2.1 Obtener reservaciones del mes
        const mesNum = parseInt(selectedMonth);
        const anioNum = parseInt(selectedYear);
        const primerDiaMes = moment(`${anioNum}-${mesNum}-01`).startOf('month');
        const ultimoDiaMes = moment(`${anioNum}-${mesNum}-01`).endOf('month');

        // Buscar todas las reservaciones que se solapan con el mes
        const reservaciones = await Reservation.find({
            user: new mongoose.Types.ObjectId(userId),
            status: { $ne: 'cancelled' },
            start: { $lte: ultimoDiaMes.toDate() },
            end: { $gte: primerDiaMes.toDate() }
        }).lean();

        // Debug: Agregar logs después de obtener las reservaciones
        console.log('Reservaciones encontradas:', reservaciones.length);
        if (reservaciones.length > 0) {
            console.log('DEBUG: Primera reservacion:', reservaciones[0]);
            if (reservaciones[0].payments) {
                console.log('DEBUG: Pagos de la primera reservacion:', reservaciones[0].payments);
            } else {
                console.log('DEBUG: La primera reservacion no tiene la propiedad payments');
            }
        }

        // Procesar cada reservación para calcular montos correctamente
        const reservacionesProcesadas = reservaciones.map(reserva => {
            const inicio = moment(reserva.start);
            const fin = moment(reserva.end);
            const cruzaMeses = inicio.month() !== fin.month() || inicio.year() !== fin.year();

            if (cruzaMeses) {
                // Calcular las noches efectivas en este mes
                const inicioEfectivo = moment.max(inicio, primerDiaMes);
                const finEfectivo = moment.min(fin, ultimoDiaMes);
                const nochesEnEsteMes = finEfectivo.diff(inicioEfectivo, 'days');
                const nochesTotales = fin.diff(inicio, 'days');

                // Calcular la proporción del monto que corresponde a este mes
                const proporcion = nochesEnEsteMes / nochesTotales;

                // Ajustar los montos según la proporción
                return {
                    ...reserva,
                    price: reserva.price * proporcion,
                    precioTotal: reserva.precioTotal * proporcion,
                    montoPendiente: reserva.montoPendiente * proporcion,
                    payments: (reserva.payments || []).map(payment => ({
                        ...payment,
                        amount: payment.amount * proporcion
                    }))
                };
            }

            return reserva;
        });

        // 3. Calcular todos los valores necesarios usando las reservaciones procesadas
        const totalIngresos = reservacionesProcesadas
            .reduce((sum, reserva) => {
                const pagos = reserva.payments || [];
                return sum + pagos.reduce((total, pago) => total + (parseFloat(pago.amount) || 0), 0);
            }, 0);

        const totalGastosOrd = gastosOrdinarios.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0);
        const totalGastosExt = gastosExtraordinarios.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0);

        const pendientesReservas = reservacionesProcesadas.reduce((sum, reserva) => sum + ((reserva.payments || []).reduce((s, pago) => s + (parseFloat(pago.montoPendiente) || 0), 0)), 0);

        const facturacionTotal = totalIngresos + pendientesReservas;

        // Calcular estadísticas de ocupación
        let estadisticasOcupacion = {
            totalReservaciones: 0,
            porcentajeOcupacion: 0,
            diasOcupados: 0,
            promedioOcupacionDiaria: 0
        };

        try {
            if (mongoose.Types.ObjectId.isValid(userId)) {
                estadisticasOcupacion = await calcularOcupacionMensual(
                    selectedMonth,
                    selectedYear,
                    new mongoose.Types.ObjectId(userId)
                );
            } else {
                console.error('Invalid userId format:', userId);
            }
        } catch (error) {
            console.error('Error calculating occupancy:', error);
        }

        // Calcular promedio de noches por reserva
        const totalNoches = reservacionesProcesadas.reduce((sum, reserva) => {
            const inicio = moment(reserva.start);
            const fin = moment(reserva.end);
            return sum + fin.diff(inicio, 'days');
        }, 0);
        const promedioNoches = totalNoches / (reservacionesProcesadas.length || 1);

        // Calcular estadísticas de métodos de pago
        const metodosStats = {};
        const reservasCruzadas = reservacionesProcesadas.filter(reserva => {
            const inicio = moment(reserva.start);
            const fin = moment(reserva.end);
            return inicio.month() !== fin.month() || inicio.year() !== fin.year();
        }).map(reserva => ({
            room: reserva.room,
            guestName: `${reserva.name || ''} ${reserva.surname || ''}`.trim(),
            start: reserva.start,
            end: reserva.end
        }));

        // Contabilizar métodos de pago
        reservacionesProcesadas.forEach(reserva => {
            const metodo = reserva.metodoPago || 'No especificado';
            metodosStats[metodo] = (metodosStats[metodo] || 0) + 1;
        });

        const totalReservaciones = reservacionesProcesadas.length;

        // Calcular valores de caja con más precisión
        const cajaAnteriorNum = Number(parseFloat(cajaAnterior || 0).toFixed(2));
        const ingresosEfectivoNum = Number(
            ingresos
                .filter(i => i.subcategoria === 'Efectivo')
                .reduce((sum, i) => sum + (parseFloat(i.monto) || 0), 0)
                .toFixed(2)
        );
        const ingresosTarjetaNum = Number(
            ingresos
                .filter(i => i.subcategoria === 'Tarjeta')
                .reduce((sum, i) => sum + (parseFloat(i.monto) || 0), 0)
                .toFixed(2)
        );
        const ingresosTransferenciaNum = Number(
            ingresos
                .filter(i => i.subcategoria === 'Transferencia')
                .reduce((sum, i) => sum + (parseFloat(i.monto) || 0), 0)
                .toFixed(2)
        );

        const gastosOrdinariosEfectivoNum = Number(
            gastosOrdinarios
                .filter(g => g.metodoPago === 'EFECTIVO')
                .reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0)
                .toFixed(2)
        );

        // Calcular saldo final con valores verificados
        console.log('Valores para saldo final:');
        console.log('Caja Anterior:', cajaAnteriorNum);
        console.log('Ingresos Efectivo:', ingresosEfectivoNum);
        console.log('Gastos Ordinarios Efectivo:', gastosOrdinariosEfectivoNum);

        // Calcular el saldo final (sin invertir el signo)
        const saldoFinal = Number((cajaAnteriorNum + ingresosEfectivoNum - gastosOrdinariosEfectivoNum).toFixed(2));
        console.log('Saldo Final calculado:', saldoFinal);

        const totalIngresosFE = Number((ingresosEfectivoNum + ingresosTarjetaNum + ingresosTransferenciaNum).toFixed(2));
        const totalEgresos = totalGastosOrd + totalGastosExt;
        const resultadoNetoFE = totalIngresosFE - totalEgresos;

        // Add dynamic grouping for gastos ordinarios
        const gruposGastosOrdinarios = Array.from(new Set(gastosOrdinarios.map(gasto => (gasto.tipo || gasto.categoria))));

        // Justo antes de la definición de 'datosResumen' en la hoja 'Resumen Financiero', agregar:
        const pendientesSinProcesar = reservaciones.reduce((sum, reserva) => sum + ((reserva.payments || []).reduce((s, pago) => s + (parseFloat(pago.montoPendiente) || 0), 0)), 0);

        // 4. Crear la hoja de Caja
        const cajaSheet = workbook.addWorksheet('Caja');
        cajaSheet.columns = [
            { header: '', key: 'concepto', width: 30 },
            { header: '', key: 'monto', width: 20, style: { numFmt: '"$"#,##0.00' } }
        ];

        // 5. Agregar título a la hoja de Caja
        const titleRowCaja = cajaSheet.addRow([tituloReporte]);
        cajaSheet.mergeCells('A1:B1');
        titleRowCaja.font = { bold: true, size: 14 };
        titleRowCaja.alignment = { horizontal: 'center' };
        titleRowCaja.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE3F2FD' }
        };

        // 6. Agregar headers
        const headerRowCaja = cajaSheet.addRow(['Concepto', 'Monto']);
        headerRowCaja.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRowCaja.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4167B1' }
        };

        cajaSheet.addRow(['', '']); // Espacio después del header

        // 7. Definir las filas de caja con valores verificados
        const filasCaja = [
            { concepto: 'CAJA', monto: null },
            { concepto: 'Caja del mes anterior', monto: cajaAnteriorNum },
            { concepto: 'Ingresos en Efectivo', monto: ingresosEfectivoNum },
            { concepto: 'Gastos Ordinarios en Efectivo', monto: -gastosOrdinariosEfectivoNum },
            { concepto: '', monto: null },
            { concepto: 'Saldo Final de Caja', monto: saldoFinal },
            { concepto: '', monto: null },
            { concepto: 'RESULTADO OPERATIVO', monto: null },
            { concepto: 'Ingresos Totales', monto: totalIngresosFE },
            { concepto: 'Gastos Ordinarios', monto: -totalGastosOrd },
            { concepto: 'Gastos Extraordinarios', monto: -totalGastosExt },
            { concepto: '', monto: null },
            { concepto: 'Resultado antes de Impuestos', monto: resultadoNetoFE }
        ];

        // 8. Agregar filas y aplicar estilos
        filasCaja.forEach((fila) => {
            let row;

            if (fila.concepto === 'Saldo Final de Caja') {
                // Manejar específicamente el Saldo Final de Caja
                row = cajaSheet.addRow([fila.concepto, saldoFinal]);
                const montoCell = row.getCell(2);
                montoCell.value = saldoFinal;
                montoCell.numFmt = '"$"#,##0.00';
                row.font = { bold: true };
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD1C4E9' }
                };
            } else {
                // Manejar el resto de las filas normalmente
                row = cajaSheet.addRow([
                    fila.concepto,
                    fila.monto !== null ? fila.monto : ''
                ]);
                const montoCell = row.getCell(2);
                if (fila.monto !== null) {
                    montoCell.numFmt = '"$"#,##0.00';
                }
            }

            // Estilo para títulos de sección
            if (fila.concepto === 'CAJA' || fila.concepto === 'RESULTADO OPERATIVO') {
                row.font = { bold: true };
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF4167B1' }
                };
                row.getCell(1).font = { bold: true, color: { argb: 'FFFFFF' } };
                row.getCell(2).font = { bold: true, color: { argb: 'FFFFFF' } };
            }

            // Estilo para el resultado antes de impuestos
            if (fila.concepto === 'Resultado antes de Impuestos') {
                row.font = { bold: true };
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: resultadoNetoFE >= 0 ? 'FFE8F5E9' : 'FFFFEBEE' }
                };
            }

            // Alinear las celdas
            row.getCell(1).alignment = { horizontal: 'left' };
            row.getCell(2).alignment = { horizontal: 'right' };
        });

        // 9. Agregar detalles de gastos en efectivo
        cajaSheet.addRow(['', '']);
        const headerGastosEfectivo = cajaSheet.addRow(['Detalle de Gastos en Efectivo', '']);
        headerGastosEfectivo.font = { bold: true };
        headerGastosEfectivo.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4167B1' }
        };
        headerGastosEfectivo.getCell(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        cajaSheet.addRow(['', '']);

        // 10. Agregar los gastos en efectivo
        gastosOrdinarios
            .filter(g => g.metodoPago === 'EFECTIVO')
            .forEach(gasto => {
                const row = cajaSheet.addRow([
                    `${gasto.tipo} - ${gasto.concepto}`,
                    Number(gasto.monto)
                ]);
                const montoCell = row.getCell(2);
                row.getCell(1).alignment = { horizontal: 'left' };
                montoCell.alignment = { horizontal: 'right' };
                montoCell.numFmt = '"$"#,##0.00';
            });

        // 11. Aplicar bordes a todas las celdas
        cajaSheet.eachRow({ includeEmpty: false }, row => {
            row.eachCell({ includeEmpty: false }, cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Continuar con el resto de las hojas...

        // Hoja 1: Resumen Financiero
        const resumenSheet = workbook.addWorksheet('Resumen Financiero');
        resumenSheet.columns = [
            { header: 'Categoría', key: 'categoria', width: 40 },
            { header: 'Subcategoría', key: 'subcategoria', width: 100 },
            { header: 'Monto', key: 'monto', width: 30, style: { numFmt: '"$"#,##0' } },
            { header: 'Porcentaje', key: 'porcentaje', width: 25, style: { numFmt: '#,##0.00' } }
        ];

        // Ajustar el formato de texto para todas las columnas
        resumenSheet.columns.forEach(column => {
            column.alignment = {
                wrapText: true,
                vertical: 'middle'
            };
        });

        // Ajustar la altura de las filas
        resumenSheet.eachRow((row) => {
            row.height = 25;  // Altura suficiente para el texto
        });

        // Asegurar que los montos se alineen a la derecha
        resumenSheet.getColumn('monto').alignment = { horizontal: 'right' };
        resumenSheet.getColumn('porcentaje').alignment = { horizontal: 'right' };

        // Ajustar el formato de los números para asegurar que se muestren correctamente
        const datosResumen = [
            { categoria: 'INGRESOS' },
            { categoria: '', subcategoria: 'Efectivo', monto: parseFloat(ingresosEfectivoNum), porcentaje: ((ingresosEfectivoNum / totalIngresosFE) * 100).toFixed(2) },
            { categoria: '', subcategoria: 'Tarjeta', monto: parseFloat(ingresosTarjetaNum), porcentaje: ((ingresosTarjetaNum / totalIngresosFE) * 100).toFixed(2) },
            { categoria: '', subcategoria: 'Transferencia', monto: parseFloat(ingresosTransferenciaNum), porcentaje: ((ingresosTransferenciaNum / totalIngresosFE) * 100).toFixed(2) },
            { categoria: '', subcategoria: 'Total', monto: parseFloat(totalIngresosFE), porcentaje: '100.00' },
            { categoria: '' },  // Línea en blanco
            { categoria: 'PENDIENTES DE RESERVAS' },
            { categoria: '', subcategoria: 'Total Pendiente', monto: parseFloat(pendientesSinProcesar), porcentaje: ((pendientesSinProcesar / totalIngresosFE) * 100).toFixed(2) },
            { categoria: '' },  // Línea en blanco
            { categoria: 'FACTURACIÓN TOTAL' },
            { categoria: '', subcategoria: 'Total Facturado', monto: parseFloat(totalIngresosFE), porcentaje: '100.00' },
            { categoria: '', subcategoria: '', monto: null, porcentaje: null },
            { categoria: 'GASTOS ORDINARIOS', subcategoria: '', monto: null, porcentaje: null },
            ...gruposGastosOrdinarios.map(tipo => {
                const gastosDelTipo = gastosOrdinarios.filter(g => (g.tipo || g.categoria) === tipo);
                const subtotal = gastosDelTipo.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
                return {
                    categoria: '',
                    subcategoria: tipo,
                    monto: subtotal,
                    porcentaje: ((subtotal / totalIngresosFE) * 100).toFixed(2)
                };
            }),
            {
                categoria: 'GASTOS ORDINARIOS',
                subcategoria: 'Total',
                monto: totalGastosOrd,
                porcentaje: ((totalGastosOrd / totalIngresosFE) * 100).toFixed(2)
            },
            { categoria: '', subcategoria: '', monto: null, porcentaje: null },
            { categoria: 'DETALLE GASTOS ORDINARIOS', subcategoria: '', monto: null, porcentaje: null },
            ...gastosOrdinarios.map(gasto => ({
                categoria: '',
                subcategoria: `${gasto.tipo} - ${gasto.concepto} (${gasto.metodoPago})`,
                monto: parseFloat(gasto.monto) || 0,
                porcentaje: null
            })),
            { categoria: '', subcategoria: '', monto: null, porcentaje: null },
            { categoria: 'GASTOS EXTRAORDINARIOS', subcategoria: '', monto: null, porcentaje: null },
            ...gastosExtraordinarios.map(gasto => ({
                categoria: '',
                subcategoria: `${gasto.categoria} - ${gasto.concepto}`,
                monto: parseFloat(gasto.monto) || 0,
                porcentaje: ((parseFloat(gasto.monto) / totalGastosExt) * 100).toFixed(2)
            })).filter(item => item.monto > 0),
            {
                categoria: 'GASTOS EXTRAORDINARIOS',
                subcategoria: 'Total',
                monto: totalGastosExt,
                porcentaje: ((totalGastosExt / totalGastosExt) * 100).toFixed(2)
            },
            { categoria: '', subcategoria: '', monto: null, porcentaje: null },
            { categoria: 'RESULTADO', subcategoria: 'NETO', monto: resultadoNetoFE, porcentaje: ((resultadoNetoFE / totalIngresosFE) * 100).toFixed(2) },
            { categoria: '', subcategoria: '', monto: null, porcentaje: null }
        ];

        // Asegurar que todas las celdas de montos tengan el formato correcto
        datosResumen.forEach(row => {
            if (row.monto !== undefined) {
                row.monto = Number(row.monto);  // Convertir explícitamente a número
            }
            if (row.porcentaje !== undefined) {
                row.porcentaje = Number(row.porcentaje);  // Convertir explícitamente a número
            }
        });

        // Agregar datos al resumen
        datosResumen.forEach((item, index) => {
            const row = resumenSheet.addRow(item);

            // Asegurar formato numérico para montos y porcentajes
            if (item.monto !== undefined) {
                const montoCell = row.getCell(3);  // Columna de Monto
                montoCell.numFmt = '"$"#,##0';
                montoCell.value = parseFloat(item.monto) || 0;
            }

            if (item.porcentaje !== undefined) {
                const porcentajeCell = row.getCell(4);  // Columna de Porcentaje
                porcentajeCell.numFmt = '#,##0.00';
                porcentajeCell.value = parseFloat(item.porcentaje) || 0;
            }

            // Estilos especiales para títulos y totales
            if (item.categoria && !item.subcategoria) {
                row.font = { bold: true };
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE3F2FD' }
                };
            }

            // Estilos para totales
            if (item.subcategoria && item.subcategoria.includes('Total')) {
                row.font = { bold: true };
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE8EAF6' }
                };
            }

            // Estilo especial para resultado neto
            if (item.categoria === 'RESULTADO') {
                row.font = { bold: true, size: 12 };
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: item.monto >= 0 ? 'FF4CAF50' : 'FFEF5350' }
                };
            }

            // Estilo especial para pendientes y sus detalles
            if (item.subcategoria === 'Total Pendiente de Cobro') {
                row.font = { bold: true };
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFF9E9E' }
                };
            } else if (item.categoria === '' && parseFloat(item.monto) > 0 &&
                item.subcategoria.includes('Hab ')) {
                // Estilo para los detalles de reservas pendientes
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFCE4EC' }
                };
            }

            // Estilo especial para facturación total
            if (item.subcategoria === 'Total Facturado') {
                row.font = { bold: true };
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF90CAF9' }  // Azul claro
                };
            }
        });

        // Agregar sección de PENDIENTES DE RESERVAS con detalle
        resumenSheet.addRow(['']);
        const headerPendientes = resumenSheet.addRow(['PENDIENTES DE RESERVAS']);
        headerPendientes.font = { bold: true, size: 12 };
        headerPendientes.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEF9A9A' }  // Rojo claro
        };

        // Agregar headers para la tabla de pendientes
        const headerRow = resumenSheet.addRow(['Huésped', 'Habitación', 'Check-in', 'Check-out', 'Precio Total', 'Monto Pendiente']);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEF5350' }  // Rojo más oscuro
        };
        headerRow.alignment = { horizontal: 'center' };

        // Agregar cada reserva pendiente
        if (financialReport?.data?.reservasPendientes) {
            financialReport.data.reservasPendientes.forEach(reserva => {
                const row = resumenSheet.addRow([
                    reserva.huesped,
                    reserva.habitacion,
                    reserva.checkIn,
                    reserva.checkOut,
                    { formula: `VALUE("${reserva.precioTotal}")` },  // Convertir a número
                    { formula: `VALUE("${reserva.montoPendiente}")` }  // Convertir a número
                ]);

                // Formato para las celdas de montos
                const precioTotalCell = row.getCell(5);
                const montoPendienteCell = row.getCell(6);

                precioTotalCell.numFmt = '"$"#,##0';
                montoPendienteCell.numFmt = '"$"#,##0';

                // Color de fondo suave para la fila
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFCE4EC' }  // Rosa muy claro
                };

                // Alineación
                row.alignment = { horizontal: 'left' };
                precioTotalCell.alignment = { horizontal: 'right' };
                montoPendienteCell.alignment = { horizontal: 'right' };
            });
        }

        // Agregar fila de total
        resumenSheet.addRow(['']);
        const totalRow = resumenSheet.addRow([
            'TOTAL PENDIENTE DE COBRO',
            '',
            '',
            '',
            '',
            { formula: `VALUE("${financialReport?.data?.totals?.pendiente || 0}")` }
        ]);

        // Formato para la fila de total
        totalRow.font = { bold: true, size: 11 };
        totalRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEF5350' }  // Rojo más oscuro
        };
        totalRow.getCell(6).numFmt = '"$"#,##0';
        totalRow.getCell(6).alignment = { horizontal: 'right' };

        // Ajustar anchos de columna
        resumenSheet.getColumn('A').width = 30;  // Huésped
        resumenSheet.getColumn('B').width = 15;  // Habitación
        resumenSheet.getColumn('C').width = 12;  // Check-in
        resumenSheet.getColumn('D').width = 12;  // Check-out
        resumenSheet.getColumn('E').width = 15;  // Precio Total
        resumenSheet.getColumn('F').width = 15;  // Monto Pendiente

        // Hoja de Ocupación
        const ocupacionSheet = workbook.addWorksheet('Estadísticas de Ocupación');
        ocupacionSheet.columns = [
            { header: 'Métrica', key: 'metrica', width: 40 },
            { header: 'Valor', key: 'valor', width: 15, style: { numFmt: '#,##0.00' } },
            { header: 'Porcentaje', key: 'porcentaje', width: 15, style: { numFmt: '#,##0.00"%"' } }
        ];

        // Agregar título
        ocupacionSheet.insertRow(1, [tituloReporte]);
        ocupacionSheet.mergeCells('A1:C1');
        const titleRowOcup = ocupacionSheet.getRow(1);
        titleRowOcup.font = { bold: true, size: 14 };
        titleRowOcup.alignment = { horizontal: 'center' };
        ocupacionSheet.addRow([]); // Espacio después del título

        // Datos de ocupación
        const datosOcupacion = [
            {
                metrica: 'Total Reservaciones',
                valor: estadisticasOcupacion?.totalReservaciones || 0,
                porcentaje: null
            },
            {
                metrica: 'Promedio Noches por Reserva',
                valor: Number(promedioNoches) || 0,
                porcentaje: null
            },
            {
                metrica: 'Porcentaje Ocupación',
                valor: Number(estadisticasOcupacion?.porcentajeOcupacion) || 0,
                porcentaje: Number(estadisticasOcupacion?.porcentajeOcupacion) || 0
            },
            {
                metrica: 'Días Ocupados',
                valor: estadisticasOcupacion?.diasOcupados || 0,
                porcentaje: null
            },
            {
                metrica: 'Promedio Diario Ocupación',
                valor: Number(estadisticasOcupacion?.promedioOcupacionDiaria) || 0,
                porcentaje: null
            }
        ];

        // Agregar datos a la hoja de ocupación
        datosOcupacion.forEach((item, index) => {
            const row = ocupacionSheet.addRow(item);
            row.font = { size: 11 };
        });

        // Agregar espacio y título para estadísticas de método de pago
        ocupacionSheet.addRow({});
        const headerMetodosPago = ocupacionSheet.addRow({
            metrica: 'ESTADÍSTICAS POR MÉTODO DE PAGO',
            valor: '',
            porcentaje: ''
        });
        headerMetodosPago.font = { bold: true, size: 12 };
        headerMetodosPago.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE3F2FD' }
        };
        ocupacionSheet.addRow({});

        // Agregar estadísticas de métodos de pago
        if (metodosStats && Object.keys(metodosStats).length > 0) {
            Object.entries(metodosStats).forEach(([metodo, cantidad]) => {
                const porcentaje = ((cantidad / totalReservaciones) * 100);
                ocupacionSheet.addRow({
                    metrica: `Reservas ${metodo}`,
                    valor: cantidad,
                    porcentaje: porcentaje
                });
            });
        }

        // Agregar espacio y título para reservas cruzadas
        ocupacionSheet.addRow({});
        const headerReservasCruzadas = ocupacionSheet.addRow({
            metrica: 'RESERVAS QUE CRUZAN MESES',
            valor: reservasCruzadas.length,
            porcentaje: ''
        });
        headerReservasCruzadas.font = { bold: true, size: 12 };
        headerReservasCruzadas.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE3F2FD' }
        };
        // Asegurar que el valor se muestre como número entero
        const reservasCruzadasRow = ocupacionSheet.lastRow;
        reservasCruzadasRow.getCell('valor').numFmt = '0';

        // Agregar tabla de reservas cruzadas si existen
        if (reservasCruzadas.length > 0) {
            ocupacionSheet.addRow({});
            // Agregar headers de la tabla
            const columnsRow = ocupacionSheet.addRow({
                metrica: 'Habitación / Huésped',
                valor: 'Check-in',
                porcentaje: 'Check-out'
            });
            columnsRow.font = { bold: true };

            reservasCruzadas.forEach(reserva => {
                ocupacionSheet.addRow({
                    metrica: `${reserva.room} - ${reserva.guestName}`,
                    valor: moment(reserva.start).format('DD/MM/YYYY'),
                    porcentaje: moment(reserva.end).format('DD/MM/YYYY')
                });
            });
        }

        // Aplicar estilos al header de la hoja
        ocupacionSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        ocupacionSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4167B1' }
        };

        // Ajustar el ancho de las columnas
        ocupacionSheet.getColumn('metrica').width = 40;
        ocupacionSheet.getColumn('valor').width = 15;
        ocupacionSheet.getColumn('porcentaje').width = 15;

        // Alinear columnas numéricas a la derecha
        ocupacionSheet.getColumn('valor').alignment = { horizontal: 'right' };
        ocupacionSheet.getColumn('porcentaje').alignment = { horizontal: 'right' };

        // Nueva hoja: Detalle de Gastos
        const detalleGastosSheet = workbook.addWorksheet('Detalle de Gastos');
        detalleGastosSheet.columns = [
            { header: 'Tipo', key: 'tipo', width: 30 },
            { header: 'Categoría', key: 'categoria', width: 40 },
            { header: 'Concepto', key: 'concepto', width: 100 },
            { header: 'Fecha de Compra', key: 'fechaCompra', width: 25, style: { numFmt: 'dd/mm/yyyy' } },
            { header: 'Monto', key: 'monto', width: 30, style: { numFmt: '"$"#,##0' } },
            { header: 'Método de Pago', key: 'metodoPago', width: 25 }
        ];

        // Ajustar el formato de texto para que se ajuste automáticamente
        detalleGastosSheet.getColumn('concepto').alignment = {
            wrapText: true,
            vertical: 'middle'
        };

        // Agregar gastos ordinarios
        gastosOrdinarios.forEach(gasto => {
            detalleGastosSheet.addRow({
                tipo: 'Ordinario',
                categoria: gasto.tipo,
                concepto: gasto.concepto,
                fechaCompra: gasto.fechaCompra ? new Date(gasto.fechaCompra) : null,
                monto: gasto.monto,
                metodoPago: gasto.metodoPago
            });
        });

        // Agregar gastos extraordinarios
        gastosExtraordinarios.forEach(gasto => {
            detalleGastosSheet.addRow({
                tipo: 'Extraordinario',
                categoria: gasto.categoria,
                concepto: gasto.concepto,
                fechaCompra: gasto.fechaCompra ? new Date(gasto.fechaCompra) : null,
                monto: gasto.monto,
                metodoPago: gasto.metodoPago || ''
            });
        });

        // Aplicar estilos a la tabla de detalle
        detalleGastosSheet.getRow(1).font = { bold: true };
        detalleGastosSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE3F2FD' }
        };

        // Agregar totales al final con formato mejorado
        detalleGastosSheet.addRow({});
        const totalRowDetalle = detalleGastosSheet.addRow({
            tipo: 'TOTAL NETO',
            categoria: '',
            concepto: '',
            fechaCompra: '',
            monto: totalGastosOrd + totalGastosExt,
            metodoPago: ''
        });

        // Mejorar el formato de la fila de total
        totalRowDetalle.font = { bold: true, size: 12 }; // Aumentar tamaño de fuente
        totalRowDetalle.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE8EAF6' }
        };

        // Asegurar formato de número para la celda de monto total
        const montoCell = totalRowDetalle.getCell(5); // La columna de Monto
        montoCell.numFmt = '"$"#,##0';
        montoCell.alignment = { horizontal: 'right' };

        // Hacer que el total se extienda por varias columnas
        detalleGastosSheet.mergeCells({
            top: totalRowDetalle.number,
            left: 1,
            bottom: totalRowDetalle.number,
            right: 4
        });

        // Alinear el texto "TOTAL NETO" a la derecha en las celdas combinadas
        totalRowDetalle.getCell(1).alignment = { horizontal: 'right' };

        // Hoja 2: Gastos Ordinarios
        const gastosSheet = workbook.addWorksheet('Gastos Ordinarios');
        gastosSheet.columns = [
            { header: 'Tipo', key: 'tipo', width: 20 },
            { header: 'Concepto', key: 'concepto', width: 40 },
            { header: 'Fecha de Compra', key: 'fechaCompra', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
            { header: 'Fecha', key: 'fecha', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
            { header: 'Turno', key: 'turno', width: 15 },
            { header: 'Horas', key: 'horas', width: 10 },
            { header: 'Valor Hora', key: 'valorHora', width: 15 },
            { header: 'Periodo', key: 'periodo', width: 15 },
            { header: 'Monto', key: 'monto', width: 15 },
            { header: 'Método de Pago', key: 'metodoPago', width: 15 }
        ];

        // Agregar gastos ordinarios agrupados por tipo
        gruposGastosOrdinarios.forEach(tipo => {
            const headerRow = gastosSheet.addRow([tipo, '', '', '', '', '', '', '', '', '']);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE3F2FD' }
            };

            const gastosDelTipo = gastosOrdinarios.filter(g => (g.tipo || g.categoria) === tipo);
            gastosDelTipo.forEach(gasto => {
                gastosSheet.addRow({
                    tipo: (gasto.tipo || gasto.categoria),
                    concepto: gasto.concepto,
                    fechaCompra: gasto.fechaCompra ? new Date(gasto.fechaCompra) : null,
                    fecha: ((gasto.tipo || gasto.categoria) === 'HORAS_EXTRAS') ? new Date(gasto.fecha) : null,
                    turno: ((gasto.tipo || gasto.categoria) === 'HORAS_EXTRAS') ? gasto.turno : '',
                    horas: ((gasto.tipo || gasto.categoria) === 'HORAS_EXTRAS') ? gasto.cantidadHoras : '',
                    valorHora: ((gasto.tipo || gasto.categoria) === 'HORAS_EXTRAS') ? gasto.valorHora : '',
                    periodo: ((gasto.tipo || gasto.categoria) === 'AGUINALDO') ? `${gasto.periodo}° Semestre` : '',
                    monto: parseFloat(gasto.monto) || 0,
                    metodoPago: gasto.metodoPago
                });
            });

            // Calcular y agregar subtotal para este tipo
            const subtotal = gastosDelTipo.reduce(
                (sum, g) => sum + (parseFloat(g.monto) || 0),
                0
            );
            const subtotalRow = gastosSheet.addRow({
                tipo: `Subtotal ${tipo}`,
                concepto: '',
                fechaCompra: null,
                fecha: null,
                turno: '',
                horas: '',
                valorHora: '',
                periodo: '',
                monto: subtotal,
                metodoPago: ''
            });
            subtotalRow.font = { bold: true };
            subtotalRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE8EAF6' }
            };

            gastosSheet.addRow({}); // Agregar fila vacía después de cada grupo
        });

        // Aplicar formato a las columnas numéricas
        gastosSheet.getColumn('monto').numFmt = '"$"#,##0.00';
        gastosSheet.getColumn('valorHora').numFmt = '"$"#,##0.00';

        // Agregar total general
        const totalRowOrd = gastosSheet.addRow({
            tipo: 'TOTAL GENERAL',
            concepto: '',
            fechaCompra: null,
            fecha: null,
            turno: '',
            horas: '',
            valorHora: '',
            periodo: '',
            monto: totalGastosOrd,
            metodoPago: ''
        });

        totalRowOrd.font = { bold: true };
        totalRowOrd.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD1C4E9' }
        };

        try {
            const totalRowOrd = gastosSheet.addRow({
                tipo: 'TOTAL GENERAL',
                concepto: '',
                fechaCompra: null,
                fecha: null,
                turno: '',
                horas: '',
                valorHora: '',
                periodo: '',
                monto: totalGastosOrd,
                metodoPago: ''
            });
            totalRowOrd.font = { bold: true };
            totalRowOrd.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD1C4E9' }
            };

            // ... resto del código ...

            // Generar el archivo
            const buffer = await workbook.xlsx.writeBuffer();

            // Configurar headers de respuesta
            res.set({
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename=reporte-ganancias-${moment().format('YYYYMMDD')}.xlsx`,
                'Content-Length': buffer.length
            });

            // Enviar el archivo
            console.log('Exportación completada exitosamente');
            res.send(buffer);

        } catch (error) {
            console.error('Error en la exportación:', error);
            res.status(500).json({
                message: "Error generando Excel",
                error: error.message
            });
        }
    } catch (error) {
        console.error('Error en la exportación:', error);
        res.status(500).json({
            message: "Error generando Excel",
            error: error.message
        });
    }
});

router.get('/financial-report/:userId/:month/:year', async (req, res) => {
    try {
        const { userId, month, year } = req.params;
        const monthStart = moment([year, month - 1]).startOf('month');
        const monthEnd = moment([year, month - 1]).endOf('month');

        console.log('Buscando pendientes para:', {
            mes: monthStart.format('MMMM YYYY'),
            inicio: monthStart.format('YYYY-MM-DD'),
            fin: monthEnd.format('YYYY-MM-DD')
        });

        // Buscar reservaciones con monto pendiente que empezaron en este mes o antes
        const reservations = await Reservation.find({
            user: userId,
            status: { $ne: 'cancelled' },
            start: { $lte: monthEnd.toDate() }, // La reserva debe empezar en este mes o antes
            $or: [
                { montoPendiente: { $gt: 0 } },
                {
                    $and: [
                        { precioTotal: { $gt: 0 } },
                        { payments: { $size: 0 } }
                    ]
                }
            ]
        }).lean();

        let totalPendiente = 0;
        const reservasPendientes = [];

        reservations.forEach((reserva) => {
            const reservaStart = moment(reserva.start);

            // Solo procesar si la reserva empieza en este mes o antes
            if (reservaStart.isSameOrBefore(monthEnd)) {
                let montoPendiente = reserva.montoPendiente;
                if (!montoPendiente && reserva.precioTotal) {
                    const totalPagado = (reserva.payments || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
                    montoPendiente = reserva.precioTotal - totalPagado;
                }

                if (montoPendiente > 0) {
                    totalPendiente += montoPendiente;
                    console.log(`Reserva pendiente encontrada:`, {
                        huesped: reserva.name,
                        habitacion: reserva.room,
                        inicio: reservaStart.format('DD/MM/YYYY'),
                        fin: moment(reserva.end).format('DD/MM/YYYY'),
                        monto: montoPendiente
                    });

                    reservasPendientes.push({
                        id: reserva._id,
                        huesped: reserva.name,
                        habitacion: reserva.room,
                        precioTotal: reserva.precioTotal,
                        montoPendiente: montoPendiente,
                        checkIn: reservaStart.format('DD/MM/YYYY'),
                        checkOut: moment(reserva.end).format('DD/MM/YYYY')
                    });
                }
            }
        });

        console.log(`\nResumen de pendientes para ${monthStart.format('MMMM YYYY')}:`, {
            totalReservas: reservasPendientes.length,
            montoTotal: totalPendiente
        });

        res.json({
            success: true,
            data: {
                totals: {
                    efectivo: 0,
                    tarjeta: 0,
                    transferencia: 0,
                    pendiente: totalPendiente,
                    total: 0
                },
                reservasPendientes,
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

// Agregar este endpoint de prueba
router.get('/test-report', async (req, res) => {
    console.log('Test endpoint called');
    res.json({ message: 'Test endpoint working' });
});

module.exports = router;