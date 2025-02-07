const bcrypt = require('bcrypt');
const password = 'kinhotel2024';

bcrypt.hash(password, 10).then(hash => {
    console.log('Hash para usar en BILLING_PASSWORD_HASH:', hash);
});