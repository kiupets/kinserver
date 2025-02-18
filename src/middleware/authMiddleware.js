const authMiddleware = (req, res, next) => {
    // Verificar si el usuario está autenticado a través de la sesión
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ message: 'No autorizado. Por favor, inicie sesión.' });
    }
};

module.exports = {
    authMiddleware
}; 