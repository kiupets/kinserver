// Guarda esto como kinserver/basic-server.js
const express = require('express');
const app = express();
const cors = require('cors');

// Configuración CORS básica
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// Ruta básica para probar
app.get('/test', (req, res) => {
  res.json({ message: 'Servidor funcionando correctamente' });
});

// Ruta de autenticación
app.post('/auth/ganancias', (req, res) => {
  res.json({ success: true, token: 'test-token' });
});

app.post('/auth/reportes', (req, res) => {
  res.json({ success: true, token: 'test-token' });
});

// Iniciar servidor
const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Servidor básico funcionando en puerto ${PORT}`);
});