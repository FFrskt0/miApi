const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Proveedor = sequelize.define('Proveedor', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    razon_social: {
        type: DataTypes.STRING,
        allowNull: false
    },
    contacto: {
        type: DataTypes.STRING,
        allowNull: true
    },
    telefono: {
        type: DataTypes.STRING,
        allowNull: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'proveedores',
    timestamps: false
});

module.exports = Proveedor;