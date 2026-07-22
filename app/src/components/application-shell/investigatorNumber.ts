export function createInvestigatorNumber(userId?: string | null) {
  if (!userId) {
    return 'LBIB-LOCAL';
  }

  let hash = 2166136261;

  for (let index = 0; index < userId.length; index += 1) {
    hash ^= userId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const numericId = (hash >>> 0) % 1000000;
  return `LBIB-${numericId.toString().padStart(6, '0')}`;
}
