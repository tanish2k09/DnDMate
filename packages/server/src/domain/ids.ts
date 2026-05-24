/** Generate a unique identifier for a domain entity. */
export function generateId(): string {
  return crypto.randomUUID();
}
