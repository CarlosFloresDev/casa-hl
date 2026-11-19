import { isInputError, type ActionError } from 'astro:actions';

export type FieldErrors = Record<string, string>;

/** Convierte errores de validación de una acción en { campo: mensaje } (soporta rutas anidadas "a.b"). */
export function fieldErrors(error: ActionError | undefined): FieldErrors {
  if (!error || !isInputError(error)) return {};
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.');
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
