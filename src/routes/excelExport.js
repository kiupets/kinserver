
// const express = require('express');
// const router = express.Router();
// const ExcelJS = require('exceljs');
// const XLSX = require('xlsx');
// const Reservation = require('../models/Reservation');

// // Version 1: Using ExcelJS
// router.get('/export-exceljs', async (req, res) => {
//     try {
//         const userId = req.query.userId;
//         if (!userId) {
//             return res.status(400).json({ message: "User ID is required" });
//         }

//         // Fetch reservations from database
//         const reservations = await Reservation.find({ user: userId });

//         // Create a new workbook and worksheet   
//         const workbook = new ExcelJS.Workbook();
//         const worksheet = workbook.addWorksheet('Reservaciones');

//         // Define columns
//         worksheet.columns = [
//             { header: 'Nombre', key: 'name', width: 20 },
//             { header: 'Apellido', key: 'surname', width: 20 },
//             { header: 'Noches', key: 'nights', width: 10 },
//             { header: 'Habitación', key: 'room', width: 15 },
//             { header: 'Efectivo', key: 'efectivo', width: 15 },
//             { header: 'Tarjeta', key: 'tarjeta', width: 15 },
//             { header: 'Transferencia', key: 'transferencia', width: 15 }
//         ];

//         // Add rows
//         reservations.forEach(reservation => {
//             worksheet.addRow({
//                 name: reservation.name,
//                 surname: reservation.surname,
//                 nights: reservation.nights,
//                 room: reservation.room,
//                 efectivo: reservation.paymentMethod === 'efectivo' ? reservation.precioTotal : 0,
//                 tarjeta: reservation.paymentMethod === 'tarjeta' ? reservation.precioTotal : 0,
//                 transferencia: reservation.paymentMethod === 'deposito' ? reservation.precioTotal : 0
//             });
//         });

//         // Style the header row
//         worksheet.getRow(1).font = { bold: true };
//         worksheet.getRow(1).fill = {
//             type: 'pattern',
//             pattern: 'solid',
//             fgColor: { argb: 'FFE0E0E0' }
//         };

//         // Set response headers
//         res.setHeader(
//             'Content-Type',
//             'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
//         );
//         res.setHeader(
//             'Content-Disposition',
//             'attachment; filename=reservaciones.xlsx'
//         );

//         // Write to response
//         await workbook.xlsx.write(res);
//         res.end();

//     } catch (error) {
//         console.error('Error exporting Excel:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // Version 2: Using XLSX
// router.get('/export-xlsx', async (req, res) => {
//     try {
//         const userId = req.query.userId;
//         if (!userId) {
//             return res.status(400).json({ message: "User ID is required" });
//         }

//         // Fetch reservations from database
//         const reservations = await Reservation.find({ user: userId });

//         // Transform data for Excel
//         const excelData = reservations.map(reservation => ({
//             'Nombre': reservation.name,
//             'Apellido': reservation.surname,
//             'Noches': reservation.nights,
//             'Habitación': reservation.room,
//             'Efectivo': reservation.paymentMethod === 'efectivo' ? reservation.precioTotal : 0,
//             'Tarjeta': reservation.paymentMethod === 'tarjeta' ? reservation.precioTotal : 0,
//             'Transferencia': reservation.paymentMethod === 'deposito' ? reservation.precioTotal : 0
//         }));

//         // Create workbook and worksheet
//         const workbook = XLSX.utils.book_new();
//         const worksheet = XLSX.utils.json_to_sheet(excelData);

//         // Add worksheet to workbook
//         XLSX.utils.book_append_sheet(workbook, worksheet, 'Reservaciones');

//         // Generate Excel file buffer
//         const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

//         // Set response headers
//         res.setHeader(
//             'Content-Type',
//             'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
//         );
//         res.setHeader(
//             'Content-Disposition',
//             'attachment; filename=reservaciones.xlsx'
//         );

//         // Send response
//         res.send(excelBuffer);

//     } catch (error) {
//         console.error('Error exporting Excel:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// module.exports = router;

const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const moment = require('moment');
const Reservation = require('../models/Reservation');

