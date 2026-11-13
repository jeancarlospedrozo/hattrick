import { expect, test } from '@playwright/test';
import {
  AHORA_BASE,
  C1,
  SABADO,
  fijarReloj,
  iniciarSesion,
  nuevoJugador,
  avanzarReloj,
  reservarPorApi,
  vaciarReservas,
} from './helpers';

// El navegador corre en otra zona horaria: la página debe mostrar la hora de la sede (Principio II).
test.use({ timezoneId: 'Europe/Madrid' });

test.beforeEach(async ({ request }) => {
  vaciarReservas();
  await fijarReloj(request, AHORA_BASE);
});

const bloque = (page: import('@playwright/test').Page, hora: string) =>
  page.getByRole('button', { name: new RegExp(`^${hora}`) });

test.describe('US1', () => {
  test('AC1: reservar una franja libre muestra el resultado y la franja queda ocupada', async ({ page }) => {
    await iniciarSesion(page, nuevoJugador());
    await page.goto(`/canchas/${C1}?fecha=${SABADO}`);

    const inicio = Date.now();
    await bloque(page, '19:00').click();
    await page.getByLabel('Duración').selectOption('60');
    await page.getByRole('button', { name: 'Reservar' }).click();

    const resultado = page.getByTestId('resultado-reserva');
    await expect(resultado).toContainText('Pendiente de pago');
    await expect(resultado).toContainText('Expira a las 12:10');
    await expect(resultado).toContainText(/\$\s80\.000/);
    // SC-001: el jugador completa la reserva en menos de 1 minuto desde que elige la franja.
    expect(Date.now() - inicio).toBeLessThan(60_000);

    await page.reload();
    await expect(bloque(page, '19:00')).toBeDisabled();
    await expect(bloque(page, '19:30')).toBeDisabled();
    await expect(bloque(page, '20:00')).toBeEnabled();
  });
});

test.describe('US2', () => {
  test('AC2: con la disponibilidad desactualizada, el segundo jugador ve el mensaje y la grilla se recarga', async ({
    page,
    request,
  }) => {
    await iniciarSesion(page, nuevoJugador());
    await page.goto(`/canchas/${C1}?fecha=${SABADO}`);
    await expect(bloque(page, '19:00')).toBeEnabled();

    // Otro jugador toma la franja mientras la página sigue mostrando la disponibilidad anterior.
    const res = await reservarPorApi(request, nuevoJugador(), '19:00');
    expect(res.status()).toBe(201);

    await bloque(page, '19:00').click();
    await page.getByRole('button', { name: 'Reservar' }).click();

    await expect(page.getByTestId('error-reserva')).toHaveText('Esta franja ya no está disponible');
    await expect(bloque(page, '19:00')).toBeDisabled();
  });
});

test.describe('US3', () => {
  test('AC3: a los 10 minutos sin pago la franja vuelve a estar libre y otro jugador la reserva', async ({
    page,
    request,
  }) => {
    const res = await reservarPorApi(request, nuevoJugador(), '19:00');
    expect(res.status()).toBe(201);

    await iniciarSesion(page, nuevoJugador());
    await page.goto(`/canchas/${C1}?fecha=${SABADO}`);
    await expect(bloque(page, '19:00')).toBeDisabled();

    await avanzarReloj(request, 10 * 60_000);
    await page.reload();
    await expect(bloque(page, '19:00')).toBeEnabled();

    await bloque(page, '19:00').click();
    await page.getByRole('button', { name: 'Reservar' }).click();
    await expect(page.getByTestId('resultado-reserva')).toContainText('Pendiente de pago');
  });
});

test.describe('US4', () => {
  test('AC4: 22:30 se rechaza indicando el horario de la sede y 22:00 se acepta', async ({ page }) => {
    await iniciarSesion(page, nuevoJugador());
    await page.goto(`/canchas/${C1}?fecha=${SABADO}`);

    // 22:30 por 60 minutos (la duración por defecto) termina después del cierre: el backend la rechaza.
    await bloque(page, '22:30').click();
    await page.getByRole('button', { name: 'Reservar' }).click();
    await expect(page.getByTestId('error-reserva')).toHaveText('La sede abre de 06:00 a 23:00');

    await bloque(page, '22:00').click();
    await page.getByLabel('Duración').selectOption('60');
    await page.getByRole('button', { name: 'Reservar' }).click();
    await expect(page.getByTestId('resultado-reserva')).toContainText('Pendiente de pago');
  });
});
