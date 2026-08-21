function fmt(n) {
  return new Intl.NumberFormat('uk-UA').format(Math.round(n * 100) / 100);
}

function prevYearMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Rule-based "AI" summary: no external model or API key needed — just a
// handful of statements computed straight from the numbers already on the
// dashboard (total, budget, top category, pace for the month, month-over-month).
function buildInsights({ summary, isCurrentMonth, prevMonthTotal }) {
  const { total, remaining, percentUsed, monthlyBudget, byCategory } = summary;
  const insights = [];

  if (total === 0) {
    insights.push('Витрат за цей місяць ще немає.');
    return insights;
  }

  insights.push(`Витрачено ${fmt(total)} грн за цей місяць.`);

  if (monthlyBudget > 0) {
    if (percentUsed >= 100) {
      insights.push(`Бюджет вичерпано — перевитрата ${fmt(Math.abs(remaining))} грн.`);
    } else if (percentUsed >= 80) {
      insights.push(`Залишилось ${fmt(remaining)} грн (${percentUsed}% бюджету вже використано) — ви наближаєтесь до ліміту.`);
    } else {
      insights.push(`Залишилось ${fmt(remaining)} грн (використано ${percentUsed}% бюджету).`);
    }
  }

  const top = [...byCategory].filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent)[0];
  if (top) {
    const share = Math.round((top.spent / total) * 100);
    insights.push(`Найбільше витрачено на «${top.name}» ${top.icon || ''} — ${fmt(top.spent)} грн (${share}% усіх витрат).`);
  }

  if (isCurrentMonth) {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (daysInMonth - dayOfMonth > 0) {
      const projected = Math.round((total / dayOfMonth) * daysInMonth);
      insights.push(`За таким темпом до кінця місяця вийде приблизно ${fmt(projected)} грн.`);
      if (monthlyBudget > 0 && projected > monthlyBudget) {
        insights.push(`Це більше за бюджет — варто скоротити витрати приблизно на ${fmt(projected - monthlyBudget)} грн, щоб вкластися.`);
      }
    }
  }

  if (prevMonthTotal > 0) {
    const diff = total - prevMonthTotal;
    const diffPercent = Math.round((Math.abs(diff) / prevMonthTotal) * 100);
    if (diffPercent >= 1) {
      insights.push(
        diff > 0
          ? `Це на ${diffPercent}% більше, ніж минулого місяця.`
          : `Це на ${diffPercent}% менше, ніж минулого місяця.`
      );
    }
  }

  return insights;
}

module.exports = { buildInsights, prevYearMonth };
