import type { ReactNode } from 'react';

export const metadata = {
  title: 'Reservas de canchas',
  description: 'Reserva una cancha sin llamar a la sede',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: 16, maxWidth: 720 }}>
        {children}
      </body>
    </html>
  );
}
