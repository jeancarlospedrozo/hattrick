# Feature Specification: Crear reserva

**Feature Branch**: `001-crear-reserva`

**Created**: 2026-10-31

**Status**: Approved

**Input**: User description: "Feature 001: Crear reserva. Como jugador, quiero reservar una cancha en una franja libre para asegurar mi partido sin llamar a la sede."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Reservar una franja libre (Priority: P1)

Un jugador elige una cancha y una franja libre y la reserva sin llamar a la sede. La reserva queda
pendiente de pago y nadie más puede tomar esa franja.

**Why this priority**: es el valor central de la funcionalidad: sin esto no hay reservas.

**Independent Test**: reservar una franja libre con un jugador y comprobar el estado de la reserva
y que la franja deja de mostrarse libre.

**Acceptance Scenarios**:

1. **(AC1) Given** que la cancha C1 está libre el sábado de 19:00 a 20:00, **When** el jugador la
   reserva, **Then** la reserva queda "pendiente de pago" y la franja deja de mostrarse libre.
2. **Given** una reserva de C1 de 19:00 a 20:00, **When** otro jugador consulta la disponibilidad
   de la cancha C2 en ese horario, **Then** C2 sigue mostrándose libre.
3. **Given** una reserva de C1 que termina a las 20:00, **When** un jugador reserva C1 de 20:00 a
   21:00, **Then** la reserva se acepta porque las franjas no se solapan.
4. **Given** una persona sin autenticar, **When** intenta reservar una franja libre, **Then** la
   solicitud se rechaza y no se crea ninguna reserva.
5. **Given** una reserva recién creada, **When** el jugador ve su resultado, **Then** se le informa
   el momento de expiración en la hora de la sede y el valor a pagar.
6. **Given** una reserva creada, **When** se revisan sus datos, **Then** el único dato personal
   asociado es la referencia al jugador.
7. **Given** una reserva de C1 el sábado de 19:00 a 20:00, **When** un jugador consulta la
   disponibilidad de C1 para ese sábado, **Then** ve esa franja como ocupada (sin datos de quién la
   reservó) y el resto del horario de la sede como libre, en la hora de la sede.

---

### User Story 2 - Resolver reservas simultáneas (Priority: P1)

Cuando dos jugadores intentan tomar la misma franja a la vez, solo uno la obtiene y el otro recibe
un mensaje claro.

**Why this priority**: la doble reserva de una cancha es el fallo que el sistema nunca debe permitir.

**Independent Test**: enviar a la vez dos solicitudes de jugadores distintos para la misma franja y
comprobar que solo existe una reserva y que el otro jugador ve el mensaje indicado.

**Acceptance Scenarios**:

1. **(AC2) Given** que dos jugadores intentan reservar la misma franja al mismo tiempo, **When**
   ambos confirman, **Then** solo uno obtiene la reserva y el otro ve "Esta franja ya no está
   disponible".
2. **Given** una reserva de C1 de 19:00 a 20:30, **When** otro jugador intenta reservar C1 de 20:00
   a 21:00, **Then** el intento se rechaza con el mensaje "Esta franja ya no está disponible".

---

### User Story 3 - Liberar franjas sin pago (Priority: P2)

Si el jugador no paga a tiempo, la reserva expira y la franja vuelve a estar disponible para otros.

**Why this priority**: evita que reservas abandonadas bloqueen canchas, pero requiere que el flujo
de reserva ya exista.

**Independent Test**: crear una reserva, dejar pasar 10 minutos sin pago y comprobar que está
expirada y que otro jugador puede reservar la misma franja.

**Acceptance Scenarios**:

1. **(AC3) Given** una reserva pendiente de pago, **When** pasan 10 minutos sin pago, **Then** la
   reserva pasa a "expirada" y la franja vuelve a estar libre.
2. **Given** un jugador con una reserva expirada, **When** intenta pagarla, **Then** el pago no se
   acepta y se le indica que la reserva expiró.

---

### User Story 4 - Aplicar las reglas de reserva (Priority: P2)

El sistema rechaza las solicitudes que incumplen el horario de la sede o las reglas de negocio, e
indica al jugador el motivo para que pueda corregirlas.

**Why this priority**: protege la operación de la sede y evita acaparar franjas, pero el flujo
principal aporta valor sin estas restricciones.

**Independent Test**: enviar una solicitud que incumpla cada regla y comprobar que no se crea
ninguna reserva y que el motivo mostrado corresponde a la regla.

**Acceptance Scenarios**:

1. **(AC4) Given** que la sede abre de 06:00 a 23:00, **When** el jugador intenta reservar de 22:30
   a 23:30, **Then** el sistema lo rechaza indicando el horario de la sede.
