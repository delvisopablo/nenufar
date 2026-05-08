# Nenufar V2

README de producto y de desarrollo del proyecto **Nenufar**.

Este documento resume:

- que pretende ser el proyecto
- que partes existen ya en el repo
- que arquitectura usa
- que areas siguen pendientes o en consolidacion

Estado revisado sobre el repositorio el **7 de mayo de 2026**.

## Vision

**Nenufar** quiere ser una plataforma para conectar personas con negocios locales desde una experiencia mas cercana, mas ludica y menos fria que un directorio tradicional.

La idea no es solo "buscar un negocio", sino:

- descubrir sitios con personalidad
- reservar sin friccion
- dejar reseñas con identidad de comunidad
- seguir negocios y perfiles
- premiar la participacion con dinamicas de gamificacion
- dar a los negocios pequenas herramientas de gestion y visibilidad

En terminos de producto, Nenufar mezcla:

- descubrimiento local
- comunidad
- reservas
- promociones
- perfil y reputacion
- capa de juego y fidelizacion

## Propuesta de valor

### Para usuarios

- descubrir negocios locales de forma mas visual y divertida
- reservar franjas horarias
- dejar resenas
- seguir perfiles y negocios
- acumular logros, petalos y actividad visible
- guardar historial de compras y tickets

### Para negocios

- tener un perfil publico con identidad propia
- configurar horario y disponibilidad
- gestionar reservas
- publicar promociones
- ver un dashboard operativo
- recibir reseñas y seguidores
- conectar compras o tickets con su catalogo

## Que intenta construir este proyecto

A nivel de producto, el repo apunta a un **MVP ampliado** con estas lineas:

1. Una entrada de marca propia con estetica reconocible.
2. Un sistema real de cuentas para usuarios y negocios.
3. Un perfil publico y privado para cada tipo de cuenta.
4. Un modulo de reservas util en produccion.
5. Un circuito social sencillo: seguir, reseñar, descubrir, volver.
6. Un sistema de fidelizacion con petalos, logros y referidos.
7. Herramientas operativas para negocios pequeños.
8. Experimentos de producto adyacentes como **RutaLocal**.

## Estado real del repo

El proyecto ya tiene bastante mas que una landing. A dia de hoy se observa:

- frontend Angular 17 standalone funcional
- backend NestJS + Prisma + PostgreSQL en carpeta hermana
- auth real con backend remoto
- perfiles de usuario y negocio
- reservas con vista cliente y vista negocio
- reseñas y promociones
- dashboard de negocio
- seguimiento de usuarios y negocios
- logros, petalos y referidos
- escaner de tickets con flujo de revision manual
- un modulo experimental llamado **RutaLocal**

Tambien hay partes que todavia estan claramente en evolucion:

- algunos endpoints del backend aun no tienen su version final consolidada
- el dashboard del negocio usa algunos fallbacks porque faltan endpoints dedicados
- hay controllers del backend con TODOs de endurecimiento de auth
- algunas pantallas antiguas o de laboratorio conviven con otras mas maduras
- el scanner de tickets aun no tiene OCR interno real conectado

## Stack

### Frontend

- Angular 17
- standalone components
- Angular Signals
- HttpClient con interceptores
- RxJS
- Three.js en algunas experiencias visuales

### Backend

- NestJS
- Prisma
- PostgreSQL
- JWT
- cookies HttpOnly y soporte Bearer

### Infra y despliegue

- frontend preparado para despliegue tipo Vercel
- backend desplegado/pensado para Railway
- API de produccion configurada desde `src/environments/environment.prod.ts`

## Arquitectura del proyecto

Aunque este README vive en `FRONTEND/`, el proyecto real esta dividido en dos partes:

```text
NENUFAR V2/
|-- FRONTEND/                 # Angular 17
`-- BACKEND/
    `-- nenufar-backend-2/    # NestJS + Prisma
```

### Piezas clave del frontend

- `src/app/app.routes.ts`
  define las rutas principales del producto

- `src/app/app.config.ts`
  registra router, http client, interceptores y la hidratacion inicial de sesion

- `src/app/servicios/authService/`
  concentra login, sesion, storage del token e interceptor de auth

- `src/app/componentes/reservas/`
  contiene el flujo mas importante de reserva para cliente y negocio

- `src/app/componentes/perfil-negocio/`
  actua como centro operativo del negocio

