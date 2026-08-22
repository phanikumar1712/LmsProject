const test = require('node:test');
const assert = require('node:assert/strict');
const {
    PERMISSIONS,
    ALL_PERMISSIONS,
    permissionsForRole,
    applyOverrides,
    hasPermission,
} = require('../src/utils/permissions');

test('SUPER_ADMIN implicitly holds every permission', () => {
    assert.deepEqual(permissionsForRole('SUPER_ADMIN'), ALL_PERMISSIONS);
    assert.ok(hasPermission({ role: 'SUPER_ADMIN' }, 'department.delete'));
    assert.ok(hasPermission({ role: 'SUPER_ADMIN' }, 'grade.update'));
    assert.ok(hasPermission({ role: 'SUPER_ADMIN' }, 'permission.manage'));
});

test('role matrix matches the spec: STUDENT basics only', () => {
    const student = { role: 'STUDENT' };
    assert.ok(hasPermission(student, 'course.view'));
    assert.ok(hasPermission(student, 'course.enroll'));
    assert.ok(hasPermission(student, 'assignment.submit'));
    assert.ok(hasPermission(student, 'quiz.attempt'));
    // Students must NOT hold privileged actions
    assert.equal(hasPermission(student, 'course.approve'), false);
    assert.equal(hasPermission(student, 'student.create'), false);
    assert.equal(hasPermission(student, 'grade.update'), false);
    assert.equal(hasPermission(student, 'audit.view'), false);
});

test('INSTRUCTOR can author but not approve or manage users', () => {
    const inst = { role: 'INSTRUCTOR' };
    assert.ok(hasPermission(inst, 'course.create'));
    assert.ok(hasPermission(inst, 'course.update'));
    assert.ok(hasPermission(inst, 'assignment.create'));
    assert.ok(hasPermission(inst, 'quiz.create'));
    assert.ok(hasPermission(inst, 'grade.update'));
    assert.equal(hasPermission(inst, 'course.approve'), false);
    assert.equal(hasPermission(inst, 'user.password.reset'), false);
    assert.equal(hasPermission(inst, 'instructor.create'), false);
});

test('ADMIN (dept-scoped) holds the department-admin permission set', () => {
    const admin = { role: 'ADMIN' };
    for (const p of ['student.create', 'student.update', 'student.delete', 'instructor.create', 'instructor.update', 'course.approve', 'course.update', 'audit.view']) {
        assert.ok(hasPermission(admin, p), `expected ADMIN to hold ${p}`);
    }
    // Department admins never get platform-wide powers
    assert.equal(hasPermission(admin, 'department.create'), false);
    assert.equal(hasPermission(admin, 'admin.create'), false);
    assert.equal(hasPermission(admin, 'platform.settings'), false);
});

test('unknown permissions are never granted implicitly', () => {
    assert.equal(hasPermission({ role: 'ADMIN' }, 'not.a.real.perm'), false);
    assert.equal(hasPermission({ role: 'INSTRUCTOR' }, 'fake'), false);
});

test('applyOverrides grants beyond the role and revokes from it', () => {
    // Grant an instructor grade.view of audit logs
    const base = permissionsForRole('INSTRUCTOR');
    const { permissions } = applyOverrides(base, new Map([['audit.view', true]]));
    assert.ok(permissions.includes('audit.view'));

    // Revoke quiz.create from an instructor
    const { permissions: revoked } = applyOverrides(base, new Map([['quiz.create', false]]));
    assert.equal(revoked.includes('quiz.create'), false);

    // Combined
    const combined = applyOverrides(base, new Map([['quiz.create', false], ['audit.view', true]]));
    assert.equal(combined.permissions.includes('quiz.create'), false);
    assert.ok(combined.permissions.includes('audit.view'));
    assert.ok(combined.permissions.includes('course.create')); // untouched default remains
});

test('stale/unknown override keys are ignored', () => {
    const base = permissionsForRole('ADMIN');
    const { permissions, overrides } = applyOverrides(base, new Map([['bogus.perm', true]]));
    assert.deepEqual(permissions, base);
    assert.deepEqual(overrides, []);
});

test('hasPermission honors per-user overrides', () => {
    const inst = { role: 'INSTRUCTOR' };
    // Override grants a permission the role lacks
    assert.equal(hasPermission(inst, 'audit.view', new Map([['audit.view', true]])), true);
    // Override revokes a permission the role has
    assert.equal(hasPermission(inst, 'quiz.create', new Map([['quiz.create', false]])), false);
    // No override → role default applies
    assert.equal(hasPermission(inst, 'quiz.create', new Map()), true);
    assert.equal(hasPermission(inst, 'audit.view', new Map()), false);
});

test('SUPER_ADMIN cannot be locked out by an override', () => {
    const sa = { role: 'SUPER_ADMIN' };
    assert.ok(hasPermission(sa, 'course.delete', new Map([['course.delete', false]])));
});

test('permission registry is complete and groups are well-formed', () => {
    // Every permission listed in ALL_PERMISSIONS has metadata with label/group
    for (const p of ALL_PERMISSIONS) {
        assert.ok(PERMISSIONS[p], `missing metadata for ${p}`);
        assert.ok(PERMISSIONS[p].label, `missing label for ${p}`);
        assert.ok(PERMISSIONS[p].group, `missing group for ${p}`);
    }
    // Every role's default set only references known permissions
    for (const role of ['STUDENT', 'INSTRUCTOR', 'ADMIN']) {
        for (const p of permissionsForRole(role)) {
            assert.ok(PERMISSIONS[p], `${role} references unknown permission ${p}`);
        }
    }
});
