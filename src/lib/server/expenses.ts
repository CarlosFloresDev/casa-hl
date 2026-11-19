import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { db } from '../db/client';
import { expenses, type Expense } from '../db/schema';
import type { PaymentMethod } from '../domain/catalog';
import { DomainError } from './errors';

export interface ExpenseInput {
  concept: string;
  category: string;
  amountCents: number;
  method: PaymentMethod;
  spentOn: string;
}

/** Egresos en el rango [from, to). Sin rango devuelve todos. */
export async function listExpenses(range: { from?: string; to?: string } = {}): Promise<Expense[]> {
  return db
    .select()
    .from(expenses)
    .where(
      and(
        range.from ? gte(expenses.spentOn, range.from) : undefined,
        range.to ? lt(expenses.spentOn, range.to) : undefined,
      ),
    )
    .orderBy(desc(expenses.spentOn), desc(expenses.createdAt));
}

export async function createExpense(input: ExpenseInput, userId: string | null): Promise<void> {
  await db.insert(expenses).values({ ...input, concept: input.concept.trim(), createdBy: userId });
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<void> {
  const [row] = await db
    .update(expenses)
    .set({ ...input, concept: input.concept.trim() })
    .where(eq(expenses.id, id))
    .returning({ id: expenses.id });
  if (!row) throw new DomainError('NOT_FOUND', 'El egreso no existe.');
}

export async function deleteExpense(id: string): Promise<void> {
  await db.delete(expenses).where(eq(expenses.id, id));
}
