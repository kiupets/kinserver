const bcrypt = require('bcrypt');

const password = 'kin2025';

bcrypt.hash(password, 10).then(hash => {
    console.log('Hash para GANANCIAS_PASSWORD_HASH:', hash);
}).catch(err => {
    console.error('Error generando el hash:', err);
}); 