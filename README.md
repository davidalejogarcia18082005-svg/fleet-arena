# Fleet Arena

**Jugar en línea:** [Abrir Fleet Arena](https://fleet-arena-ten.vercel.app/)

**Usuarios de prueba**

| Usuario | Correo | Contraseña |
| --- | --- | --- |
| Ana Norte | `ana.fleet@ejemplo.test` | `cGaYZiCDg0JoAZL0aL-Bzbtc` |
| Luis Sur | `luis.fleet@ejemplo.test` | `KIb437-YdmOKiQePnNvqzngi` |

Son cuentas ficticias compartidas para probar el juego. Entra desde **Iniciar sesión**. Para jugar con ambas a la vez, usa una ventana normal y otra privada, o dos dispositivos distintos.

Batalla naval para dos jugadores, con cuentas de Supabase Auth, salas de invitación, datos persistentes en PostgreSQL y cambios enviados mediante Supabase Realtime. La organización de salas y los dos formatos se inspiran en la experiencia de Pokémon Showdown; el juego, interfaz y recursos gráficos son propios.

## Estado de esta entrega

El proyecto de Supabase del laboratorio ya tiene las tablas, las reglas y dos perfiles de prueba. En la base remota se verificaron la colocación de flotas, un disparo y la lectura de un mensaje desde el perfil rival. La prueba de inicio de sesión y de actualización en dos navegadores se hará en la dirección de producción de Vercel.

## Dos modos, ambos online y por turnos

- **Contra el reloj:** cinco minutos totales por jugador, sin incremento. Solo corre el reloj de quien tiene el turno. Comienza cuando ambos confirman sus flotas y continúa durante desconexiones. Perder todo el tiempo supone una derrota.
- **A tu ritmo:** sin límite entre jugadas. Puedes cerrar el navegador y continuar desde Mis partidas, incluso desde otro dispositivo.

Tablero de 10 × 10; cinco barcos de 5, 4, 3, 3 y 2 casillas. Colocación horizontal o vertical, sin superposición; se permite que barcos se toquen. El primer turno se sortea. Siempre se alterna un disparo por jugador, se acierte o se falle. Gana quien alcance las 17 casillas enemigas. Se incluyen chat de sala, salas públicas opcionales, resultados e historial.

## Preparación rápida

Requisitos: Node.js 22 o posterior y npm. Puede abrirse como proyecto en WebStorm u otro IDE de JetBrains, pero el IDE no es obligatorio.

```bash
npm ci
npm run dev
```

Abre la dirección que muestra la terminal. El ZIP del laboratorio incluye en `.env.local` la URL y la clave publicable del proyecto. Si clonaste el repositorio, crea un archivo `.env.local` junto a `package.json` con los dos valores de tu proyecto.

```dotenv
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU_CLAVE_PUBLICABLE
```

La clave **publicable** (o la clave `anon` antigua) está diseñada para el cliente. No pongas `sb_secret_`, `service_role`, contraseñas de base de datos ni tokens administrativos en variables `VITE_`, GitHub o el chat. `.env` está excluido de Git.

## 1. Configurar otro proyecto de Supabase

La migración ya se aplicó al proyecto `fleet-arena` de este laboratorio. Estos pasos sirven para instalar el juego en un proyecto nuevo.

1. Crea un proyecto de Supabase.
2. En su **SQL Editor**, ejecuta una vez el contenido completo de `supabase/migrations/202610280001_fleet_arena.sql`. La migración es transaccional y está pensada para un proyecto nuevo; no se debe ejecutar repetidamente sobre las mismas tablas.
3. Comprueba que las tablas `games` y `messages` estén en la publicación `supabase_realtime`. La migración las añade cuando dicha publicación existe. Si no existe o no están activadas, actívalas desde las opciones de Realtime/replicación del panel. **No publiques `private.fleets`.**
4. Copia la Project URL y la clave publicable del panel de conexión/API a `.env`.
5. En Authentication, configura la URL del sitio y las URL de redirección autorizadas: la URL local indicada por Vite para desarrollo y la URL definitiva de Vercel para producción.
6. Para las pruebas del laboratorio, crea dos usuarios ficticios, por ejemplo `ana@prueba.com` y `luis@prueba.com`, con contraseñas de prueba que elijas. En Authentication → Users, confírmalos automáticamente al crearlos. El trigger crea sus perfiles con nombres provisionales. El botón Crear cuenta de la aplicación también funciona con el flujo de registro que hayas configurado; si se exige confirmación de correo, el usuario no podrá entrar hasta confirmarse. No se envían correos reales para las cuentas de prueba creadas manualmente.
7. Si quieres cambiar los alias de estas cuentas ficticias desde el panel, edita únicamente `profiles.username`. Las identidades siguen ligadas al ID de Supabase Auth.

Como alternativa para una revisión local, el botón Configuración permite introducir únicamente los dos datos publicables. Estos se guardan en ese navegador. Para la entrega usa variables de entorno en Vercel, así todos los dispositivos recibirán la misma configuración. **Los datos de partidas no usan localStorage:** se guardan en Supabase. El SDK mantiene la sesión en el navegador.

## 2. Publicar en GitHub y Vercel

1. Crea un repositorio público y sube el contenido del proyecto, incluyendo `package-lock.json`, `src`, `public`, `tests`, `docs` y `supabase`. Excluye `.env`, `node_modules`, `dist` y archivos temporales.
2. Importa ese repositorio como proyecto Vercel. El proyecto utiliza **Vite**.
3. Define `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en Vercel para el entorno de producción.
4. El comando de compilación es `npm run build`; la carpeta de salida es `dist`. `vercel.json` ya lo declara.
5. Publica y utiliza el dominio principal de producción. Si cambias una variable, vuelve a desplegar.
6. Añade esa URL a la configuración de Auth de Supabase y prueba desde dos navegadores o una ventana privada con cuentas distintas.

## 3. Comprobar el juego real

En el primer navegador entra como Ana y crea una sala. Copia su código. En el segundo entra como Luis y únete con ese código. Cada uno confirma su flota. Comprueba que las jugadas y mensajes aparezcan en el otro navegador sin recargar. Cierra y vuelve a abrir una sesión para verificar persistencia. Las ventanas normales del mismo navegador comparten sesión; usa perfiles distintos o navegación privada.

La lista de salas abiertas se reconcilia cada 15 segundos; los **cambios dentro de una partida** se notifican por Realtime. También hay una consulta de recuperación cada 20 segundos y al volver a la pestaña o recuperar red. Solo se habilitan disparos cuando el canal está suscrito. Si falla una consulta temporalmente, una reconciliación correcta restaura los controles.

En modo con reloj, el servidor determina el tiempo y el resultado. Cuando nadie está conectado, no hace falta un proceso que escriba cada segundo: la fecha del turno permite determinar la expiración. La derrota se registra en la siguiente consulta o acción y también al cargar Mis partidas. El tiempo no se reinicia al recargar. La fase de colocar barcos no consume los cinco minutos.

## Arquitectura y seguridad

- **React + TypeScript + Vite:** interfaz adaptable a computadora y móvil.
- **Supabase Auth:** cuentas con correo y contraseña; la aplicación no guarda contraseñas en sus tablas.
- **PostgreSQL:** salas, turnos, relojes, flotas, disparos y mensajes.
- **Realtime:** notificación de cambios de la partida; el cliente vuelve a pedir una instantánea autorizada.
- **RLS y RPC:** los jugadores solo leen las salas, disparos y mensajes de sus partidas. No tienen permisos de escritura directa en estas tablas. Las funciones derivan la identidad de `auth.uid()` y validan las acciones.
- **Flotas privadas:** las posiciones están en `private.fleets`, sin permisos para el cliente ni publicación en Realtime. Una instantánea entrega la flota propia y los resultados públicos; revela la rival únicamente al acabar la partida.
- **Concurrencia:** todas las acciones de una partida bloquean su fila con `FOR UPDATE` antes de validar. El reloj usa `clock_timestamp()` después del bloqueo. Los disparos llevan un identificador de petición para tolerar reintentos sin duplicarse.
- **Orden de respuestas:** la versión de la partida aumenta con cada cambio visible, incluido el chat. El cliente descarta instantáneas antiguas.

La aplicación ofrece salas privadas por invitación y salas abiertas. El catálogo público solo incluye alias, código, modo y fecha; nunca flotas ni correos. La aplicación limita a diez salas pendientes por propietario y el chat a un mensaje por segundo por usuario en la misma sala. Para un servicio público de gran escala convendría incorporar moderación, límites adicionales de tráfico y observabilidad.

## Pruebas

```bash
npm test
npm run build
```

Las pruebas ejecutan la migración y funciones reales en PGlite (PostgreSQL embebido), con usuarios y roles ficticios. Cubren autorización, RLS, colocación, turnos, reintentos, disparos, hundimientos, victoria, rendición, límites del reloj y continuidad del modo sin tiempo. También verifican generación de flotas y descarte de estados antiguos del cliente.

**Límite de la verificación local:** PGlite no demuestra el funcionamiento del servicio remoto Supabase Auth, la entrega de eventos Realtime ni los bloqueos entre conexiones PostgreSQL independientes. La guía `docs/PRUEBA-ONLINE.md` contiene los pasos pendientes para comprobarlos con el proyecto publicado. No uses capturas de vistas de prueba como evidencia de partidas online.

## Estructura

```text
src/                         Interfaz, autenticación, estado y reglas visuales
supabase/migrations/         Esquema y reglas autoritativas del servidor
tests/                       Pruebas de reglas, permisos y cliente
docs/                        Configuración, prueba online y preparación de entrega
public/                      Icono propio de la aplicación
vercel.json                  Compilación y rutas para publicar
```

## Documentación utilizada

- [Supabase Auth](https://supabase.com/docs/guides/auth/passwords)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Funciones de base de datos](https://supabase.com/docs/guides/database/functions)
- [Políticas RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Vercel para GitHub](https://vercel.com/docs/git/vercel-for-github)
