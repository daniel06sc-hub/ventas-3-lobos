"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("./infrastructure/http");
// Cargar variables de entorno
dotenv_1.default.config();
const PORT = process.env.PORT || 3000;
async function bootstrap() {
    try {
        const app = await (0, http_1.createExpressApp)();
        app.listen(PORT, () => {
            console.log(`==================================================`);
            console.log(`  3 LOBOS CERVECERÍA - API BACKEND (SaaS)`);
            console.log(`  Corriendo en http://localhost:${PORT}`);
            console.log(`  Entorno de base de datos SQLite inicializado.`);
            console.log(`==================================================`);
        });
    }
    catch (error) {
        console.error('Error crítico al levantar el servidor de 3 Lobos:', error);
        process.exit(1);
    }
}
bootstrap();
