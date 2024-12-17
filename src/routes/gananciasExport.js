const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const moment = require('moment');
const Reservation = require('../models/Reservation');
const calcularOcupacionMensual = require('../utils/occupancyCalculator')

// Función para calcular ocupación de noviembre
// const calcularOcupacionNoviembre = async () => {
//     const TOTAL_HABITACIONES = 15;
//     const noviembre = moment('2024-11-01');
//     const primerDiaMes = noviembre.startOf('month').toDate();
//     const ultimoDiaMes = noviembre.endOf('month').toDate();
//     const diasEnMes = noviembre.daysInMonth();

//     try {
//         const reservaciones = await Reservation.find({
//             $or: [
//                 { start: { $gte: primerDiaMes, $lte: ultimoDiaMes } },
//                 { end: { $gte: primerDiaMes, $lte: ultimoDiaMes } },
//                 { start: { $lte: primerDiaMes }, end: { $gte: ultimoDiaMes } }
//             ]
//         });

//         const ocupacionDiaria = Array(diasEnMes).fill(0);

//         reservaciones.forEach(reservacion => {
//             const startDate = moment.max(moment(reservacion.start), moment(primerDiaMes));
//             const endDate = moment.min(moment(reservacion.end), moment(ultimoDiaMes));

//             let currentDate = moment(startDate);
//             while (currentDate.isSameOrBefore(endDate)) {
//                 const diaDelMes = currentDate.date() - 1;
//                 ocupacionDiaria[diaDelMes] += reservacion.room.length;
//                 currentDate.add(1, 'days');
//             }
//         });

//         const totalOcupacionMes = ocupacionDiaria.reduce((sum, hab) => sum + hab, 0);
//         const habitacionesDisponiblesMes = TOTAL_HABITACIONES * diasEnMes;
//         const porcentajeOcupacion = (totalOcupacionMes / habitacionesDisponiblesMes) * 100;

//         return {
//             porcentajeOcupacion,
//             ocupacionDiaria,
//             diasOcupados: ocupacionDiaria.filter(x => x > 0).length,
//             promedioOcupacionDiaria: totalOcupacionMes / diasEnMes
//         };
//     } catch (error) {
//         console.error('Error calculando ocupación:', error);
//         return {
//             porcentajeOcupacion: 0,
//             ocupacionDiaria: Array(diasEnMes).fill(0),
//             diasOcupados: 0,
//             promedioOcupacionDiaria: 0
//         };
//     }
// };

