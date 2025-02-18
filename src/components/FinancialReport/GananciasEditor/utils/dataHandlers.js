// Procesar gastos extraordinarios para asegurar que tengan el formato correcto
const processedGastosExtraordinarios = gastosExtraordinarios.map(gasto => ({
    categoria: gasto.categoria,
    concepto: gasto.concepto,
    descripcion: gasto.descripcion || '', // Se agrega la propiedad "descripcion"
    monto: parseFloat(gasto.monto) || 0,
    metodoPago: gasto.metodoPago || 'EFECTIVO',
    fechaCompra: gasto.fechaCompra || new Date().toISOString().split('T')[0]
})); 