import { GoogleGenAI, Type, Modality } from "@google/genai";
import { NewsItem, ScriptLine } from '../types';
import { v4 as uuidv4 } from 'uuid';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const fetchTopNews = async (): Promise<NewsItem[]> => {
    try {
        const currentDate = new Date().toLocaleDateString('es-GT', { dateStyle: 'long' });
        const prompt = `Busca las 20 noticias más importantes y recientes del día de hoy, ${currentDate}, en Guatemala. Utiliza fuentes confiables como los principales portales de noticias del país y cuentas verificadas de periodistas o medios en la red social X (antes Twitter). Para cada noticia, proporciona un titular y un resumen breve. Formatea la salida como un array de objetos JSON con las claves "headline" y "summary". No incluyas texto introductorio ni explicaciones, solo el array JSON.`;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}],
            }
        });

        let jsonText = response.text;
        // El modelo puede envolver el JSON en ```json ... ``` o simplemente devolver el array.
        // Esta expresión regular extrae el contenido JSON en cualquier caso.
        const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```|(\[[\s\S]*\])/s);
        if (jsonMatch) {
            // Usa el primer grupo de captura que no sea nulo.
            jsonText = jsonMatch[1] || jsonMatch[2];
        }

        const jsonResponse = JSON.parse(jsonText);
        if (Array.isArray(jsonResponse)) {
            return jsonResponse.map((item: any) => ({
                id: uuidv4(),
                headline: item.headline,
                summary: item.summary,
            }));
        }
        return [];

    } catch (error) {
        console.error("Error fetching news:", error);
        throw new Error("No se pudieron obtener las noticias. Por favor, inténtelo de nuevo.");
    }
};

export const generateRadioScript = async (news: NewsItem[]): Promise<ScriptLine[]> => {
    const newsContent = news.map(n => `- Titular: ${n.headline}\n  Resumen: ${n.summary}`).join('\n\n');

    const prompt = `
    Actúa como un guionista de radio experto para "Radio Sónica, Ciento Seis Nueve, y sonica.gt". El lema de la estación es "El siguiente Nivel".
    Tu tarea es crear un guion de radionoticiero DETALLADO y EXTENSO para dos presentadores. No utilices nombres propios para los presentadores, solo las etiquetas "Locutor 1" y "Locutor 2".

    El objetivo es que la discusión de CADA noticia dure entre uno y dos minutos. No te limites a leer los resúmenes; crea un diálogo dinámico y conversacional entre los locutores. Deben comentar la noticia, aportar contexto y reaccionar de forma natural.

    Para lograr un diálogo natural, incluye expresiones verbales como "Mjm", "aja", "claro", "exacto", "qué interesante", etc. Haz que parezca una conversación real, no un texto leído.

    Desarrolla en profundidad las siguientes noticias:
    ${newsContent}

    El guion debe incluir:
    1. Una introducción enérgica y memorable que incluya el nombre de la estación y su lema "El siguiente Nivel".
    2. El desarrollo extenso de las noticias, con un diálogo fluido y natural entre los locutores.
    3. Una despedida profesional que invite a seguir escuchando y que reitere el nombre de la estación y su lema.
    4. Indicaciones claras de efectos de sonido (por ejemplo, "[Efecto de sonido: Ráfaga de noticias enérgica]").

    **Formato de Salida Obligatorio:**
    La respuesta debe ser un array de objetos JSON. Cada objeto representa una línea del guion y debe tener dos propiedades:
    - "speaker": una cadena de texto que puede ser "Locutor 1", "Locutor 2", o "Efecto de Sonido".
    - "line": una cadena de texto con el diálogo o la descripción del efecto.

    No incluyas texto introductorio, explicaciones, ni \`\`\`json ... \`\`\`. La respuesta debe ser únicamente el array JSON válido.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            speaker: {
                                type: Type.STRING,
                                description: "El hablante. Opciones: 'Locutor 1', 'Locutor 2', 'Efecto de Sonido'."
                            },
                            line: {
                                type: Type.STRING,
                                description: "La línea de diálogo o la descripción del efecto de sonido."
                            }
                        },
                        required: ["speaker", "line"]
                    }
                }
            }
        });
        
        const jsonText = response.text.trim();
        const jsonResponse = JSON.parse(jsonText);
        
        if (Array.isArray(jsonResponse)) {
            return jsonResponse.map((item: any) => ({
                id: uuidv4(),
                speaker: item.speaker,
                line: item.line,
            }));
        }
        return [];
    } catch (error) {
        console.error("Error generating script:", error);
        if (error instanceof SyntaxError) {
             throw new Error("La respuesta de la IA no fue un JSON válido. No se pudo generar el guion.");
        }
        throw new Error("No se pudo generar el guion. La API devolvió un error.");
    }
};

export const generateTTSAudio = async (script: ScriptLine[], voice1: string, voice2: string): Promise<string> => {
    let ttsPrompt = "TTS the following conversation between two latin american speakers, Locutor 1 and Locutor 2:\n";
    script.forEach(line => {
        if (line.speaker !== 'Efecto de Sonido') {
            ttsPrompt += `${line.speaker}: ${line.line}\n`;
        }
    });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: ttsPrompt }] }],
            config: {
                // FIX: Use Modality.AUDIO enum member for responseModalities.
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    multiSpeakerVoiceConfig: {
                        speakerVoiceConfigs: [
                            {
                                speaker: 'Locutor 1',
                                voiceConfig: {
                                    prebuiltVoiceConfig: { voiceName: voice1 } 
                                }
                            },
                            {
                                speaker: 'Locutor 2',
                                voiceConfig: {
                                    prebuiltVoiceConfig: { voiceName: voice2 }
                                }
                            }
                        ]
                    }
                }
            }
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            return base64Audio;
        } else {
            throw new Error("No audio data received from API.");
        }
    } catch (error) {
        console.error("Error generating TTS audio:", error);
        throw new Error("No se pudo generar el audio. Por favor, inténtelo de nuevo.");
    }
};

export const generateVoiceSample = async (voiceId: string): Promise<string> => {
    const sampleText = "Esta es una prueba de voz para Radio Sónica.";
    try {
         const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: sampleText }] }],
            config: {
                // FIX: Use Modality.AUDIO enum member for responseModalities.
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceId },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            return base64Audio;
        } else {
            throw new Error("No audio data received from API for voice sample.");
        }
    } catch (error) {
        console.error(`Error generating voice sample for ${voiceId}:`, error);
        throw new Error("No se pudo generar la muestra de voz.");
    }
};