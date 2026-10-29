# Verificación de la interfaz

Estas pruebas cubren el selector de tema (barra, pie y fondo) y el selector de fuentes del compositor. No sustituyen una revisión manual, pero fallan si un cambio rompe esos controles o si la página lanza un error de JavaScript.

## Datos de prueba

En el backend, con el entorno virtual activo:

```bash
cd Backend
python manage.py seed_data
```

Crea las cuentas `seed_admin`, `seed_supervisor`, `seed_autor_ana`, `seed_autor_leo`, `seed_lector_mia` y `seed_lector_teo`. La contraseña por defecto es `SeedPass123!`. Volver a ejecutar el comando actualiza esos usuarios y no duplica publicaciones ni comentarios.

## Pruebas unitarias

Comprueban que la aplicación arranca, que el selector de tema cambia las variables de color y que el editor aplica fuente, color, negrita y cursiva.

```bash
cd frontend
npm test -- --watch=false
```

## Pruebas de extremo a extremo

Hacen falta el frontend en `http://localhost:4200` y, para la prueba de fuentes, el backend en el puerto 8001 con los datos de `seed_data`.

```bash
cd frontend
npm install
npx playwright install chromium
npm run e2e
```

`playwright.config.ts` usa la app que ya está sirviendo. No levanta otro `ng serve`.
