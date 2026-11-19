import { isInputError, type SafeResult } from 'astro:actions';
import { toast } from 'sonner';
import { fieldErrors, type FieldErrors } from './errors';

export { fieldErrors, type FieldErrors };

/**
 * Ejecuta una acción y muestra un toast. Devuelve los datos, o `undefined` si falló.
 * Los errores de validación se devuelven en `onFieldErrors` para pintarlos en el formulario.
 */
export async function runAction<T>(
  promise: Promise<SafeResult<any, T>>,
  opts: { success?: string; onFieldErrors?: (errors: FieldErrors) => void } = {},
): Promise<T | undefined> {
  const { data, error } = await promise;
  if (error) {
    if (isInputError(error)) {
      const errors = fieldErrors(error);
      opts.onFieldErrors?.(errors);
      toast.error('Revisa los campos marcados.');
    } else if (error.code === 'UNAUTHORIZED') {
      toast.error(error.message);
      setTimeout(() => window.location.assign(`/admin/login?next=${encodeURIComponent(location.pathname)}`), 900);
    } else {
      toast.error(error.message || 'No se pudo completar la operación.');
    }
    return undefined;
  }
  opts.onFieldErrors?.({});
  if (opts.success) toast.success(opts.success);
  return data;
}

/** Vuelve a cargar los datos de la página actual sin perder la posición de scroll. */
export async function refreshPage(): Promise<void> {
  const y = window.scrollY;
  const { navigate } = await import('astro:transitions/client');
  document.addEventListener('astro:after-swap', () => window.scrollTo({ top: y }), { once: true });
  await navigate(location.pathname + location.search, { history: 'replace' });
}
