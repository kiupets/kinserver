// // Configuración CORS más permisiva para desarrollo
// const corsOptions = {
//   origin: function (origin, callback) {
//     console.log('Request from origin:', origin);

//     // Permitir requests sin origin (como Postman o herramientas de desarrollo)
//     if (!origin) {
//       return callback(null, true);
//     }

//     if (allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       console.log('Origin not allowed:', origin);
//       callback(new Error('Origin not allowed by CORS'));
//     }
//   },
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: [
//     // 'Origin',
//     'X-Requested-With',
//     'Content-Type',
//     'Accept',
//     'Authorization'
//   ],
//   exposedHeaders: ['Content-Disposition']
// };
// app.use((req, res, next) => {
//   console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
//   console.log('Origin:', req.headers.origin);
//   console.log('Headers:', req.headers);
//   next();
// });
// // Aplicar configuración CORS
// app.use(cors(corsOptions));
// CORS configuration