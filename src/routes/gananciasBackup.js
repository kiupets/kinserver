const express = require('express');
const router = express.Router();
const GananciasBackup = require('../models/GananciasBackup');
const Ganancias = require('../models/Ganancias');

// Obtener lista de backups disponibles
router.get('/backups/:userId/:month/:year', async (req, res) => {
    try {
        const { userId, month, year } = req.params;
        const backups = await GananciasBackup.find({ userId, month, year })
            .sort({ createdAt: -1 })
            .select('-data')  // No enviamos los datos completos, solo metadatos
            .limit(5);

        res.json(backups);
    } catch (error) {
        console.error('Error obteniendo backups:', error);
        res.status(500).json({ message: 'Error obteniendo backups', error: error.message });
    }
});

// Restaurar un backup específico
router.post('/restore-backup/:backupId', async (req, res) => {
    try {
        const { backupId } = req.params;
        const backup = await GananciasBackup.findById(backupId);

        if (!backup) {
            return res.status(404).json({ message: 'Backup no encontrado' });
        }

        // Restaurar los datos
        await Ganancias.findOneAndUpdate(
            {
                userId: backup.userId,
                month: backup.month,
                year: backup.year
            },
            backup.data,
            { new: true, upsert: true }
        );

        res.json({ message: 'Backup restaurado exitosamente' });
    } catch (error) {
        console.error('Error restaurando backup:', error);
        res.status(500).json({ message: 'Error restaurando backup', error: error.message });
    }
});

module.exports = router; 