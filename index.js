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

// 2. CORS: permitir los orígenes locales de desarrollo
const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:4173',
    'http://127.0.0.1:4173'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error('Origen no permitido por CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

app.get('/api/auth/me', autenticar(['Administrador', 'Almacenero', 'Supervisor']), async (req, res) => {
    try {
        const usuario = await Usuario.findByPk(req.usuario.id, {
            attributes: ['id', 'nombre', 'email', 'rol']
        });
        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        res.status(200).json(usuario);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/usuarios', autenticar(['Administrador']), async (req, res) => {
    try {
        const { nombre, email, password, rol } = req.body;

        if (!nombre || !String(nombre).trim()) {
            return res.status(400).json({ error: 'El nombre es obligatorio.' });
        }

        if (!email || !String(email).trim()) {
            return res.status(400).json({ error: 'El email es obligatorio.' });
        }

        if (!password || !String(password).trim()) {
            return res.status(400).json({ error: 'La contraseña es obligatoria.' });
        }

        if (!rol) {
            return res.status(400).json({ error: 'El rol es obligatorio.' });
        }

        const existe = await Usuario.findOne({ where: { email: String(email).trim().toLowerCase() } });
        if (existe) {
            return res.status(400).json({ error: 'El correo ya se encuentra registrado' });
        }

        const nuevoUsuario = await Usuario.create({
            nombre: String(nombre).trim(),
            email: String(email).trim().toLowerCase(),
            password: String(password),
            rol: String(rol).trim()
        });

        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            id: nuevoUsuario.id
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('¡API Backend funcionando exitosamente!');
});

// --- RUTAS DE CATEGORÍAS ---
app.get('/api/categorias', autenticar(['Administrador', 'Almacenero', 'Supervisor']), async (req, res) => {
    try {
        const categorias = await Categoria.findAll({
            order: [['nombre', 'ASC']]
        });
        res.status(200).json(categorias);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/categorias', autenticar(['Administrador', 'Almacenero']), async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;

        if (!nombre || !String(nombre).trim()) {
            return res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });
        }

        const nuevaCategoria = await Categoria.create({
            nombre: String(nombre).trim(),
            descripcion: descripcion ? String(descripcion).trim() : null
        });

        res.status(201).json(nuevaCategoria);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/categorias/:id', autenticar(['Administrador', 'Almacenero']), async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion } = req.body;

        if (!nombre || !String(nombre).trim()) {
            return res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });
        }

        const [actualizado] = await Categoria.update({
            nombre: String(nombre).trim(),
            descripcion: descripcion ? String(descripcion).trim() : null
        }, { where: { id } });

        if (!actualizado) {
            return res.status(404).json({ error: 'Categoría no encontrada.' });
        }

        res.status(200).json({ message: 'Categoría actualizada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/categorias/:id', autenticar(['Administrador']), async (req, res) => {
    try {
        const { id } = req.params;
        const eliminado = await Categoria.destroy({ where: { id } });

        if (!eliminado) {
            return res.status(404).json({ error: 'Categoría no encontrada.' });
        }

        res.status(200).json({ message: 'Categoría eliminada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- RUTAS DE PROVEEDORES ---
app.get('/api/proveedores', autenticar(['Administrador', 'Almacenero', 'Supervisor']), async (req, res) => {
    try {
        const proveedores = await Proveedor.findAll({
            order: [['razon_social', 'ASC']]
        });
        res.status(200).json(proveedores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/proveedores', autenticar(['Administrador', 'Almacenero']), async (req, res) => {
    try {
        const { razon_social, contacto, telefono, email } = req.body;

        if (!razon_social || !String(razon_social).trim()) {
            return res.status(400).json({ error: 'La razón social del proveedor es obligatoria.' });
        }

        const nuevoProveedor = await Proveedor.create({
            razon_social: String(razon_social).trim(),
            contacto: contacto ? String(contacto).trim() : null,
            telefono: telefono ? String(telefono).trim() : null,
            email: email ? String(email).trim() : null
        });

        res.status(201).json(nuevoProveedor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/proveedores/:id', autenticar(['Administrador', 'Almacenero']), async (req, res) => {
    try {
        const { id } = req.params;
        const { razon_social, contacto, telefono, email } = req.body;

        if (!razon_social || !String(razon_social).trim()) {
            return res.status(400).json({ error: 'La razón social del proveedor es obligatoria.' });
        }

        const [actualizado] = await Proveedor.update({
            razon_social: String(razon_social).trim(),
            contacto: contacto ? String(contacto).trim() : null,
            telefono: telefono ? String(telefono).trim() : null,
            email: email ? String(email).trim() : null
        }, { where: { id } });

        if (!actualizado) {
            return res.status(404).json({ error: 'Proveedor no encontrado.' });
        }

        res.status(200).json({ message: 'Proveedor actualizado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/proveedores/:id', autenticar(['Administrador']), async (req, res) => {
    try {
        const { id } = req.params;
        const eliminado = await Proveedor.destroy({ where: { id } });

        if (!eliminado) {
            return res.status(404).json({ error: 'Proveedor no encontrado.' });
        }

        res.status(200).json({ message: 'Proveedor eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- RUTAS DE USUARIOS (SOLO ADMINISTRADORES) ---
app.get('/api/usuarios', autenticar(['Administrador', 'Almacenero', 'Supervisor']), async (req, res) => {
    try {
        const where = req.usuario.rol === 'Administrador' ? {} : { id: req.usuario.id };
        const usuarios = await Usuario.findAll({
            attributes: ['id', 'nombre', 'email', 'rol'],
            where,
            order: [['nombre', 'ASC']]
        });
        res.status(200).json(usuarios);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/usuarios', autenticar(['Administrador']), async (req, res) => {
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const rol = req.body?.rol;
    const rolesPermitidos = ['Administrador', 'Almacenero', 'Supervisor'];

    if (!nombre || !email || !password || !rolesPermitidos.includes(rol)) {
        return res.status(400).json({ error: 'Completa nombre, correo, contraseña y un rol válido.' });
    }

    try {
        const existente = await Usuario.findOne({ where: { email } });
        if (existente) {
            return res.status(409).json({ error: 'El correo ya se encuentra registrado.' });
        }

        const usuario = await Usuario.create({ nombre, email, password, rol });
        res.status(201).json({
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol
        });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ error: 'El correo ya se encuentra registrado.' });
        }
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({ error: 'Revisa que el correo tenga un formato válido.' });
        }
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/usuarios/:id', autenticar(['Administrador']), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({ error: 'El ID del usuario no es válido.' });
    }

    const transaction = await sequelize.transaction();
    try {
        const usuario = await Usuario.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!usuario) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        if (String(req.usuario.id) === String(usuario.id)) {
            await transaction.rollback();
            return res.status(409).json({ error: 'No puedes eliminar la cuenta con la que iniciaste sesión.' });
        }

        if (usuario.rol === 'Administrador') {
            const administradores = await Usuario.count({
                where: { rol: 'Administrador' },
                transaction
            });
            if (administradores <= 1) {
                await transaction.rollback();
                return res.status(409).json({ error: 'No se puede eliminar al último Administrador.' });
            }
        }

        const movimientos = await Movimiento.count({
            where: { usuario_id: usuario.id },
            transaction
        });
        if (movimientos > 0) {
            await transaction.rollback();
            return res.status(409).json({ error: 'No se puede eliminar este usuario porque tiene movimientos registrados en el historial.' });
        }

        await usuario.destroy({ transaction });
        await transaction.commit();
        res.status(200).json({ message: 'Usuario eliminado.' });
    } catch (error) {
        if (!transaction.finished) await transaction.rollback();
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/movimientos', autenticar(['Administrador', 'Almacenero', 'Supervisor']), async (req, res) => {
    try {
        const where = req.usuario.rol === 'Almacenero' ? { usuario_id: req.usuario.id } : {};
        const movimientos = await Movimiento.findAll({
            where,
            include: [
                { model: Producto, as: 'producto', attributes: ['id', 'nombre'] },
                { model: Usuario, as: 'usuario', attributes: ['id', 'nombre'] }
            ],
            order: [['fecha_hora', 'DESC']]
        });
        res.status(200).json(movimientos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/movimientos', autenticar(['Administrador', 'Almacenero']), async (req, res) => {
    const productoId = Number(req.body?.producto_id);
    const usuarioId = Number(req.body?.usuario_id);
    const tipo = req.body?.tipo_movimiento;
    const cantidad = Number(req.body?.cantidad);
    const tiposPermitidos = ['Entrada', 'Salida', 'Ajuste'];

    if (!Number.isSafeInteger(productoId) || productoId < 1 ||
        !Number.isSafeInteger(usuarioId) || usuarioId < 1 ||
        !tiposPermitidos.includes(tipo) ||
        !Number.isSafeInteger(cantidad) || cantidad < (tipo === 'Ajuste' ? 0 : 1)) {
        return res.status(400).json({ error: 'Revisa el producto, usuario, tipo y cantidad del movimiento.' });
    }

    if (tipo === 'Ajuste' && req.usuario.rol !== 'Administrador') {
        return res.status(403).json({ error: 'Solo un Administrador puede ajustar existencias.' });
    }

    if (req.usuario.rol !== 'Administrador' && usuarioId !== Number(req.usuario.id)) {
        return res.status(403).json({ error: 'Solo puedes registrar movimientos a tu nombre.' });
    }

    const transaction = await sequelize.transaction();
    try {
        const producto = await Producto.findByPk(productoId, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!producto) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }

        const usuario = await Usuario.findByPk(usuarioId, { transaction });
        if (!usuario) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        const stockActual = Number(producto.stock);
        let variacion;
        let stockNuevo;

        if (tipo === 'Entrada') {
            variacion = cantidad;
            stockNuevo = stockActual + cantidad;
        } else if (tipo === 'Salida') {
            variacion = -cantidad;
            stockNuevo = stockActual - cantidad;
            if (stockNuevo < 0) {
                await transaction.rollback();
                return res.status(409).json({ error: `Stock insuficiente: solo hay ${stockActual} unidades.` });
            }
        } else {
            variacion = cantidad - stockActual;
            stockNuevo = cantidad;
        }

        const movimiento = await Movimiento.create({
            producto_id: productoId,
            usuario_id: usuarioId,
            tipo_movimiento: tipo,
            cantidad: variacion,
            observaciones: typeof req.body?.observaciones === 'string' ? req.body.observaciones.trim() || null : null
        }, { transaction });

        await producto.update({ stock: stockNuevo }, { transaction });
        await transaction.commit();
        res.status(201).json(movimiento);
    } catch (error) {
        if (!transaction.finished) await transaction.rollback();
        res.status(500).json({ error: error.message });
    }
});

// --- RUTAS DE PRODUCTOS (CRUD PROTEGIDO CON RBAC) ---

// 1. Obtener todos los productos (Requiere token de Administrador o Almacenero)
app.get('/api/productos', autenticar(['Administrador', 'Almacenero', 'Supervisor']), async (req, res) => {
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
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;

        const productoExiste = await Producto.findByPk(id, { transaction });
        if (!productoExiste) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        await Movimiento.destroy({
            where: { producto_id: id },
            transaction
        });

        await sequelize.query(
            'DELETE FROM nexo_movimientos WHERE productoId = :id',
            {
                replacements: { id },
                transaction
            }
        );

        await sequelize.query(
            'DELETE FROM nexo_avisos WHERE productoId = :id',
            {
                replacements: { id },
                transaction
            }
        );

        const eliminado = await Producto.destroy({
            where: { id },
            transaction
        });

        await transaction.commit();

        if (!eliminado) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.status(200).json({ message: 'Producto eliminado' });
    } catch (error) {
        await transaction.rollback();
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
            where: req.usuario.rol === 'Almacenero' ? { usuario_id: req.usuario.id } : {},
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