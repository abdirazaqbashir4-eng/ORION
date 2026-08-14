import type { User } from "@/lib/supabase/types";

export type Role = User["role"];

const ROLE_RANK: Record<Role, number> = { member: 0, admin: 1, owner: 2 };

export function hasRole(user: Pick<User, "role">, minimum: Role): boolean {
  return ROLE_RANK[user.role] >= ROLE_RANK[minimum];
}
