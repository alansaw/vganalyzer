export type Grade = 'A+' | 'A' | 'A-' | 'B' | 'C';

export const GRADES: Grade[] = ['A+', 'A', 'A-', 'B', 'C'];

export const GRADE_RANGES: Record<Grade, string> = {
  'A+': '95 and over',
  A: '90 – 95',
  'A-': '85 – 90',
  B: '70 – 85',
  C: 'below 70',
};

export function gradeForScore(score: number): Grade {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 70) return 'B';
  return 'C';
}

// CSS-safe class suffix for a grade ("A+" -> "aplus").
export function gradeClass(grade: Grade): string {
  return grade.toLowerCase().replace('+', 'plus').replace('-', 'minus');
}
