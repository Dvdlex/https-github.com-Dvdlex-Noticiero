
export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
}

export interface ScriptLine {
  id: string;
  speaker: 'Locutor 1' | 'Locutor 2' | 'Efecto de Sonido';
  line: string;
}
