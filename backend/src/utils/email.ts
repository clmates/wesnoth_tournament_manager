export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return local[0] + '*'.repeat(local.length - 1) + '@' + domain;
  }
  return (
    local[0] +
    '*'.repeat(local.length - 2) +
    local[local.length - 1] +
    '@' +
    domain
  );
}