// Endpoint para exportar el reporte de ganancias
router.post('/export-ganancias', async (req, res) => {
    try {
        const { ingresos, gastosOrdinarios, gastosExtraordinarios, selectedMonth } = req.body;
        const currentYear = new Date().getFullYear();

        console.log('Datos recibidos:', { selectedMonth, currentYear });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Sistema de Ganancias';
        workbook.lastModifiedBy = 'Sistema de Ganancias';
        workbook.created = new Date();
        workbook.modified = new Date();

        // Calcular estadísticas de ocupación
        const estadisticasOcupacion = await calcularOcupacionMensual(selectedMonth || moment().format('MM'), currentYear);

        // Calcular totales
        const totalIngresos = ingresos.reduce((sum, item) => sum + item.monto, 0);
        const totalGastosOrd = gastosOrdinarios.reduce((sum, item) => sum + item.monto, 0);
        const totalGastosExt = gastosExtraordinarios.reduce((sum, item) => sum + item.monto, 0);

        // Obtener categorías únicas
        const tiposGasto = [...new Set(gastosOrdinarios.map(g => g.tipo))].sort();
        const categorias = [...new Set(gastosExtraordinarios.map(g => g.categoria))].sort();

        // Hoja 1: Resumen Financiero
        const resumenSheet = workbook.addWorksheet('Resumen Financiero');
        resumenSheet.columns = [
            { header: 'Categoría', key: 'categoria', width: 25 },
            { header: 'Subcategoría', key: 'subcategoria', width: 20 },
            { header: 'Monto', key: 'monto', width: 15 },
            { header: 'Porcentaje', key: 'porcentaje', width: 15 }
        ];

        // Datos para el resumen
        const datosResumen = [
            // === INGRESOS ===
            ...ingresos.map(item => ({
                categoria: 'INGRESOS',
                subcategoria: item.subcategoria,
                monto: item.monto,
                porcentaje: ((item.monto / totalIngresos) * 100).toFixed(2)
            })),
            { categoria: 'INGRESOS', subcategoria: 'Total', monto: totalIngresos, porcentaje: '100.00' },
            { categoria: '', subcategoria: '', monto: null, porcentaje: null },

            // === GASTOS ORDINARIOS ===
            { categoria: 'GASTOS ORDINARIOS', subcategoria: '', monto: null, porcentaje: null },
            ...tiposGasto.map(tipo => {
                const gastosDelTipo = gastosOrdinarios.filter(g => g.tipo === tipo);
                const subtotal = gastosDelTipo.reduce((sum, g) => sum + g.monto, 0);
                return {
                    categoria: '',
                    subcategoria: tipo,
                    monto: subtotal,
                    porcentaje: ((subtotal / totalGastosOrd) * 100).toFixed(2)
                };
            }),
            { categoria: 'GASTOS ORDINARIOS', subcategoria: 'Total', monto: totalGastosOrd, porcentaje: ((totalGastosOrd / totalIngresos) * 100).toFixed(2) },
            { categoria: '', subcategoria: '', monto: null, porcentaje: null },

            // === GASTOS EXTRAORDINARIOS ===
            { categoria: 'GASTOS EXTRAORDINARIOS', subcategoria: '', monto: null, porcentaje: null },
            ...categorias.map(categoria => {
                const gastosDeCategoria = gastosExtraordinarios.filter(g => g.categoria === categoria);
                const subtotal = gastosDeCategoria.reduce((sum, g) => sum + g.monto, 0);
                return {
                    categoria: '',
                    subcategoria: categoria,
                    monto: subtotal,
                    porcentaje: ((subtotal / totalGastosExt) * 100).toFixed(2)
                };
            }),
            { categoria: 'GASTOS EXTRAORDINARIOS', subcategoria: 'Total', monto: totalGastosExt, porcentaje: ((totalGastosExt / totalIngresos) * 100).toFixed(2) },
            { categoria: '', subcategoria: '', monto: null, porcentaje: null },

            // === OCUPACIÓN NOVIEMBRE 2023 ===
            { categoria: 'OCUPACIÓN NOVIEMBRE 2024', subcategoria: '', monto: null, porcentaje: null },
            { categoria: '', subcategoria: 'Porcentaje Ocupación', monto: null, porcentaje: estadisticasOcupacion.porcentajeOcupacion.toFixed(2) },
            { categoria: '', subcategoria: 'Días Ocupados', monto: estadisticasOcupacion.diasOcupados, porcentaje: ((estadisticasOcupacion.diasOcupados / 30) * 100).toFixed(2) },
            { categoria: '', subcategoria: 'Promedio Diario', monto: null, porcentaje: estadisticasOcupacion.promedioOcupacionDiaria.toFixed(2) },
            { categoria: '', subcategoria: '', monto: null, porcentaje: null },

            // === RESULTADO NETO ===
            {
                categoria: 'RESULTADO',
                subcategoria: 'NETO',
                monto: totalIngresos - totalGastosOrd - totalGastosExt,
                porcentaje: (((totalIngresos - totalGastosOrd - totalGastosExt) / totalIngresos) * 100).toFixed(2)
            }
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
        });

        // Hoja 2: Gastos Ordinarios
        const gastosSheet = workbook.addWorksheet('Gastos Ordinarios');
        gastosSheet.columns = [
            { header: 'Tipo', key: 'tipo', width: 20 },
            { header: 'Concepto', key: 'concepto', width: 30 },
            { header: 'Monto', key: 'monto', width: 15 }
        ];

        // Agregar gastos ordinarios agrupados por tipo
        tiposGasto.forEach(tipo => {
            const headerRow = gastosSheet.addRow([tipo, '', '']);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE3F2FD' }
            };

            const gastosDelTipo = gastosOrdinarios.filter(g => g.tipo === tipo);
            gastosDelTipo.forEach(gasto => {
                gastosSheet.addRow(gasto);
            });

            const subtotal = gastosDelTipo.reduce((sum, g) => sum + g.monto, 0);
            const subtotalRow = gastosSheet.addRow({
                tipo: `Subtotal ${tipo}`,
                concepto: '',
                monto: subtotal
            });
            subtotalRow.font = { bold: true };
            subtotalRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE8EAF6' }
            };

            gastosSheet.addRow({});
        });

        const totalRowOrd = gastosSheet.addRow({
            tipo: 'TOTAL GENERAL',
            concepto: '',
            monto: totalGastosOrd
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
            { header: 'Monto', key: 'monto', width: 15 }
        ];

        categorias.forEach(categoria => {
            const headerRow = gastosExtraSheet.addRow(['', categoria, '']);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE3F2FD' }
            };

            const gastosDeCategoria = gastosExtraordinarios.filter(g => g.categoria === categoria);
            gastosDeCategoria.forEach(gasto => {
                gastosExtraSheet.addRow(gasto);
            });

            const subtotal = gastosDeCategoria.reduce((sum, g) => sum + g.monto, 0);
            const subtotalRow = gastosExtraSheet.addRow({
                concepto: `Subtotal ${categoria}`,
                categoria: '',
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
            monto: totalGastosExt
        });
        totalRowExt.font = { bold: true };
        totalRowExt.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD1C4E9' }
        };

        // Aplicar estilos comunes a todas las hojas
        [resumenSheet, gastosSheet, gastosExtraSheet].forEach(sheet => {
            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4167B1' }
            };

            sheet.columns.forEach(column => {
                if (column.key === 'monto') {
                    column.numFmt = '"$"#,##0.00';
                }
                if (column.key === 'porcentaje') {
                    column.numFmt = '0.00"%"';
                }
            });

            sheet.eachRow({ includeEmpty: false }, row => {
                row.eachCell({ includeEmpty: false }, cell => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
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
        console.error('Error generando Excel de ganancias:', error);
        res.status(500).json({
            message: "Error generando Excel de ganancias",
            error: error.message
        });
    }
});

module.exports = router;