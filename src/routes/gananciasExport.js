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
    'LIMPIEZA',
    'LAVANDERIA',
    'MANTENIMIENTO',
    'SERVICIOS',
    'INSUMOS',
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
    try {
        const { ingresos, gastosOrdinarios, gastosExtraordinarios, selectedMonth, selectedYear, userId, cajaAnterior } = req.body;

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
            $or: [
                // Caso 1: La reserva empieza en el mes
                {
                    start: { $gte: primerDiaMes.toDate(), $lte: ultimoDiaMes.toDate() }
                },
                // Caso 2: La reserva termina en el mes
                {
                    end: { $gte: primerDiaMes.toDate(), $lte: ultimoDiaMes.toDate() }
                },
                // Caso 3: La reserva abarca todo el mes
                {
                    start: { $lte: primerDiaMes.toDate() },
                    end: { $gte: ultimoDiaMes.toDate() }
                }
            ]
        });

        // 3. Calcular todos los valores necesarios
        const totalIngresos = ingresos
            .filter(ingreso => ['Efectivo', 'Tarjeta', 'Transferencia'].includes(ingreso.subcategoria))
            .reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0);

        const totalGastosOrd = gastosOrdinarios.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0);
        const totalGastosExt = gastosExtraordinarios.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0);

        const pendientesReservas = reservaciones.reduce((sum, reserva) => {
            return sum + (parseFloat(reserva.montoPendiente) || 0);
        }, 0);

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
                    new mongoose.Types.ObjectId(userId),
                    selectedMonth,
                    selectedYear
                );
            } else {
                console.error('Invalid userId format:', userId);
            }
        } catch (error) {
            console.error('Error calculating occupancy:', error);
        }

        // Calcular promedio de noches por reserva
        const totalNoches = reservaciones.reduce((sum, reserva) => {
            const inicio = moment(reserva.start);
            const fin = moment(reserva.end);
            return sum + fin.diff(inicio, 'days');
        }, 0);
        const promedioNoches = totalNoches / (reservaciones.length || 1);

        // Calcular estadísticas de métodos de pago
        const metodosStats = {};
        const reservasCruzadas = reservaciones.filter(reserva => {
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
        reservaciones.forEach(reserva => {
            const metodo = reserva.metodoPago || 'No especificado';
            metodosStats[metodo] = (metodosStats[metodo] || 0) + 1;
        });

        const totalReservaciones = reservaciones.length;

        // Calcular valores de caja con más precisión
        const cajaAnteriorNum = Number(parseFloat(cajaAnterior || 0).toFixed(2));
        const ingresosEfectivoNum = Number(
            ingresos
                .filter(i => i.subcategoria === 'Efectivo')
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

        const resultadoOperativo = facturacionTotal - totalGastosOrd - totalGastosExt;
        const resultadoNeto = resultadoOperativo; // El resultado neto es igual al operativo en este caso

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
            { concepto: 'Ingresos Totales', monto: facturacionTotal },
            { concepto: 'Gastos Ordinarios', monto: -totalGastosOrd },
            { concepto: 'Gastos Extraordinarios', monto: -totalGastosExt },
            { concepto: '', monto: null },
            { concepto: 'Resultado antes de Impuestos', monto: resultadoOperativo }
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
                    fgColor: { argb: resultadoOperativo >= 0 ? 'FFE8F5E9' : 'FFFFEBEE' }
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
            { header: 'Categoría', key: 'categoria', width: 25 },
            { header: 'Subcategoría', key: 'subcategoria', width: 45 },
            { header: 'Monto', key: 'monto', width: 15 },
            { header: 'Porcentaje', key: 'porcentaje', width: 15 }
        ];

        // Agregar título al inicio
        resumenSheet.insertRow(1, [tituloReporte]);
        resumenSheet.mergeCells('A1:D1');
        const titleRow = resumenSheet.getRow(1);
        titleRow.font = { bold: true, size: 14 };
        titleRow.alignment = { horizontal: 'center' };
        resumenSheet.addRow([]); // Espacio después del título

        // Datos para el resumen
        const datosResumen = [
            // === INGRESOS ===
            { categoria: 'INGRESOS', subcategoria: '', monto: null, porcentaje: null },
            ...ingresos
                .filter(ingreso => ['Efectivo', 'Tarjeta', 'Transferencia'].includes(ingreso.subcategoria))
                .map(ingreso => ({
                    categoria: '',
                    subcategoria: ingreso.subcategoria,
                    monto: parseFloat(ingreso.monto) || 0,
                    porcentaje: ((parseFloat(ingreso.monto) / totalIngresos) * 100).toFixed(2)
                })),
            { categoria: '', subcategoria: 'Total', monto: totalIngresos, porcentaje: 50.00 },
            { categoria: '', subcategoria: '', monto: null, porcentaje: null },

            // === PENDIENTES DE RESERVAS ===
            { categoria: 'PENDIENTES DE RESERVAS', subcategoria: '', monto: null, porcentaje: null },
            ...reservaciones
                .filter(reserva => parseFloat(reserva.montoPendiente) > 0)
                .map(reserva => ({
                    categoria: '',
                    subcategoria: `Hab ${reserva.room} - ${reserva.name || ''} ${reserva.surname || ''} (${moment(reserva.start).format('DD/MM/YYYY')} al ${moment(reserva.end).format('DD/MM/YYYY')})`,
                    monto: parseFloat(reserva.montoPendiente) || 0,
                    porcentaje: null
                })),
            {
                categoria: '',
                subcategoria: 'Total Pendiente de Cobro',
                monto: pendientesReservas,
                porcentaje: 50.00
            },
            { categoria: '', subcategoria: '', monto: null, porcentaje: null },

            // === FACTURACIÓN TOTAL ===
            { categoria: 'FACTURACIÓN TOTAL', subcategoria: '', monto: null, porcentaje: null },
            {
                categoria: '',
                subcategoria: 'Total Facturado (Pagado + Pendiente)',
                monto: facturacionTotal,
                porcentaje: 100.00
            },
            { categoria: '', subcategoria: '', monto: null, porcentaje: null },

            // === GASTOS ORDINARIOS ===
            { categoria: 'GASTOS ORDINARIOS', subcategoria: '', monto: null, porcentaje: null },
            ...tiposGastoOrdenados.map(tipo => {
                const gastosDelTipo = gastosOrdinarios.filter(g => g.tipo === tipo);
                const subtotal = gastosDelTipo.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
                return {
                    categoria: '',
                    subcategoria: tipo,
                    monto: subtotal,
                    porcentaje: ((subtotal / totalGastosOrd) * 100).toFixed(2)
                };
            }),
            {
                categoria: 'GASTOS ORDINARIOS',
                subcategoria: 'Total',
                monto: totalGastosOrd,
                porcentaje: ((totalGastosOrd / totalIngresos) * 100).toFixed(2)
            },
            { categoria: '', subcategoria: '', monto: null, porcentaje: null },

            // === GASTOS EXTRAORDINARIOS ===
            { categoria: 'GASTOS EXTRAORDINARIOS', subcategoria: '', monto: null, porcentaje: null },
            ...categorias.map(categoria => {
                const gastosDeCategoria = gastosExtraordinarios.filter(g => g.categoria === categoria);
                const subtotal = gastosDeCategoria.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
                return {
                    categoria: '',
                    subcategoria: categoria,
                    monto: subtotal,
                    porcentaje: ((subtotal / totalGastosExt) * 100).toFixed(2)
                };
            }),
            {
                categoria: 'GASTOS EXTRAORDINARIOS',
                subcategoria: 'Total',
                monto: totalGastosExt,
                porcentaje: ((totalGastosExt / totalIngresos) * 100).toFixed(2)
            },
            { categoria: '', subcategoria: '', monto: null, porcentaje: null },

            // === RESULTADO NETO ===
            {
                categoria: 'RESULTADO',
                subcategoria: 'NETO',
                monto: resultadoNeto,
                porcentaje: ((resultadoNeto / facturacionTotal) * 100).toFixed(2)
            },
            { categoria: '', subcategoria: '', monto: null, porcentaje: null }
        ];

        // Agregar datos al resumen
        datosResumen.forEach((item, index) => {
            const row = resumenSheet.addRow(item);

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
            { header: 'Tipo', key: 'tipo', width: 20 },
            { header: 'Categoría', key: 'categoria', width: 20 },
            { header: 'Concepto', key: 'concepto', width: 30 },
            { header: 'Fecha de Compra', key: 'fechaCompra', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
            { header: 'Monto', key: 'monto', width: 15 },
            { header: 'Método de Pago', key: 'metodoPago', width: 15 }
        ];

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

        // Agregar totales al final
        detalleGastosSheet.addRow({});
        const totalRow = detalleGastosSheet.addRow({
            tipo: 'TOTAL',
            categoria: '',
            concepto: '',
            fechaCompra: '',
            monto: totalGastosOrd + totalGastosExt,
            metodoPago: ''
        });
        totalRow.font = { bold: true };
        totalRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE8EAF6' }
        };

        // Formatear columna de montos
        detalleGastosSheet.getColumn('monto').numFmt = '"$"#,##0.00';

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
        tiposGastoOrdenados.forEach(tipo => {
            const headerRow = gastosSheet.addRow([tipo, '', '', '', '', '', '', '', '', '']);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE3F2FD' }
            };

            const gastosDelTipo = gastosOrdinarios.filter(g => g.tipo === tipo);
            gastosDelTipo.forEach(gasto => {
                gastosSheet.addRow({
                    tipo: gasto.tipo,
                    concepto: gasto.concepto,
                    fechaCompra: gasto.fechaCompra ? new Date(gasto.fechaCompra) : null,
                    fecha: gasto.tipo === 'HORAS_EXTRAS' ? new Date(gasto.fecha) : null,
                    turno: gasto.tipo === 'HORAS_EXTRAS' ? gasto.turno : '',
                    horas: gasto.tipo === 'HORAS_EXTRAS' ? gasto.cantidadHoras : '',
                    valorHora: gasto.tipo === 'HORAS_EXTRAS' ? gasto.valorHora : '',
                    periodo: gasto.tipo === 'AGUINALDO' ? `${gasto.periodo}° Semestre` : '',
                    monto: parseFloat(gasto.monto) || 0,
                    metodoPago: gasto.metodoPago
                });
            });

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

            gastosSheet.addRow({});
        });

        // Aplicar formato a las columnas numéricas
        gastosSheet.getColumn('monto').numFmt = '"$"#,##0.00';
        gastosSheet.getColumn('valorHora').numFmt = '"$"#,##0.00';

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

        // Hoja 3: Gastos Extraordinarios
        const gastosExtraSheet = workbook.addWorksheet('Gastos Extraordinarios');
        gastosExtraSheet.columns = [
            { header: 'Concepto', key: 'concepto', width: 30 },
            { header: 'Categoría', key: 'categoria', width: 20 },
            { header: 'Fecha de Compra', key: 'fechaCompra', width: 15, style: { numFmt: 'dd/mm/yyyy' } },
            { header: 'Monto', key: 'monto', width: 15 }
        ];

        categorias.forEach(categoria => {
            const headerRow = gastosExtraSheet.addRow(['', categoria, '', '']);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE3F2FD' }
            };

            const gastosDeCategoria = gastosExtraordinarios.filter(g => g.categoria === categoria);
            gastosDeCategoria.forEach(gasto => {
                gastosExtraSheet.addRow({
                    concepto: gasto.concepto,
                    categoria: gasto.categoria,
                    fechaCompra: gasto.fechaCompra ? new Date(gasto.fechaCompra) : null,
                    monto: gasto.monto
                });
            });

            const subtotal = gastosDeCategoria.reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
            const subtotalRow = gastosExtraSheet.addRow({
                concepto: `Subtotal ${categoria}`,
                categoria: '',
                fechaCompra: null,
                monto: subtotal
            });
            subtotalRow.font = { bold: true };
            subtotalRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE8EAF6' }
            };

            gastosExtraSheet.addRow({});
        });

        const totalRowExt = gastosExtraSheet.addRow({
            concepto: 'TOTAL GENERAL',
            categoria: '',
            fechaCompra: null,
            monto: totalGastosExt
        });
        totalRowExt.font = { bold: true };
        totalRowExt.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD1C4E9' }
        };

        // Aplicar formato a las columnas numéricas en todas las hojas
        [gastosSheet, gastosExtraSheet, detalleGastosSheet].forEach(sheet => {
            const montoColumn = sheet.getColumn('monto');
            if (montoColumn) {
                montoColumn.numFmt = '"$"#,##0.00';
            }
        });

        // Aplicar estilos comunes a todas las hojas
        [resumenSheet, gastosSheet, gastosExtraSheet, cajaSheet].forEach(sheet => {
            // El header ahora está en la fila 3 debido al título
            const headerRow = sheet.getRow(3);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4167B1' }
            };

            // Estilo para la fila del título
            const titleRow = sheet.getRow(1);
            titleRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE3F2FD' }
            };

            sheet.columns.forEach(column => {
                if (column.key === 'monto') {
                    if (column.header === 'Promedio Noches por Reserva' ||
                        column.header === 'Promedio Diario Ocupación') {
                        column.numFmt = '#,##0.00';
                    } else {
                        column.numFmt = '"$"#,##0.00';
                    }
                }
                if (column.key === 'porcentaje') {
                    column.numFmt = '#,##0.00"%"';
                }
            });

            // Aplicar formato especial a las filas de ocupación
            if (sheet === resumenSheet) {
                sheet.eachRow((row, rowNumber) => {
                    const subcategoria = row.getCell('subcategoria').value;
                    if (subcategoria === 'Días Ocupados' || subcategoria === 'Promedio Diario') {
                        row.getCell('monto').numFmt = '#,##0.00';
                    }
                });
            }

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

        // Generar el archivo
        const buffer = await workbook.xlsx.writeBuffer();

        // Configurar headers de respuesta
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename=reporte-ganancias-${moment().format('YYYYMMDD')}.xlsx`,
            'Content-Length': buffer.length
        });

        // Enviar el archivo
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