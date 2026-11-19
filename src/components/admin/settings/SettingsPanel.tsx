import { useState, type SubmitEvent, type ReactNode } from 'react';
import { actions } from 'astro:actions';
import { Copy, Download, Upload, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { USER_ROLES, USER_ROLE_KEYS, type UserRole } from '@/lib/domain/catalog';
import { refreshPage, runAction, type FieldErrors } from '@/lib/client/actions';
import type { SessionUser } from '@/lib/server/users';

interface Props {
  me: SessionUser;
  users: (SessionUser & { active: boolean })[];
}

const LEGACY_SNIPPET =
  "copy(JSON.stringify({rooms:JSON.parse(localStorage.hl_rooms||'[]'),reservations:JSON.parse(localStorage.hl_reservations||'[]'),expenses:JSON.parse(localStorage.hl_expenses||'[]')}))";

export default function SettingsPanel({ me, users }: Props) {
  const isAdmin = me.role === 'admin';
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Section title="Tu contraseña" description="Usa al menos 8 caracteres y no la compartas con nadie.">
        <PasswordForm />
      </Section>
      {isAdmin && (
        <Section title="Usuarios del panel" description="Recepción puede registrar reservas, pagos y egresos. Solo administración elimina registros y edita habitaciones.">
          <UsersPanel me={me} users={users} />
        </Section>
      )}
      {isAdmin && (
        <Section title="Respaldo" description="Descarga todos los datos en un archivo JSON. Guárdalo en un lugar seguro una vez por semana.">
          <a href="/admin/exportar.json" className="inline-flex h-10 items-center gap-2 rounded-xl border border-mist bg-surface px-4 text-sm font-medium hover:bg-pine-50">
            <Download className="size-4" /> Descargar respaldo
          </a>
        </Section>
      )}
      {isAdmin && (
        <Section title="Traer datos del sistema anterior" description="Copia las habitaciones, reservas y egresos que guardaba el archivo HTML anterior.">
          <LegacyImport />
        </Section>
      )}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-mist bg-surface p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-1 mb-5 text-sm text-ink-muted">{description}</p>
      {children}
    </section>
  );
}

function PasswordForm() {
  const [v, setV] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const ok = await runAction(actions.auth.changePassword(v), { success: 'Contraseña actualizada', onFieldErrors: setErrors });
    setBusy(false);
    if (ok) setV({ current: '', next: '', confirm: '' });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3" noValidate>
      <Field label="Actual" error={errors.current}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} />}
      </Field>
      <Field label="Nueva" error={errors.next}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} />}
      </Field>
      <Field label="Repite la nueva" error={errors.confirm}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />}
      </Field>
      <div className="sm:col-span-3">
        <Button type="submit" loading={busy}>
          Cambiar contraseña
        </Button>
      </div>
    </form>
  );
}

function UsersPanel({ me, users }: Props) {
  const [v, setV] = useState({ username: '', name: '', password: '', role: 'staff' as UserRole });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const ok = await runAction(actions.auth.createUser(v), { success: `Usuario ${v.username} creado`, onFieldErrors: setErrors });
    setBusy(false);
    if (ok) {
      setV({ username: '', name: '', password: '', role: 'staff' });
      setShowForm(false);
      await refreshPage();
    }
  }

  async function toggle(id: string, active: boolean) {
    const ok = await runAction(actions.auth.setUserActive({ id, active }), { success: active ? 'Usuario activado' : 'Usuario desactivado' });
    if (ok) await refreshPage();
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-mist rounded-xl border border-mist">
        {users.map((u) => (
          <li key={u.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{u.name}</span>
              <span className="block text-[13px] text-ink-muted">@{u.username}</span>
            </span>
            <Badge tone={u.role === 'admin' ? 'pine' : 'neutral'}>{USER_ROLES[u.role]}</Badge>
            {!u.active && <Badge tone="danger">Inactivo</Badge>}
            {u.id !== me.id && (
              <Button variant="ghost" size="sm" onClick={() => toggle(u.id, !u.active)}>
                {u.active ? 'Desactivar' : 'Activar'}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {showForm ? (
        <form onSubmit={submit} className="grid gap-4 rounded-xl bg-stone p-4 sm:grid-cols-2" noValidate>
          <Field label="Nombre" error={errors.name}>
            {(p) => <Input {...p} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}
          </Field>
          <Field label="Usuario" error={errors.username}>
            {(p) => <Input {...p} value={v.username} autoComplete="off" onChange={(e) => setV({ ...v, username: e.target.value })} />}
          </Field>
          <Field label="Contraseña inicial" error={errors.password}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />}
          </Field>
          <Field label="Rol" error={errors.role}>
            {(p) => (
              <Select {...p} value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as UserRole })}>
                {USER_ROLE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {USER_ROLES[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" loading={busy}>
              Crear usuario
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" icon={<UserPlus className="size-4" />} onClick={() => setShowForm(true)}>
          Agregar usuario
        </Button>
      )}
    </div>
  );
}

function LegacyImport() {
  const [json, setJson] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<{ rooms: number; reservations: number; expenses: number; skipped: string[] } | null>(null);

  async function submit() {
    setBusy(true);
    const res = await runAction(actions.data.importLegacy({ json }));
    setBusy(false);
    if (res) {
      setSummary(res);
      setJson('');
      toast.success(`Importado: ${res.rooms} habitaciones, ${res.reservations} reservas, ${res.expenses} egresos`);
    }
  }

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-soft">
        <li>Abre el archivo HTML anterior en el mismo navegador y computadora donde lo usabas.</li>
        <li>
          Presiona <kbd className="rounded border border-mist bg-stone px-1.5 text-xs">F12</kbd>, entra a la pestaña <strong>Consola</strong>, pega este código y presiona Enter:
          <div className="mt-2 flex items-start gap-2">
            <code className="block flex-1 overflow-x-auto rounded-lg bg-ink px-3 py-2 text-xs whitespace-nowrap text-pine-100">{LEGACY_SNIPPET}</code>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Copiar código"
              onClick={async () => {
                await navigator.clipboard.writeText(LEGACY_SNIPPET);
                toast.success('Código copiado');
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </li>
        <li>Los datos quedan copiados. Pégalos aquí abajo e importa.</li>
      </ol>
      <Textarea aria-label="Datos del sistema anterior" rows={4} value={json} onChange={(e) => setJson(e.target.value)} placeholder='{"rooms":[…],"reservations":[…],"expenses":[…]}' className="font-mono text-xs" />
      <Button icon={<Upload className="size-4" />} onClick={submit} loading={busy} disabled={json.trim().length < 2}>
        Importar datos
      </Button>
      {summary && (
        <div className="rounded-xl bg-pine-50 p-4 text-sm text-pine-800" role="status">
          <p className="font-medium">
            Se importaron {summary.rooms} habitaciones, {summary.reservations} reservas y {summary.expenses} egresos.
          </p>
          {summary.skipped.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-pine-700">
              {summary.skipped.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
