const sequelize = require('../config/db');
const Categoria = require('./Categoria');
const Proveedor = require('./Proveedor');
const Usuario = require('./Usuario');
const Producto = require('./Producto');
const Movimiento = require('./Movimiento');

// Categoria 1:N Producto
Categoria.hasMany(Producto, { foreignKey: 'categoria_id', as: 'productos', onDelete: 'SET NULL' });
Producto.belongsTo(Categoria, { foreignKey: 'categoria_id', as: 'categoria' });

// Proveedor 1:N Producto
Proveedor.hasMany(Producto, { foreignKey: 'proveedor_id', as: 'productos', onDelete: 'SET NULL' });
Producto.belongsTo(Proveedor, { foreignKey: 'proveedor_id', as: 'proveedor' });

// Producto 1:N Movimiento
Producto.hasMany(Movimiento, { foreignKey: 'producto_id', as: 'movimientos', onDelete: 'CASCADE' });
Movimiento.belongsTo(Producto, { foreignKey: 'producto_id', as: 'producto' });

// Usuario 1:N Movimiento
Usuario.hasMany(Movimiento, { foreignKey: 'usuario_id', as: 'movimientos', onDelete: 'CASCADE' });
Movimiento.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario' });

module.exports = {
    sequelize,
    Categoria,
    Proveedor,
    Usuario,
    Producto,
    Movimiento
};