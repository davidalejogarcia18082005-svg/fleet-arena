# Verificación con dos usuarios

Estado: pendiente hasta configurar un proyecto real de Supabase y publicar en Vercel. Las pruebas locales no sustituyen esta revisión.

Usa exclusivamente datos inventados y dos cuentas distintas. Anota la URL publicada y el commit exacto que estás probando.

| Caso             | Acción                                                              | Resultado esperado                                                 |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Acceso           | Entrar con Ana y Luis en dos navegadores                            | Cada uno conserva su identidad al recargar                         |
| Sala             | Ana crea sala y Luis introduce el código                            | Ambos ven la misma sala y dos participantes                        |
| Privacidad       | Cada uno confirma barcos distintos                                  | Cada uno ve únicamente sus barcos; el rival sigue oculto           |
| Disparo          | Quien tiene turno dispara                                           | El rival ve el resultado y cambio de turno sin recargar            |
| Chat             | Ana envía un mensaje                                                | Luis lo recibe sin recargar y lo conserva al volver                |
| Persistencia     | Cerrar y reabrir una partida sin reloj                              | Se recuperan flota, disparos, mensajes y turno                     |
| Otro dispositivo | Entrar en la misma cuenta desde otro dispositivo                    | Mis partidas ofrece la sala guardada                               |
| Reloj            | Esperar o jugar con reloj                                           | Solo se descuenta el tiempo del jugador activo                     |
| Desconexión      | Desconectar al jugador activo durante una partida con reloj         | El reloj sigue; al reconectar recupera el tiempo correcto          |
| Expiración       | Dejar agotar el reloj                                               | El servidor registra victoria del rival; recargar no reinicia nada |
| Recuperación     | Cortar y recuperar internet                                         | Los controles se recuperan al restablecerse sincronización         |
| Reintento        | Interrumpir una respuesta a un disparo y volver                     | La casilla solo tiene un disparo y no se consume otro turno        |
| Aislamiento      | Tercer usuario intenta abrir una partida ajena                      | Acceso rechazado, sin mostrar flotas ni chat                       |
| Colisión         | Dos invitados intentan entrar a la última plaza                     | Solo uno obtiene el segundo lugar                                  |
| Concurrencia     | Dos pestañas de la misma cuenta intentan disparar en el mismo turno | Solo se acepta una jugada                                          |
| Final            | Hundir los cinco barcos                                             | Un solo ganador, resultado guardado y tablero bloqueado            |

## Cuatro capturas del Laboratorio 4

Hazlas únicamente en la aplicación real publicada, una vez conectada:

1. Un usuario realiza una acción guardada, por ejemplo confirma su flota o dispara.
2. La misma información se recupera al iniciar sesión desde otro navegador o dispositivo.
3. El jugador A realiza un disparo en su navegador.
4. El jugador B ve el resultado en su navegador. En este proyecto debe aparecer automáticamente.

Para la tarjeta se necesitan el enlace corto de Vercel, el repositorio público y el commit de esta versión. La entrega final del laboratorio es una única tarjeta PDF del editor indicado por el profesor; este proyecto ZIP no sustituye esa tarjeta.

La frase de lo que falta debe describir el estado real después de la prueba. No afirmar que falta autenticación si ya está funcionando. Ejemplo si procede: «Me falta completar pruebas de reconexión con dos dispositivos; empezaré comprobando que un disparo confirmado no se repita al recuperar internet».
