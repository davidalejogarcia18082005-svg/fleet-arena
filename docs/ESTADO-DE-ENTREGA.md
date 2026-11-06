# Estado del proyecto

Estado al 5 de noviembre de 2026.

## Implementado

- Interfaz de batalla naval en español, adaptable a computadora y móvil.
- Acceso y registro mediante Supabase Auth configurados con el proyecto del laboratorio.
- Salas privadas por código y salas abiertas opcionales.
- Dos modos online por turnos: cinco minutos por jugador o sin límite de tiempo.
- Colocación de cinco barcos, disparos, impactos, hundimientos, victoria y rendición.
- Recuperación de partidas, historial, resultados y chat.
- Base de datos PostgreSQL con RLS, flotas privadas y funciones que validan cada acción.
- Suscripciones a Supabase Realtime y recuperación tras interrupciones.
- Configuración de compilación para Vercel.

## Verificado localmente

- `npm test`: 18 pruebas correctas.
- `npm run build`: compilación de producción correcta.
- La migración se ejecuta sobre PostgreSQL embebido con roles de prueba.
- Permisos, privacidad de flotas, turnos, disparos repetidos, hundimientos y resultados.
- Expiración del reloj, tiempo consumido al rendirse y continuidad del modo sin tiempo.
- Pantalla inicial y preparación de flotas en tamaños de computadora y teléfono.
- Selección, giro y confirmación de un barco mediante interacción con la interfaz local.

## Verificado en la base de datos del laboratorio

La base de datos contiene las cinco tablas y las nueve funciones de la aplicación. La publicación de Realtime incluye `games` y `messages`. El rol del cliente carece de acceso directo a `private.fleets`.

Las cuentas ficticias Ana Norte y Luis Sur tienen una partida privada sin reloj. En dos consultas separadas, con los permisos de cada jugador, se comprobó que un disparo y el mensaje de Ana siguen visibles para Luis y que la flota rival sigue oculta. Estas comprobaciones se hicieron en PostgreSQL.

## Pendiente de la publicación y las evidencias

1. Publicar el código en el repositorio público del juego e importar ese repositorio en Vercel.
2. Entrar con ambos usuarios en dos navegadores y comprobar el inicio de sesión, la recuperación de la partida y la actualización en directo.
3. Tomar las cuatro capturas en producción y añadirlas junto con los tres enlaces al editor oficial de la tarjeta.

El borrador de la tarjeta ya incluye el público, lo que se guarda, la interacción y la mejora que se comprobará para Proyecto 2. La entrega final requiere la tarjeta con los enlaces y las evidencias de los navegadores.

La guía principal es `README.md`. La lista de pruebas online y capturas está en `docs/PRUEBA-ONLINE.md`.
