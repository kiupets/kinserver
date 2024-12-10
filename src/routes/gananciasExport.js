const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const moment = require('moment');

// Endpoint para exportar el reporte de ganancias
router.post('/export-ganancias', async (req, res) => {
    try {
        const { ingresos, gastosOrdinarios, gastosExtraordinarios } = req.body;
        const workbook = new ExcelJS.Workbook();

        // Configuración general del workbook
        workbook.creator = 'Sistema de Ganancias';
        workbook.lastModifiedBy = 'Sistema de Ganancias';
        workbook.created = new Date();
        workbook.modified = new Date();

        // Hoja 1: Resumen Financiero
        const resumenSheet = workbook.addWorksheet('Resumen Financiero');
        resumenSheet.columns = [
            { header: 'Categoría', key: 'categoria', width: 25 },
            { header: 'Subcategoría', key: 'subcategoria', width: 20 },
            { header: 'Monto', key: 'monto', width: 15 },
            { header: 'Porcentaje', key: 'porcentaje', width: 15 }
        ];

        // Calcular totales
        const totalIngresos = ingresos.reduce((sum, item) => sum + item.monto, 0);
        const totalGastosOrd = gastosOrdinarios.reduce((sum, item) => sum + item.monto, 0);
        const totalGastosExt = gastosExtraordinarios.reduce((sum, item) => sum + item.monto, 0);

        // Datos para el resumen
        const datosResumen = [
            ...ingresos.map(item => ({
                categoria: 'INGRESOS',
                subcategoria: item.subcategoria,
                monto: item.monto,
                porcentaje: ((item.monto / totalIngresos) * 100).toFixed(2)
            })),
            { categoria: 'INGRESOS', subcategoria: 'Total', monto: totalIngresos, porcentaje: '100.00' },
            { categoria: '', subcategoria: '', monto: null, porcentaje: null },
            { categoria: 'GASTOS ORDINARIOS', subcategoria: 'Total', monto: totalGastosOrd, porcentaje: ((totalGastosOrd / totalIngresos) * 100).toFixed(2) },
            { categoria: 'GASTOS EXTRAORDINARIOS', subcategoria: 'Total', monto: totalGastosExt, porcentaje: ((totalGastosExt / totalIngresos) * 100).toFixed(2) },
            { categoria: '', subcategoria: '', monto: null, porcentaje: null },
            {
                categoria: 'RESULTADO',
                subcategoria: 'NETO',
                monto: totalIngresos - totalGastosOrd - totalGastosExt,
                porcentaje: (((totalIngresos - totalGastosOrd - totalGastosExt) / totalIngresos) * 100).toFixed(2)
            }
        ];

        // Agregar datos al resumen
        datosResumen.forEach(item => {
            resumenSheet.addRow(item);
        });

        // Hoja 2: Gastos Ordinarios
        const gastosSheet = workbook.addWorksheet('Gastos Ordinarios');
        gastosSheet.columns = [
            { header: 'Tipo', key: 'tipo', width: 20 },
            { header: 'Concepto', key: 'concepto', width: 30 },
            { header: 'Monto', key: 'monto', width: 15 }
        ];

        // Agregar gastos ordinarios agrupados por tipo
        const tiposGasto = [...new Set(gastosOrdinarios.map(g => g.tipo))];

        tiposGasto.forEach(tipo => {
            // Agregar título del tipo
            const headerRow = gastosSheet.addRow([tipo, '', '']);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE3F2FD' }
            };

            // Agregar gastos de este tipo
            const gastosDelTipo = gastosOrdinarios.filter(g => g.tipo === tipo);
            gastosDelTipo.forEach(gasto => {
                gastosSheet.addRow(gasto);
            });

            // Agregar subtotal
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

            // Agregar fila vacía después de cada grupo
            gastosSheet.addRow({});
        });

        // Agregar total general de gastos ordinarios
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

        // Agregar gastos extraordinarios agrupados por categoría
        const categorias = [...new Set(gastosExtraordinarios.map(g => g.categoria))];

        categorias.forEach(categoria => {
            // Agregar título de la categoría
            const headerRow = gastosExtraSheet.addRow(['', categoria, '']);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE3F2FD' }
            };

            // Agregar gastos de esta categoría
            const gastosDeCategoria = gastosExtraordinarios.filter(g => g.categoria === categoria);
            gastosDeCategoria.forEach(gasto => {
                gastosExtraSheet.addRow(gasto);
            });

            // Agregar subtotal
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

            // Agregar fila vacía después de cada grupo
            gastosExtraSheet.addRow({});
        });

        // Agregar total general de gastos extraordinarios
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
            // Estilo para encabezados
            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4167B1' }
            };

            // Formato de moneda y porcentaje
            sheet.columns.forEach(column => {
                if (column.key === 'monto') {
                    column.numFmt = '"$"#,##0.00';
                }
                if (column.key === 'porcentaje') {
                    column.numFmt = '0.00"%"';
                }
            });

            // Bordes para todas las celdas con contenido
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
        console.error('Error generando Excel de ganancias:', error);
        res.status(500).json({
            message: "Error generando Excel de ganancias",
            error: error.message
        });
    }
});

module.exports = router;