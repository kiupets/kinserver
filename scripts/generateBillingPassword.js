const bcrypt = require('bcrypt');

const password = '123456'; // Contraseña simple para pruebas
bcrypt.hash(password, 10).then(hash => {
    console.log('Hash para BILLING_PASSWORD_HASH:', hash);
}); 