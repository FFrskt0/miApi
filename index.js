const express = require('express');
const cors = require('cors');
require('dotenv').config();

const {
    sequelize,
    Categoria,
    Proveedor,
    Usuario,
    Producto,
    Movimiento
} = require('./models');

const app = express();

app.use(cors());
app.use(express.json());

// --- ENDPOINT DASHBOARD (KPIs) ---
app.get('/dashboard', async (req, res) => {
    try {
        const totalProductos = await Producto.count();
        const totalCategorias = await Categoria.count();
        const totalProveedores = await Proveedor.count();
        const bajoStock = await Producto.count({
            where: {
                stock: { [sequelize.Sequelize.Op.lte]: 5 }
            }
        });

        const movimientosRecientes = await Movimiento.findAll({
            limit: 5,
            order: [['fecha_hora', 'DESC']],
            include: [
                { model: Producto, as: 'producto', attributes: ['nombre'] },
                { model: Usuario, as: 'usuario', attributes: ['nombre'] }
            ]
        });

        res.json({
            totalProductos,
            totalCategorias,
            totalProveedores,
            bajoStock,
            movimientosRecientes
        });
    } catch (error) {
        console.error('Error al cargar dashboard:', error);
        res.status(500).json({ error: 'Error al cargar dashboard' });
    }
});

// --- CRUD CATEGORIAS ---
app.get('/categorias', async (req, res) => {
    try {
        const categorias = await Categoria.findAll();
        res.json(categorias);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/categorias', async (req, res) => {
    try {
        const categoria = await Categoria.create(req.body);
        res.status(201).json(categoria);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/categorias/:id', async (req, res) => {
    try {
        const categoria = await Categoria.findByPk(req.params.id);
        if (!categoria) return res.status(404).json({ error: 'Categoría no encontrada' });
        await categoria.update(req.body);
        res.json(categoria);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/categorias/:id', async (req, res) => {
    try {
        const categoria = await Categoria.findByPk(req.params.id);
        if (!categoria) return res.status(404).json({ error: 'Categoría no encontrada' });
        await categoria.destroy();
        res.json({ mensaje: 'Categoría eliminada' });
    } catch (error) {
        res.status(400).json({ error: 'No se pudo eliminar la categoría. Puede estar asignada a productos.' });
    }
});

// --- CRUD PROVEEDORES ---
app.get('/proveedores', async (req, res) => {
    try {
        const proveedores = await Proveedor.findAll();
        res.json(proveedores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/proveedores', async (req, res) => {
    try {
        const proveedor = await Proveedor.create(req.body);
        res.status(201).json(proveedor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- CRUD USUARIOS ---
app.get('/usuarios', async (req, res) => {
    try {
        const usuarios = await Usuario.findAll({
            attributes: { exclude: ['password'] }
        });
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/usuarios', async (req, res) => {
    try {
        const usuario = await Usuario.create(req.body);
        res.status(201).json(usuario);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- CRUD PRODUCTOS (Con include de Categoría) ---
app.get('/productos', async (req, res) => {
    try {
        const productos = await Producto.findAll({
            include: [
                { model: Categoria, as: 'categoria', attributes: ['id', 'nombre'] },
                { model: Proveedor, as: 'proveedor', attributes: ['id', 'razon_social'] }
            ]
        });
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/productos', async (req, res) => {
    try {
        const producto = await Producto.create(req.body);
        res.status(201).json(producto);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Producto.update(req.body, { where: { id } });
        const actualizado = await Producto.findByPk(id);
        res.json(actualizado);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Producto.destroy({ where: { id } });
        res.json({ mensaje: 'Producto eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- KARDEX / MOVIMIENTOS (TRANSACCIÓN ATÓMICA) ---
app.get('/movimientos', async (req, res) => {
    try {
        const movimientos = await Movimiento.findAll({
            order: [['fecha_hora', 'DESC']],
            include: [
                { model: Producto, as: 'producto', attributes: ['id', 'nombre'] },
                { model: Usuario, as: 'usuario', attributes: ['id', 'nombre'] }
            ]
        });
        res.json(movimientos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/movimientos', async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { producto_id, usuario_id, tipo_movimiento, cantidad, observaciones } = req.body;
        const cant = parseInt(cantidad, 10);

        const producto = await Producto.findByPk(producto_id, { transaction: t });
        if (!producto) {
            await t.rollback();
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        // Calcular nuevo stock según tipo de movimiento
        let nuevoStock = producto.stock;
        if (tipo_movimiento === 'Entrada') {
            nuevoStock += cant;
        } else if (tipo_movimiento === 'Salida') {
            if (producto.stock < cant) {
                await t.rollback();
                return res.status(400).json({ error: 'Stock insuficiente para realizar la salida' });
            }
            nuevoStock -= cant;
        } else if (tipo_movimiento === 'Ajuste') {
            nuevoStock = cant;
        }

        // 1. Registrar movimiento en Kardex
        const movimiento = await Movimiento.create({
            producto_id,
            usuario_id,
            tipo_movimiento,
            cantidad: cant,
            observaciones
        }, { transaction: t });

        // 2. Actualizar stock en la tabla de productos
        await producto.update({ stock: nuevoStock }, { transaction: t });

        // Confirmar transacción
        await t.commit();
        res.status(201).json(movimiento);
    } catch (error) {
        await t.rollback();
        console.error('Error en transacción de Kardex:', error);
        res.status(500).json({ error: 'Error al procesar el movimiento de inventario' });
    }
});

// --- ARRANQUE Y SINCRONIZACIÓN CON HEIDISQL ---
const PORT = process.env.PORT || 3006;

sequelize.sync({ alter: true })
    .then(() => {
        console.log('Tablas sincronizadas con HeidiSQL.');
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Error al conectar con la base de datos:', error);
    });