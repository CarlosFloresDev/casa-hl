/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: import('./lib/server/users').SessionUser | null;
  }
  interface SessionData {
    userId: string;
  }
}
