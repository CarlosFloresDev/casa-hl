import { auth } from './auth';
import { data, expenses, inquiries, reservations, rooms } from './admin';
import { site } from './public';

export const server = {
  auth,
  rooms,
  reservations,
  expenses,
  inquiries,
  data,
  site,
};
