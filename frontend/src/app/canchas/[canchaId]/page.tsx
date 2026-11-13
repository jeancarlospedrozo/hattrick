import { hoyEn } from '../../../lib/formato';
import { ReservaCancha } from './ReservaCancha';

interface Props {
  params: Promise<{ canchaId: string }>;
  searchParams: Promise<{ fecha?: string }>;
}

export default async function PaginaCancha({ params, searchParams }: Props) {
  const { canchaId } = await params;
  const { fecha } = await searchParams;
  // Sin fecha en la URL se usa "hoy" en la zona por defecto de las sedes (FR-015).
  return <ReservaCancha canchaId={canchaId} fecha={fecha ?? hoyEn('America/Bogota')} />;
}