- `src/app/componentes/dashboard/`
  resume metricas y proximas reservas

- `src/app/services/nenufarizar.service.ts`
  gestiona referidos y codigo de invitacion

- `src/app/componentes/ruta-local/`
  modulo experimental orientado a recorridos o planes locales

## Modulos funcionales detectados

### 1. Acceso y autenticacion

Existe un flujo completo de:

- registro de usuario
- registro de negocio
- login
- logout
- hidratacion de sesion
- perfil autenticado

Estado actual del frontend:

- el login envia `{ email, password }`
- el token se normaliza en `localStorage` bajo la clave `accessToken`
- el interceptor añade `Authorization: Bearer <token>`
- tambien se mantiene `withCredentials` para compatibilidad con cookies

Esto es importante porque el backend mezcla auth por cookie HttpOnly y soporte Bearer.

### 2. Estanque y entrada al producto

El proyecto tiene una entrada de marca muy marcada:

- pantalla de estanque
- acceso como invitado
- login superpuesto
- tono visual propio

Esto no es decorativo: forma parte de la identidad del producto y de como Nenufar quiere diferenciarse.

### 3. Home de descubrimiento

La home principal no funciona como listado clasico, sino como una escena visual con:

- promociones destacadas
- negocios recomendados
- acceso a perfil
- acceso a crear reseña

La idea de producto aqui es que descubrir comercios se sienta mas como explorar un ecosistema que como navegar un catalogo plano.

### 4. Perfiles de usuario

Hay soporte para:

- perfil privado
- perfil publico
- bio
- reseñas del usuario
- reservas propias
- logros
- petalos
- seguimiento entre usuarios
- codigo de referido y usuarios referidos

### 5. Perfiles de negocio

El negocio tiene:

- perfil publico
- perfil privado
- cabecera visual
- direccion y mapa
- horario
- promociones
- reseñas
- seguimiento de negocio
- acceso a reservas
- acceso a dashboard
- escaner de ticket

Este es uno de los nucleos del producto.

### 6. Reservas

Es uno de los modulos mas serios del repo.

Incluye:

- disponibilidad por negocio y fecha
- slots por intervalo horario
- creacion de reservas
- listado de mis reservas
- cancelacion
- gestion de reservas del negocio
- cambio de estado: pendiente, confirmada, cancelada, completada, no show

Ademas, el frontend ya protege llamadas innecesarias:

- no consulta reservas privadas si no existe `accessToken`
- si no hay sesion, deja el estado vacio sin disparar errores continuos

### 7. Reseñas

Hay una capa de reseñas con:

- alta de reseña
- listados globales
- reseñas por negocio
- reseñas por usuario
- sello Nenufar

Las reseñas son parte de la reputacion, pero tambien de la gamificacion y del descubrimiento.

### 8. Promociones

El sistema de promociones permite:

- listar promociones activas
- listar promociones por negocio
- crear y editar promociones
- validarlas

Esto apunta a que Nenufar no quiere ser solo comunidad, sino tambien escaparate comercial ligero para pequeno negocio.

### 9. Dashboard de negocio

Existe un dashboard con:

- resumen de reservas
- pendientes
- confirmadas
- no show
- total de reseñas
- nota media
- proximas reservas

Situacion actual:

- el frontend ya lo presenta como producto util
- el backend aun no expone todos los endpoints finales especificos
- por eso algunas metricas se componen reutilizando endpoints existentes

### 10. Seguimiento, notificaciones y capa social

Hay base para:

- seguir negocios
- dejar de seguir negocios
- seguir usuarios
- notificaciones
- contadores de seguimiento

Esto refuerza la idea de producto de comunidad local recurrente, no solo de consulta puntual.

### 11. Petalos, logros y fidelizacion

Nenufar ya plantea una economia de interaccion ligera:

- petalos
- ledger de petalos
- logros
- referidos
- codigo de referido regenerable

Es una de las partes mas distintivas del proyecto frente a una app local tradicional.

### 12. Tickets, compras y pagos

Hay una linea bastante interesante alrededor de la compra:

- escaneo de ticket
- revision manual del ticket
- asociacion a pedido/compra/pago
- guardado de compra del usuario

Estado actual:

- el flujo existe
- el OCR real aun no esta conectado
- hoy funciona como pipeline preparado para revision manual

### 13. RutaLocal

`RutaLocal` parece ser un experimento o subproducto dentro del universo Nenufar.