2. **Given** que la sede abre de 06:00 a 23:00, **When** el jugador reserva de 22:00 a 23:00,
   **Then** la reserva se acepta.
3. **(RN1) Given** una cancha libre, **When** el jugador intenta reservar 30 o 75 minutos, **Then**
   el sistema lo rechaza indicando la duración permitida.
4. **(RN1) Given** una cancha libre, **When** el jugador reserva 60 o 90 minutos, **Then** la
   reserva se acepta.
5. **Given** una cancha libre, **When** el jugador intenta reservar de 19:15 a 20:15, **Then** el
   sistema lo rechaza indicando que la franja debe empezar en una hora en punto o una media hora.
6. **(RN2) Given** la fecha y hora actuales, **When** el jugador intenta reservar una franja que
   empieza a más de 14 días, **Then** el sistema lo rechaza indicando la antelación máxima.
7. **(RN3) Given** un jugador con 2 reservas pendientes de pago, **When** intenta crear otra,
   **Then** el sistema lo rechaza indicando el límite.
8. **(RN3) Given** un jugador con 2 reservas pendientes de pago, **When** una de ellas expira y
   crea otra, **Then** la reserva se acepta.

### Edge Cases

- **Solicitudes simultáneas del mismo jugador**: si envía a la vez varias solicitudes, nunca puede
  superar las 2 reservas pendientes de pago.
- **Doble envío**: si la misma solicitud se envía dos veces (doble clic o reintento), se crea como
  máximo una reserva y el segundo envío devuelve esa misma reserva, sin mostrar un error.
- **Disponibilidad desactualizada**: si la franja se ocupó después de mostrarse libre, el jugador ve
  "Esta franja ya no está disponible".
- **Pago en el límite**: la reserva expira exactamente a los 10 minutos de su creación; un pago
  recibido en ese instante o después no se acepta.
- **Expiración pendiente de procesar**: al cumplirse los 10 minutos, la franja se considera libre
  aunque el cambio de estado aún no se haya registrado.
- **Límite de antelación**: una franja que empieza exactamente a 14 días se acepta.
- **Franjas pasadas**: una franja cuyo inicio ya pasó se rechaza.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Los jugadores autenticados DEBEN poder reservar una cancha indicando la franja, siempre
  a su propio nombre; las solicitudes sin autenticar DEBEN rechazarse.
- **FR-002**: El sistema DEBE crear cada reserva aceptada en estado "pendiente de pago" e informar
  al jugador el momento en que expira.
- **FR-003**: Una reserva "pendiente de pago" o "confirmada" DEBE ocupar su franja: esta deja de
  mostrarse libre y no puede reservarse.
- **FR-004**: El sistema NUNCA DEBE permitir dos reservas que ocupen franjas solapadas en la misma
  cancha, aunque las solicitudes lleguen al mismo tiempo.
- **FR-005**: Las franjas DEBEN tratarse como intervalos semiabiertos `[inicio, fin)`: una franja
  que termina a una hora no se solapa con otra que empieza a esa misma hora.
- **FR-006**: Si la franja está ocupada, el sistema DEBE rechazar la solicitud con el mensaje "Esta
  franja ya no está disponible".
- **FR-007**: Una reserva sin pago DEBE pasar a "expirada" a los 10 minutos de su creación, y su
  franja DEBE quedar libre desde ese momento. El plazo de 10 minutos es fijo e igual para todas las
  sedes.
- **FR-008**: El sistema DEBE rechazar el pago de una reserva expirada.
- **FR-009**: La franja DEBE quedar completa dentro del horario de la sede; en caso contrario, el
  sistema DEBE rechazarla indicando ese horario.
- **FR-010 (RN1)**: La duración DEBE ser de al menos 60 minutos y múltiplo de 30 minutos.
- **FR-011**: El inicio de la franja DEBE coincidir con una hora en punto o una media hora.
- **FR-012 (RN2)**: El inicio de la franja DEBE ser posterior al momento de la solicitud y estar a
  14 días como máximo de ese momento.
- **FR-013 (RN3)**: Un jugador NO DEBE tener más de 2 reservas pendientes de pago en total, aunque
  envíe solicitudes simultáneas. Las reservas expiradas o confirmadas no cuentan.
- **FR-014**: Cada rechazo por FR-009 a FR-013 DEBE indicar al jugador el motivo y no debe crear
  ninguna reserva.
- **FR-015**: Las horas DEBEN mostrarse e interpretarse en la zona horaria de la sede
  (America/Bogota por defecto).
- **FR-016**: El sistema DEBE tratar los reintentos de una misma solicitud de forma que se cree como
  máximo una reserva. Un reintento del mismo jugador DEBE recibir la reserva ya creada (con su estado
  y momento de expiración) en lugar de un rechazo.
