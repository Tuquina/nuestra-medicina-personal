/**
 * Reflection questions for "Preguntas para reflexionar", grouped by
 * theme. Each question has a stable id so saved favorites and answers keep
 * pointing at the right text even if the list is reordered.
 */
export interface ReflectionTheme {
  id: string;
  label: string;
}

export interface ReflectionQuestion {
  id: string;
  theme: string;
  text: string;
}

export const REFLECTION_THEMES: readonly ReflectionTheme[] = [
  { id: 'semana', label: 'Mi semana' },
  { id: 'emociones', label: 'Emociones' },
  { id: 'vinculos', label: 'Vínculos' },
  { id: 'cuerpo', label: 'Cuerpo y descanso' },
  { id: 'cultivar', label: 'Lo que quiero cultivar' },
];

export const REFLECTION_QUESTIONS: readonly ReflectionQuestion[] = [
  { id: 'semana-1', theme: 'semana', text: '¿Qué momento de esta semana te gustaría guardar?' },
  { id: 'semana-2', theme: 'semana', text: '¿Qué te costó más de lo que esperabas? ¿Qué te ayudó?' },
  { id: 'semana-3', theme: 'semana', text: '¿Qué hiciste esta semana solo para vos?' },
  { id: 'semana-4', theme: 'semana', text: '¿Qué te gustaría hacer distinto la próxima semana?' },
  { id: 'semana-5', theme: 'semana', text: '¿En qué momento te sentiste más presente?' },
  { id: 'semana-6', theme: 'semana', text: '¿Qué pequeño logro no te reconociste todavía?' },
  { id: 'semana-7', theme: 'semana', text: '¿Qué quedó pendiente, y qué podés dejar ir sin culpa?' },
  { id: 'semana-8', theme: 'semana', text: 'Si esta semana fuera un paisaje, ¿cómo sería?' },

  { id: 'emociones-1', theme: 'emociones', text: '¿Qué emoción te acompañó más estos días?' },
  { id: 'emociones-2', theme: 'emociones', text: '¿Hay algo que sentiste y no pudiste expresar?' },
  { id: 'emociones-3', theme: 'emociones', text: '¿Qué te dice tu enojo, si lo escuchás sin juzgarlo?' },
  { id: 'emociones-4', theme: 'emociones', text: '¿Qué te trae alegría últimamente, aunque sea algo simple?' },
  { id: 'emociones-5', theme: 'emociones', text: '¿Qué tristeza merece un poco más de cuidado?' },
  { id: 'emociones-6', theme: 'emociones', text: '¿Cuándo fue la última vez que te sentiste en calma? ¿Qué había ahí?' },
  { id: 'emociones-7', theme: 'emociones', text: '¿Qué miedo te gustaría mirar de frente, con ternura?' },
  { id: 'emociones-8', theme: 'emociones', text: '¿Qué necesitás cuando te sentís desbordada o desbordado?' },

  { id: 'vinculos-1', theme: 'vinculos', text: '¿Con quién te sentiste acompañada o acompañado esta semana?' },
  { id: 'vinculos-2', theme: 'vinculos', text: '¿A quién te gustaría agradecerle algo?' },
  { id: 'vinculos-3', theme: 'vinculos', text: '¿Qué vínculo te pide más presencia, y cuál más distancia?' },
  { id: 'vinculos-4', theme: 'vinculos', text: '¿Qué te gustaría decirle a alguien y todavía no dijiste?' },
  { id: 'vinculos-5', theme: 'vinculos', text: '¿Cómo te tratás cuando te equivocás?' },
  { id: 'vinculos-6', theme: 'vinculos', text: '¿En qué relaciones podés ser como sos, sin esfuerzo?' },
  { id: 'vinculos-7', theme: 'vinculos', text: '¿Qué límite cuidaste, o te gustaría cuidar?' },
  { id: 'vinculos-8', theme: 'vinculos', text: '¿Qué aprendiste de alguien cercano últimamente?' },

  { id: 'cuerpo-1', theme: 'cuerpo', text: '¿Cómo descansaste esta semana? ¿Qué te faltó?' },
  { id: 'cuerpo-2', theme: 'cuerpo', text: '¿Qué parte de tu cuerpo te pide atención hoy?' },
  { id: 'cuerpo-3', theme: 'cuerpo', text: '¿Qué movimiento o actividad te hace sentir bien?' },
  { id: 'cuerpo-4', theme: 'cuerpo', text: '¿Cuándo te diste permiso para frenar?' },
  { id: 'cuerpo-5', theme: 'cuerpo', text: '¿Qué te ayuda a dormir mejor? ¿Lo estás pudiendo hacer?' },
  { id: 'cuerpo-6', theme: 'cuerpo', text: '¿Qué te dice tu respiración en este momento?' },
  { id: 'cuerpo-7', theme: 'cuerpo', text: '¿Qué comida, lugar o ritual te hace sentir en casa?' },
  { id: 'cuerpo-8', theme: 'cuerpo', text: '¿Cómo sería un día un poco más amable con tu cuerpo?' },

  { id: 'cultivar-1', theme: 'cultivar', text: '¿Qué hábito pequeño te gustaría sembrar?' },
  { id: 'cultivar-2', theme: 'cultivar', text: '¿Qué te gustaría que fuera más simple en tu vida?' },
  { id: 'cultivar-3', theme: 'cultivar', text: '¿Qué valor querés que guíe tus decisiones este mes?' },
  { id: 'cultivar-4', theme: 'cultivar', text: '¿Qué te gustaría aprender, solo por el placer de hacerlo?' },
  { id: 'cultivar-5', theme: 'cultivar', text: '¿Qué espacio de tu día podrías cuidar como un refugio?' },
  { id: 'cultivar-6', theme: 'cultivar', text: '¿Qué versión de vos te gustaría acompañar a crecer?' },
  { id: 'cultivar-7', theme: 'cultivar', text: '¿Qué te gustaría agradecerte dentro de un año?' },
  { id: 'cultivar-8', theme: 'cultivar', text: '¿Qué podés regar hoy, aunque sea un poco?' },
];

export function questionById(id: string): ReflectionQuestion | undefined {
  return REFLECTION_QUESTIONS.find((question) => question.id === id);
}

export function themeLabel(themeId: string): string {
  return REFLECTION_THEMES.find((theme) => theme.id === themeId)?.label ?? '';
}
