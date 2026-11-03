const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const sequelize = require('./config/db');
require('dotenv').config();

// Importar Modelos para que Sequelize los registre
const Producto = require('./models/Producto');

const app = express();

// --- MIDDLEWARES ---
// Habilitar CORS para permitir peticiones desde el frontend (React)
app.use(cors());
// Parsear el body de las peticiones a JSON
app.use(express.json());

// --- RUTAS BÁSICAS DE PRUEBA ---
app.get('/', (req, res) => {
    res.send('¡API Backend funcionando exitosamente!');
});

// --- RUTAS DE PRODUCTOS (CRUD) ---

// 1. Obtener todos los productos (GET)
app.get('/productos', async (req, res) => {
    try {
        const productos = await Producto.findAll();
        res.status(200).json(productos);
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

// 2. Guardar un nuevo producto (POST)
app.post('/productos', async (req, res) => {
    try {
        const nuevoProducto = await Producto.create(req.body);
        res.status(201).json(nuevoProducto);
    } catch (error) {
        console.error('Error al guardar producto:', error);
        res.status(500).json({ error: 'Error al guardar el producto' });
    }
});

// 3. Actualizar un producto existente (PUT)
app.put('/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [filasAfectadas] = await Producto.update(req.body, {
            where: { id: id }
        });

        if (filasAfectadas === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const productoActualizado = await Producto.findByPk(id);
        res.status(200).json(productoActualizado);
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ error: 'Error al actualizar el producto' });
    }
});

// 4. Eliminar un producto (DELETE)
app.delete('/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const eliminado = await Producto.destroy({
            where: { id: id }
        });

        if (!eliminado) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.status(200).json({ mensaje: 'Producto eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ error: 'Error al eliminar el producto' });
    }
});

// --- SINCRONIZACIÓN Y ARRANQUE ---
const PORT = process.env.PORT || 3006;

// force: false evita que se borren los datos cada vez que se reinicia el servidor
sequelize.sync({ force: false })
    .then(() => {
        console.log('Base de datos conectada y sincronizada.');
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Error al conectar con la base de datos:', error);
    });