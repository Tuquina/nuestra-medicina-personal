/**
 * Daily writing prompts for "Registro de escritura diaria". One is chosen
 * per calendar day (see `promptForDay`), and the visitor can ask for
 * another. Phrased as invitations, never as tasks.
 */
export const WRITING_PROMPTS: readonly string[] = [
  '¿Cómo está tu cuerpo en este momento? Empezá por ahí.',
  'Escribí sobre algo pequeño que hoy te hizo bien.',
  '¿Qué te está pidiendo atención últimamente?',
  'Si este día tuviera un color, ¿cuál sería y por qué?',
  'Escribí una carta breve a la persona que eras hace un año.',
  '¿Qué pensamiento se repite hoy? Dejalo salir en el papel.',
  'Nombrá tres sonidos que escuchás ahora y lo que te despiertan.',
  '¿Qué necesitarías para que mañana sea un poco más amable?',
  'Recordá un lugar donde te sentiste en paz. Describilo con detalle.',
  '¿Qué estás cargando que quizás no te corresponde?',
  'Escribí sobre una conversación que te quedó dando vueltas.',
  '¿Qué aprendiste de vos esta semana?',
  'Si pudieras decirte algo con ternura hoy, ¿qué sería?',
  '¿Qué emoción llegó primero esta mañana? ¿Sigue ahí?',
  'Escribí sobre algo que estás esperando con ganas.',
  '¿Qué te gustaría soltar antes de dormir?',
  'Describí un gesto de alguien que te conmovió.',
  '¿Qué parte de tu rutina disfrutás más? ¿Por qué?',
  'Escribí sin parar durante unos minutos, sin corregir nada.',
  '¿Dónde sentís el cansancio? ¿Y dónde el descanso?',
  '¿Qué límite te gustaría cuidar un poco más?',
  'Escribí sobre una decisión que estás postergando.',
  '¿Qué cosas te devuelven a vos cuando te perdés en el día?',
  'Hacé una lista de lo que hoy sí pudiste hacer.',
  'Escribí sobre un recuerdo de infancia que aparezca ahora.',
  '¿Qué te dirías si fueras tu mejor amiga o amigo?',
  '¿Qué te sorprendió hoy, aunque sea un poco?',
  'Describí cómo te gustaría sentirte al terminar este día.',
  '¿Qué palabra resume este momento de tu vida?',
  'Escribí sobre algo que te da miedo, con mucho cuidado y sin apuro.',
];

/** The prompt shown by default on a given day (stable for the whole day). */
export function promptForDay(dayNumber: number): number {
  return ((dayNumber % WRITING_PROMPTS.length) + WRITING_PROMPTS.length) % WRITING_PROMPTS.length;
}

/** "¿Cómo llegás hoy?" — optional, one at a time, no right answer. */
export const MOODS: readonly string[] = [
  'Calma',
  'Cansancio',
  'Inquietud',
  'Alegría',
  'Tristeza',
  'Gratitud',
  'Enojo',
  'Confusión',
];
