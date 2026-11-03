const jwt = require('jsonwebtoken');

module.exports = (rolesPermitidos = []) => {
    return (req, res, next) => {
        // Obtener el encabezado Authorization (Bearer TOKEN)
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(403).json({ error: 'Acceso denegado: Token no proporcionado.' });
        }

        try {
            // Verificar firma y tiempo de expiración
            const decodificado = jwt.verify(token, process.env.JWT_SECRET);
            req.usuario = decodificado;

            // Validar RBAC (Control de acceso basado en roles)
            if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(decodificado.rol)) {
                return res.status(401).json({ error: 'No autorizado: Permisos insuficientes.' });
            }

            next();
        } catch (error) {
            return res.status(401).json({ error: 'Sesión inválida o expirada.' });
        }
    };
};