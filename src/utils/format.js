export function formatGems(val) {
  const num = Number(val) || 0;
  if (num >= 11000) {
    const inK = num / 1000;
    return (inK % 1 === 0 ? inK.toFixed(0) : inK.toFixed(1)) + 'k';
  }
  return num.toLocaleString();
}

export function formatUsdt(val) {
  const num = Number(val) || 0;
  return num.toFixed(3);
}
