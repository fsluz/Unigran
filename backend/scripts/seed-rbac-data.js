import 'dotenv/config';
import { DIRECT_ROLE_PERMISSIONS, ROLE_HIERARCHY } from '../src/modules/auth/rbac.js';
import { readQuery, typeqlLiteral, writeQuery } from '../src/db/typedb.js';

function safe(value) {
  return typeqlLiteral(value);
}

async function exists(query) {
  return (await readQuery(query)).length > 0;
}

for (const [level, role] of ROLE_HIERARCHY.entries()) {
  if (!(await exists(`match $role isa rbac-role, has rbac-role-key "${safe(role)}"; fetch { "role": { $role.* } };`))) {
    await writeQuery(`insert $role isa rbac-role, has rbac-role-key "${safe(role)}", has rbac-level ${level};`);
  }
}

const permissions = new Set(Object.values(DIRECT_ROLE_PERMISSIONS).flat());
for (const permission of permissions) {
  const module = permission.split(':')[0];
  if (!(await exists(`match $permission isa rbac-permission, has rbac-permission-key "${safe(permission)}"; fetch { "permission": { $permission.* } };`))) {
    await writeQuery(`insert $permission isa rbac-permission, has rbac-permission-key "${safe(permission)}", has rbac-module "${safe(module)}";`);
  }
}

for (const [role, rolePermissions] of Object.entries(DIRECT_ROLE_PERMISSIONS)) {
  for (const permission of rolePermissions) {
    const linked = await exists(`
      match
        $role isa rbac-role, has rbac-role-key "${safe(role)}";
        $permission isa rbac-permission, has rbac-permission-key "${safe(permission)}";
        rbac-role-permission(role: $role, permission: $permission);
      fetch { "role": { $role.* } };
    `);
    if (!linked) {
      await writeQuery(`
        match
          $role isa rbac-role, has rbac-role-key "${safe(role)}";
          $permission isa rbac-permission, has rbac-permission-key "${safe(permission)}";
        insert $link isa rbac-role-permission, links (role: $role, permission: $permission);
      `);
    }
  }
}

for (let index = 1; index < ROLE_HIERARCHY.length; index += 1) {
  const child = ROLE_HIERARCHY[index];
  const parent = ROLE_HIERARCHY[index - 1];
  const linked = await exists(`
    match
      $child isa rbac-role, has rbac-role-key "${safe(child)}";
      $parent isa rbac-role, has rbac-role-key "${safe(parent)}";
      rbac-role-inheritance(child: $child, parent: $parent);
    fetch { "child": { $child.* } };
  `);
  if (!linked) {
    await writeQuery(`
      match
        $child isa rbac-role, has rbac-role-key "${safe(child)}";
        $parent isa rbac-role, has rbac-role-key "${safe(parent)}";
      insert $inheritance isa rbac-role-inheritance, links (child: $child, parent: $parent);
    `);
  }
}

console.log(`RBAC seeded: ${ROLE_HIERARCHY.length} roles and ${permissions.size} permissions.`);