Propone recorridos como:

- recados
- ruta cervecera
- ruta gastro
- plan de tarde
- improvisar

Encaja con la vision del proyecto porque lleva el descubrimiento local a planes y recorridos, no solo a perfiles de negocio.

## Rutas principales del frontend

Algunas rutas destacadas del producto:

- `/estanque`
- `/inicio`
- `/registro`
- `/registro-negocio`
- `/mi-perfil`
- `/mi-negocio`
- `/mi-negocio/dashboard`
- `/mi-negocio/reservas`
- `/reservas`
- `/reseñas`
- `/ruta-local`

La definicion completa esta en [src/app/app.routes.ts](./src/app/app.routes.ts).

## Flujo tecnico de autenticacion

Despues de la revision del flujo de auth, el frontend queda planteado asi:

1. El usuario inicia sesion con email y password.
2. El frontend intenta extraer token desde la respuesta si el backend lo manda.
3. Ese token se guarda como `accessToken`.
4. El interceptor lo inyecta en `Authorization: Bearer <token>`.
5. Si no hay token, no se lanzan llamadas privadas como `mis-reservas`.
6. La hidratacion remota de sesion solo se hace cuando existe pista real de auth.

Esto convive con `withCredentials: true` para seguir siendo compatible con sesiones basadas en cookie.

## Lo que el proyecto todavia necesita cerrar

A partir del codigo actual, los siguientes puntos parecen prioritarios:

### Backend y contrato API

- consolidar endpoints finales para dashboard
- unificar lookup publico por nickname o slug
- estabilizar el endpoint "mi negocio"
- endurecer auth en controllers que aun tienen TODOs

### Producto

- terminar de decidir que modulos son MVP y cuales son exploratorios
- definir si RutaLocal sale dentro del primer lanzamiento o como experimento aparte
- consolidar compras y pagos en una experiencia cerrada
- decidir el peso real de petalos y logros en el core del producto

### Operacion y lanzamiento

- mas tests e2e
- observabilidad de errores en produccion
- endurecimiento del flujo de auth cross-domain
- limpieza de pantallas legacy o placeholder
- documentar mejor estados del backend y datos de seed

## Roadmap sugerido

Si hubiera que ordenar el trabajo en fases, este repo sugiere algo asi:

### Fase 1. Estabilizacion del core

- auth
- perfiles
- reservas
- reseñas
- promociones

### Fase 2. Herramientas para negocio

- dashboard final
- horarios mas robustos
- reservas con mas reglas
- consolidacion del flujo ticket -> compra

### Fase 3. Capa comunidad

- seguimiento
- notificaciones
- feed mas claro
- reputacion y resenas con mas contexto

### Fase 4. Gamificacion y fidelizacion

- petalos
- logros
- referidos
- recompensas o dinamicas mas visibles

### Fase 5. Experimentos y expansion

- RutaLocal
- nuevas capas sociales
- personalizacion avanzada de perfiles de negocio

## Comandos utiles

### Frontend

```bash
npm install
npm start
npm run build
npm test
```

### Backend

Desde `../BACKEND/nenufar-backend-2/`:

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

## Configuracion local

### Frontend

- desarrollo: `src/environments/environment.ts`
- produccion: `src/environments/environment.prod.ts`

Por defecto el frontend local apunta a:

- `http://localhost:3000`

### Backend

Necesita al menos:

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`

El README del backend tiene mas detalle en:

- `../BACKEND/nenufar-backend-2/README.md`

## Indicadores de madurez

Partes bastante encaminadas:

- identidad visual
- arquitectura Angular standalone
- reservas
- perfiles
- promociones
- dashboard inicial
- base de gamificacion

Partes aun en consolidacion:

- endurecimiento total de auth en todo el backend
- algunos contratos API
- OCR real para tickets
- endpoints dedicados para dashboard
- limpieza de modulos experimentales o antiguos

## Resumen corto

**Nenufar** no pretende ser solo una web de negocios locales.

Pretende convertirse en un ecosistema donde:

- los usuarios descubren, reservan y participan
- los negocios gestionan su presencia y su operativa ligera
- la comunidad gana peso mediante reseñas, seguimiento y recompensas
- todo ocurre bajo una identidad visual muy propia

Hoy el proyecto ya tiene una base real y funcional. Lo que falta no es "empezarlo", sino **consolidar, pulir y cerrar el MVP con criterio**.