- **FR-017**: La reserva DEBE guardar solo los datos personales mínimos: la referencia al jugador
  que la creó.
- **FR-018**: El sistema DEBE permitir consultar, para una cancha y un día, qué franjas dentro del
  horario de la sede están libres y cuáles ocupadas (por reservas pendientes de pago o confirmadas),
  mostradas en la hora de la sede. La consulta no expone datos del jugador que ocupa la franja. La
  vista de todas las canchas de una sede o con filtros queda fuera de alcance.
- **FR-019**: Al crear la reserva, el sistema DEBE calcular su valor como la tarifa por hora de la
  cancha multiplicada por la duración en horas, guardarlo en la reserva y mostrárselo al jugador. Un
  cambio posterior de tarifa NO DEBE alterar el valor de reservas ya creadas.

### Key Entities _(include if feature involves data)_

- **Reserva**: ocupación de una cancha por un jugador. Atributos: cancha, jugador, inicio, fin,
  estado (pendiente de pago, confirmada, expirada), valor a pagar, momento de creación y momento de
  expiración.
- **Cancha**: espacio reservable que pertenece a una sede. Atributos: tarifa por hora (única para
  todos los horarios).
- **Sede**: lugar que agrupa canchas. Atributos: horario de apertura y cierre, y zona horaria.
- **Jugador**: persona autenticada que crea reservas.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Un jugador puede completar una reserva en menos de 1 minuto desde que elige la franja.
- **SC-002**: En el 100% de las pruebas con solicitudes simultáneas para una misma franja, exactamente
  una solicitud obtiene la reserva.
- **SC-003**: Nunca se registran dos reservas activas solapadas en la misma cancha (0 casos).
- **SC-004**: El 100% de las franjas sin pago vuelve a mostrarse libre a los 10 minutos de crearse
  la reserva.
- **SC-005**: El 100% de las solicitudes que incumplen una regla se rechaza con su motivo y sin crear
  una reserva.
- **SC-006**: El 90% de los jugadores completa su reserva en el primer intento sin contactar a la sede.

## Assumptions

- Autenticación, sedes, canchas y horarios los proporcionan otras funcionalidades, que aún no
  existen en este repositorio.
- El registro y el pago son funcionalidades aparte; aquí solo se define que una reserva pagada deja
  de expirar y pasa a "confirmada". El consentimiento de datos personales se obtiene en el registro.
- El horario de 06:00 a 23:00 es un ejemplo: cada sede define el suyo, igual para todos los días.
- La Constitución (Principio I) prohíbe el solapamiento entre reservas confirmadas; esta spec lo
  extiende a las pendientes de pago, porque AC1 y AC2 exigen que también ocupen la franja.
- RN1 fija la duración, no la hora de inicio: la alineación a horas en punto o medias horas (FR-011)
  es un valor por defecto para evitar huecos inutilizables.
- No hay duración máxima, salvo el horario de la sede.
- El límite de RN3 es global para el jugador, no por sede.
- Un jugador puede tener reservas en canchas distintas a la misma hora, ya que ninguna regla lo prohíbe.
- Los 14 días de RN2 se cuentan como 14 periodos de 24 horas desde la solicitud hasta el inicio.
- Las reservas expiradas se conservan como historial y no ocupan su franja.
- La tarifa por hora de cada cancha la proporciona la funcionalidad de canchas y se expresa en pesos
  colombianos; las tarifas por horario pico quedan fuera de alcance.

## Fuera de alcance

- Pagos divididos entre jugadores.
- Reservas recurrentes.
- Cancelación o modificación de reservas.
- Reservas creadas por el personal de la sede a nombre de un jugador.
- Vista de disponibilidad de varias canchas a la vez o con filtros (solo se incluye la consulta por
  cancha y día de FR-018).

## Clarifications

### Session 2026-11-11

- Q: ¿La consulta de disponibilidad forma parte de esta feature o la entrega otra? → A: Esta feature
  incluye una consulta mínima de disponibilidad: franjas libres y ocupadas de una cancha para un día.
- Q: Si el mismo jugador envía dos veces la misma solicitud, ¿qué recibe en el segundo envío? → A: La
  misma reserva ya creada (estado y expiración), sin crear otra ni mostrar error.
- Q: ¿Al crear la reserva se calcula, guarda y muestra el valor a pagar? → A: Sí, con una tarifa por
  hora de la cancha (única para todos los horarios); el valor queda fijo en la reserva.
- Q: ¿Solo los jugadores crean reservas o también el personal a nombre de un jugador? → A: Solo
  jugadores autenticados, para sí mismos; la reserva por el personal queda fuera de alcance.
- Q: ¿El plazo de 10 minutos para pagar es fijo o configurable por sede? → A: Fijo en 10 minutos para
  todas las sedes.