router.get('/export-detailed', async (req, res) => {
    try {
        const { userId, reportType, startDate, endDate } = req.query;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        // Log the query parameters
        console.log('Query parameters:', { userId, startDate, endDate, reportType });

        // Build date range query based on reportType
        const dateQuery = {};
        if (startDate && endDate) {
            dateQuery.start = {
                $gte: moment(startDate).startOf('day').toDate(),
                $lte: moment(endDate).endOf('day').toDate()
            };
        }

        // Log the date query
        console.log('Date query:', dateQuery);

        // Fetch reservations
        const reservations = await Reservation.find({
            user: userId,
            ...dateQuery
        }).sort({ start: 1 });

        // Log the fetched reservations
        console.log('Fetched reservations:', reservations);

        if (reservations.length === 0) {
            return res.status(404).json({ message: "No reservations found for the specified user and date range" });
        }

        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Hotel Management System';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Reservaciones', {
            properties: { tabColor: { argb: '4167B1' } }
        });

        // Define columns
        worksheet.columns = [
            { header: 'Fecha', key: 'date', width: 15 },
            { header: 'Nombre', key: 'name', width: 20 },
            { header: 'Apellido', key: 'surname', width: 20 },
            { header: 'Habitación', key: 'room', width: 12 },
            { header: 'Noches', key: 'nights', width: 10 },
            { header: 'Check-in', key: 'checkIn', width: 15 },
            { header: 'Check-out', key: 'checkOut', width: 15 },
            { header: 'Efectivo', key: 'cash', width: 15 },
            { header: 'Tarjeta', key: 'card', width: 15 },
            { header: 'Transferencia', key: 'transfer', width: 15 },
            { header: 'Total', key: 'total', width: 15 },
            { header: 'Estado', key: 'status', width: 15 }
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4167B1' }
        };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Add data rows
        let totalCash = 0;
        let totalCard = 0;
        let totalTransfer = 0;

        reservations.forEach(reservation => {
            const row = worksheet.addRow({
                date: moment(reservation.createdAt).format('YYYY-MM-DD'),
                name: reservation.name || '',
                surname: reservation.surname || '',
                room: reservation.room.join(', ') || '',
                nights: reservation.nights || 0,
                checkIn: moment(reservation.start).format('YYYY-MM-DD'),
                checkOut: moment(reservation.end).format('YYYY-MM-DD'),
                cash: reservation.paymentMethod === 'efectivo' ? reservation.precioTotal : 0,
                card: reservation.paymentMethod === 'tarjeta' ? reservation.precioTotal : 0,
                transfer: reservation.paymentMethod === 'transferencia' ? reservation.precioTotal : 0,
                total: reservation.precioTotal,
                status: reservation.billingStatus || ''
            });

            // Alternate row colors
            row.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: row.number % 2 ? 'F5F5F5' : 'FFFFFF' }
            };

            // Update totals
            if (reservation.paymentMethod === 'efectivo') totalCash += reservation.precioTotal;
            if (reservation.paymentMethod === 'tarjeta') totalCard += reservation.precioTotal;
            if (reservation.paymentMethod === 'transferencia') totalTransfer += reservation.precioTotal;
        });

        // Add totals row
        const totalsRow = worksheet.addRow({
            name: 'TOTALES',
            cash: totalCash,
            card: totalCard,
            transfer: totalTransfer,
            total: totalCash + totalCard + totalTransfer
        });

        // Style totals row
        totalsRow.font = { bold: true };
        totalsRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'E6E6E6' }
        };

        // Format number columns
        ['H', 'I', 'J', 'K'].forEach(col => {
            worksheet.getColumn(col).numFmt = '"$"#,##0.00';
            worksheet.getColumn(col).alignment = { horizontal: 'right' };
        });

        // Add borders
        worksheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Add report metadata
        worksheet.addRow([]);
        worksheet.addRow(['Reporte generado:', moment().format('DD/MM/YYYY HH:mm:ss')]);
        worksheet.addRow(['Período:', `${moment(startDate).format('DD/MM/YYYY')} - ${moment(endDate).format('DD/MM/YYYY')}`]);

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=reporte-${moment().format('YYYY-MM-DD')}.xlsx`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error exporting Excel:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;