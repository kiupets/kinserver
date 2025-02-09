const express = require('express');
const router = express.Router();

// POST /auth/ingresos-auth
router.post('/ingresos-auth', (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ success: false, message: 'La contraseña es requerida.' });
    }

    // Compare the provided password with the secure backend environment variable
    if (password === process.env.INGRESOS_PASSWORD) {
        // Optionally, set a session flag if needed
        req.session.ingresosAuth = true;
        return res.status(200).json({ success: true, message: 'Autenticado correctamente.' });
    } else {
        return res.status(401).json({ success: false, message: 'Contraseña incorrecta.' });
    }
});

module.exports = router; 