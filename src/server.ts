import dotenv from 'dotenv';
import { createExpressApp } from './infrastructure/http';

// Cargar variables de entorno
dotenv.config();

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    const app = await createExpressApp();
    
    app.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(`  3 LOBOS CERVECERÍA - API BACKEND (SaaS)`);
      console.log(`  Corriendo en http://localhost:${PORT}`);
      console.log(`  Entorno de base de datos SQLite inicializado.`);
      console.log(`==================================================`);
    });
  } catch (error) {
    console.error('Error crítico al levantar el servidor de 3 Lobos:', error);
    process.exit(1);
  }
}

bootstrap();
