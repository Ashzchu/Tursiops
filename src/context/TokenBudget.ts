export function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

export function fitToTokenBudget(
  items: Array<{ path: string; content: string }>,
  budgetTokens: number
): Array<{ path: string; content: string }> {
  // Sort by content length ascending (prefer shorter files — more context variety)
  const sorted = [...items].sort((a, b) => a.content.length - b.content.length);

  const result: Array<{ path: string; content: string }> = [];
  let used = 0;

  for (const item of sorted) {
    const tokens = estimateTokens(item.content);
    if (used + tokens <= budgetTokens) {
      result.push(item);
      used += tokens;
    }
  }

  return result;
}
