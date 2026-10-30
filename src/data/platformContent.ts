import { ModuleId } from '../types/sat';

export interface ExamDateItem {
  id: string;
  label: string;
  iso: string;
}

export interface StudyPlanTemplateItem {
  id: string;
  title: string;
  duration: string;
  moduleId?: ModuleId;
}

export interface VocabularyItem {
  id: string;
  word: string;
  part: string;
  definition: string;
  example: string;
}

export interface FormulaGroupItem {
  id: string;
  title: string;
  formulas: string[];
}

export interface PromocodeItem {
  id: string;
  code: string;
  planName: string;
  bonusPoints: number;
  active: boolean;
}

export interface PlatformContentConfig {
  examDates: ExamDateItem[];
  studyPlanTemplates: StudyPlanTemplateItem[];
  vocabulary: VocabularyItem[];
  formulaGroups: FormulaGroupItem[];
  promocodes: PromocodeItem[];
}

export const DEFAULT_PLATFORM_CONTENT: PlatformContentConfig = {
  examDates: [
    { id: 'ed_1', label: 'Nov 7, 2026', iso: '2026-11-07' },
    { id: 'ed_2', label: 'Dec 5, 2026', iso: '2026-12-05' },
    { id: 'ed_3', label: 'Mar 6, 2027', iso: '2027-03-06' },
    { id: 'ed_4', label: 'May 1, 2027', iso: '2027-05-01' },
    { id: 'ed_5', label: 'Jun 5, 2027', iso: '2027-06-05' },
  ],
  studyPlanTemplates: [
    {
      id: 'sp_1',
      title: 'Section 1: Reading & Writing Module 1 (27 questions)',
      duration: '32 min',
      moduleId: 'rw_1',
    },
    {
      id: 'sp_2',
      title: 'Section 1: Reading & Writing Module 2 (27 questions)',
      duration: '32 min',
      moduleId: 'rw_2',
    },
    {
      id: 'sp_3',
      title: 'Section 2: Math Module 1 (22 questions)',
      duration: '35 min',
      moduleId: 'math_1',
    },
    {
      id: 'sp_4',
      title: 'Section 2: Math Module 2 (22 questions)',
      duration: '35 min',
      moduleId: 'math_2',
    },
  ],
  vocabulary: [
    {
      id: 'voc_1',
      word: 'Ubiquitous',
      part: 'adjective',
      definition: 'Present, appearing, or found everywhere.',
      example: 'Smartphones have become ubiquitous in modern daily life.',
    },
    {
      id: 'voc_2',
      word: 'Mitigate',
      part: 'verb',
      definition: 'Make less severe, serious, or painful.',
      example: 'Planting urban trees helps mitigate the heat island effect.',
    },
    {
      id: 'voc_3',
      word: 'Ephemeral',
      part: 'adjective',
      definition: 'Lasting for a very short time.',
      example: 'Desert wildflowers produce ephemeral blooms after rare rainfall.',
    },
    {
      id: 'voc_4',
      word: 'Corroborate',
      part: 'verb',
      definition: 'Confirm or give support to a statement, theory, or finding.',
      example: 'Independent ice-core samples corroborate the climate model predictions.',
    },
    {
      id: 'voc_5',
      word: 'Ambivalent',
      part: 'adjective',
      definition: 'Having mixed feelings or contradictory ideas about something.',
      example: 'Critics remained ambivalent about the novel’s unconventional ending.',
    },
    {
      id: 'voc_6',
      word: 'Pragmatic',
      part: 'adjective',
      definition: 'Dealing with things sensibly and realistically in a practical way.',
      example: 'The committee adopted a pragmatic approach to municipal budgeting.',
    },
    {
      id: 'voc_7',
      word: 'Ostentatious',
      part: 'adjective',
      definition: 'Characterized by vulgar or pretentious display; designed to impress.',
      example: 'The architect favored clean lines over ostentatious ornamentation.',
    },
    {
      id: 'voc_8',
      word: 'Tenuous',
      part: 'adjective',
      definition: 'Very weak or slight; lacking a strong basis.',
      example: 'The historian noted only a tenuous connection between the two treaties.',
    },
  ],
  formulaGroups: [
    {
      id: 'fg_1',
      title: 'Area & Circumference',
      formulas: [
        'Circle Area: A = πr²',
        'Circle Circumference: C = 2πr',
        'Rectangle Area: A = lw',
        'Triangle Area: A = ½bh',
      ],
    },
    {
      id: 'fg_2',
      title: 'Volume Formulas',
      formulas: [
        'Rectangular Prism: V = lwh',
        'Cylinder: V = πr²h',
        'Sphere: V = (4/3)πr³',
        'Cone: V = (1/3)πr²h',
        'Pyramid: V = (1/3)lwh',
      ],
    },
    {
      id: 'fg_3',
      title: 'Key Facts & Theorems',
      formulas: [
        'Pythagorean Theorem: a² + b² = c²',
        'Special Right Triangles: 30°–60°–90° (x, x√3, 2x) and 45°–45°–90° (s, s, s√2)',
        'The number of degrees of arc in a circle is 360.',
        'The number of radians of arc in a circle is 2π.',
        'The sum of the measures in degrees of the angles of a triangle is 180.',
      ],
    },
  ],
  promocodes: [
    {
      id: 'prm_1',
      code: 'BLUEBOOK2026',
      planName: 'Pro plan',
      bonusPoints: 500,
      active: true,
    },
    {
      id: 'prm_2',
      code: 'SAT1600',
      planName: 'Pro Max plan',
      bonusPoints: 1000,
      active: true,
    },
  ],
};

const STORAGE_KEY = 'bluebook_sat_platform_content_v1';

export function loadPlatformContent(): PlatformContentConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLATFORM_CONTENT;
    const parsed = JSON.parse(raw) as Partial<PlatformContentConfig>;
    return {
      examDates:
        Array.isArray(parsed.examDates) && parsed.examDates.length > 0
          ? parsed.examDates
          : DEFAULT_PLATFORM_CONTENT.examDates,
      studyPlanTemplates:
        Array.isArray(parsed.studyPlanTemplates) && parsed.studyPlanTemplates.length > 0
          ? parsed.studyPlanTemplates
          : DEFAULT_PLATFORM_CONTENT.studyPlanTemplates,
      vocabulary:
        Array.isArray(parsed.vocabulary) && parsed.vocabulary.length > 0
          ? parsed.vocabulary
          : DEFAULT_PLATFORM_CONTENT.vocabulary,
      formulaGroups:
        Array.isArray(parsed.formulaGroups) && parsed.formulaGroups.length > 0
          ? parsed.formulaGroups
          : DEFAULT_PLATFORM_CONTENT.formulaGroups,
      promocodes:
        Array.isArray(parsed.promocodes) && parsed.promocodes.length > 0
          ? parsed.promocodes
          : DEFAULT_PLATFORM_CONTENT.promocodes,
    };
  } catch {
    return DEFAULT_PLATFORM_CONTENT;
  }
}

export function savePlatformContent(config: PlatformContentConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore storage errors
  }
}
