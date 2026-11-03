const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const {
    sequelize,
    Categoria,
    Proveedor,
    Usuario,
    Producto,
    Movimiento
} = require('./models');

// Importar rutas y middlewares de seguridad
const authRoutes = require('./routes/authRoutes');
const autenticar = require('./middleware/authMiddleware');

const app = express();

// --- PROTECCIÓN CONTRA ATAQUES COMUNES ---

// 1. HELMET: Seguridad en cabeceras HTTP
app.use(helmet());

// 2. CORS: Restringido al origen de Vite
app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 3. RATE LIMIT: Mitigación de Fuerza Bruta y DoS
const limitador = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Máximo 100 peticiones por IP
    message: 'Demasiadas peticiones desde esta IP, por favor intente más tarde.'
});
app.use('/api/', limitador);

// 4. PARSEO DE JSON (Debe ir ANTES de cualquier ruta)
app.use(express.json());

// --- RUTAS PÚBLICAS DE AUTENTICACIÓN ---
app.use('/api/auth', authRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('¡API Backend funcionando exitosamente!');
});

// --- RUTAS DE PRODUCTOS (CRUD PROTEGIDO CON RBAC) ---

// 1. Obtener todos los productos (Requiere token de Administrador o Almacenero)
app.get('/api/productos', autenticar(['Administrador', 'Almacenero']), async (req, res) => {
    try {
        const productos = await Producto.findAll({
            include: [
                { model: Categoria, as: 'categoria', attributes: ['id', 'nombre'] },
                { model: Proveedor, as: 'proveedor', attributes: ['id', 'razon_social'] }
            ]
        });
        res.status(200).json(productos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Crear producto
app.post('/api/productos', autenticar(['Administrador', 'Almacenero']), async (req, res) => {
    try {
        const nuevoProducto = await Producto.create(req.body);
        res.status(201).json(nuevoProducto);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Actualizar producto
app.put('/api/productos/:id', autenticar(['Administrador', 'Almacenero']), async (req, res) => {
    try {
        const { id } = req.params;
        await Producto.update(req.body, { where: { id } });
        res.status(200).json({ message: 'Producto actualizado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Eliminar producto
app.delete('/api/productos/:id', autenticar(['Administrador']), async (req, res) => {
    try {
        const { id } = req.params;
        await Producto.destroy({ where: { id } });
        res.status(200).json({ message: 'Producto eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ENDPOINTS AUXILIARES DEL DASHBOARD ---
app.get('/api/dashboard', autenticar(['Administrador', 'Almacenero', 'Supervisor']), async (req, res) => {
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
        res.status(500).json({ error: error.message });
    }
});

// --- SINCRONIZACIÓN Y ARRANQUE ---
const PORT = process.env.PORT || 3006;

sequelize.sync({ alter: true })
    .then(() => {
        console.log('Base de datos conectada y sincronizada.');
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Error al conectar con la base de datos:', error);
    });