const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// Endpoint para autenticar la contraseña de ganancias
// Se espera que el cliente envíe { password: "..." } en el body.
router.post('/ganancias/auth', async (req, res) => {
    console.log(">>> [GANANCIAS AUTH] Request recibido:", { body: req.body });
    console.log(">>> [GANANCIAS AUTH] Current NODE_ENV:", process.env.NODE_ENV);
    console.log(">>> [GANANCIAS AUTH] Current working directory:", process.cwd());

    const { password } = req.body;
    if (!password) {
        console.log("<<< [GANANCIAS AUTH] No se recibió password");
        return res.status(400).json({ success: false, message: "La contraseña es obligatoria" });
    }
    console.log(">>> [GANANCIAS AUTH] Password recibido de longitud:", password.length);

    // Obtener el hash definido en .env
    const hash = process.env.GANANCIAS_PASSWORD_HASH;
    if (!hash) {
        console.error(">>> [GANANCIAS AUTH] ERROR: La variable de entorno GANANCIAS_PASSWORD_HASH no está definida. Revise su .env");
        return res.status(500).json({ success: false, message: "Error de configuración en el servidor" });
    }
    console.log(">>> [GANANCIAS AUTH] Hash obtenido del .env, longitud:", hash.length);

    try {
        const isValid = await bcrypt.compare(password, hash);
        if (isValid) {
            console.log(">>> [GANANCIAS AUTH] Contraseña correcta");
            return res.status(200).json({ success: true, message: "Autenticación exitosa" });
        } else {
            console.log(">>> [GANANCIAS AUTH] Contraseña incorrecta");
            return res.status(401).json({ success: false, message: "Contraseña incorrecta" });
        }
    } catch (error) {
        console.error(">>> [GANANCIAS AUTH] Error al comparar contraseñas:", error);
        return res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
});

module.exports = router; 