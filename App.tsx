
import React, { useState, useEffect, useRef } from 'react';
import { NewsItem, ScriptLine } from './types';
import { fetchTopNews, generateRadioScript, generateTTSAudio, generateVoiceSample } from './services/geminiService';
import { decode, decodeAudioData, bufferToWav, formatTime } from './utils/audioUtils';
import Spinner from './components/Spinner';
import Logo from './components/Logo';

// FIX: Create a cross-browser compatible AudioContext to handle vendor prefixes for older browsers.
const CrossBrowserAudioContext = window.AudioContext || (window as any).webkitAudioContext;

const App: React.FC = () => {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [selectedNewsIds, setSelectedNewsIds] = useState<Set<string>>(new Set());
  const [script, setScript] = useState<ScriptLine[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'start' | 'news' | 'script' | 'audio'>('start');
  const [voice1, setVoice1] = useState('Kore');
  const [voice2, setVoice2] = useState('Puck');
  const [playingSample, setPlayingSample] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [audioUrl]);

  const handleFetchNews = async () => {
    setIsLoadingNews(true);
    setError(null);
    try {
      const items = await fetchTopNews();
      setNewsItems(items);
      setCurrentStep('news');
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setIsLoadingNews(false);
    }
  };

  const handleNewsSelection = (id: string) => {
    setSelectedNewsIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAllNews = () => {
    if (selectedNewsIds.size === newsItems.length) {
      setSelectedNewsIds(new Set());
    } else {
      setSelectedNewsIds(new Set(newsItems.map(item => item.id)));
    }
  };

  const handleGenerateScript = async () => {
    if (selectedNewsIds.size === 0) {
      setError("Por favor, selecciona al menos una noticia para generar el guion.");
      return;
    }
    setIsLoadingScript(true);
    setError(null);
    try {
      const selectedNews = newsItems.filter(item => selectedNewsIds.has(item.id));
      const generatedScript = await generateRadioScript(selectedNews);
      setScript(generatedScript);
      setCurrentStep('script');
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setIsLoadingScript(false);
    }
  };
  
  const handleScriptChange = (id: string, newLine: string) => {
    setScript(prev => prev.map(line => line.id === id ? { ...line, line: newLine } : line));
  };
  
  const availableVoices = [
    { id: 'Kore', name: 'Femenino - Suave, Melódico' },
    { id: 'Puck', name: 'Masculino - Joven, Enérgico' },
    { id: 'Charon', name: 'Masculino - Grave, Autoritario' },
    { id: 'Zephyr', name: 'Femenino - Cálido, Amistoso' },
    { id: 'Fenrir', name: 'Masculino - Profundo, Serio' },
  ];

  const handlePlaySample = async (voiceId: string) => {
    setPlayingSample(voiceId);
    setError(null);
    try {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            // FIX: Corrected use of cross-browser AudioContext.
            audioContextRef.current = new CrossBrowserAudioContext({ sampleRate: 24000 });
        }
        const audioCtx = audioContextRef.current;

        const base64Audio = await generateVoiceSample(voiceId);
        const decodedData = decode(base64Audio);
        const audioBuffer = await decodeAudioData(decodedData, audioCtx, 24000, 1);
        
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.start();
        source.onended = () => {
            setPlayingSample(null);
        };
    } catch (err: any) {
        setError(err.message || "No se pudo reproducir la muestra.");
        setPlayingSample(null);
    }
  };

  const handleGenerateAudio = async () => {
    if (script.length === 0) {
      setError("No hay guion para generar el audio.");
      return;
    }
    setIsLoadingAudio(true);
    setError(null);
    try {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            // FIX: Corrected use of cross-browser AudioContext.
            audioContextRef.current = new CrossBrowserAudioContext({ sampleRate: 24000 });
        }
        const audioCtx = audioContextRef.current;
        
      const base64Audio = await generateTTSAudio(script, voice1, voice2);
      const decodedData = decode(base64Audio);
      const audioBuffer = await decodeAudioData(decodedData, audioCtx, 24000, 1);
      const wavBlob = bufferToWav(audioBuffer);
      const url = URL.createObjectURL(wavBlob);
      setAudioUrl(url);
      setAudioDuration(audioBuffer.duration);
      setCurrentStep('audio');
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handleBackToScript = () => {
    if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setAudioDuration(0);
    setCurrentStep('script');
  };

  const handleReset = () => {
    setNewsItems([]);
    setSelectedNewsIds(new Set());
    setScript([]);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioDuration(0);
    setError(null);
    setCurrentStep('start');
  };
  
  const renderStartStep = () => (
    <div className="text-center">
        <p className="text-xl mb-8 text-gray-300">Genera un noticiero de radio completo en 3 simples pasos.</p>
        <button
            onClick={handleFetchNews}
            disabled={isLoadingNews}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300 transform hover:scale-105 disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
            {isLoadingNews ? 'Buscando...' : '1. Buscar Noticias Recientes'}
        </button>
        {isLoadingNews && <Spinner />}
    </div>
  );

  const renderNewsStep = () => (
    <div>
        <h2 className="text-2xl font-bold mb-4 text-center text-blue-400">Paso 1: Selecciona las Noticias</h2>
        <p className="text-center mb-6 text-gray-400">Elige las noticias que quieres incluir en tu guion.</p>
        <div className="flex justify-between items-center mb-4">
            <span className="text-gray-400">{selectedNewsIds.size} de {newsItems.length} seleccionadas</span>
            <button
                onClick={handleSelectAllNews}
                className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm transition duration-300"
            >
                {selectedNewsIds.size === newsItems.length ? 'Deseleccionar Todas' : 'Seleccionar Todas'}
            </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[55vh] overflow-y-auto p-2 bg-gray-800/50 rounded-lg">
            {newsItems.map(item => (
                <div key={item.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex items-start space-x-4">
                    <input
                        type="checkbox"
                        id={item.id}
                        checked={selectedNewsIds.has(item.id)}
                        onChange={() => handleNewsSelection(item.id)}
                        className="mt-1 h-5 w-5 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={item.id} className="cursor-pointer flex-1">
                        <h3 className="font-semibold text-lg text-gray-100">{item.headline}</h3>
                        <p className="text-gray-400 text-sm mt-1">{item.summary}</p>
                    </label>
                </div>
            ))}
        </div>
        <div className="text-center mt-6">
            <button
                onClick={handleGenerateScript}
                disabled={isLoadingScript || selectedNewsIds.size === 0}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300 transform hover:scale-105 disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
                {isLoadingScript ? 'Generando Guion...' : `Generar Guion con ${selectedNewsIds.size} Noticia(s)`}
            </button>
            {isLoadingScript && <Spinner />}
        </div>
    </div>
  );

  const renderScriptStep = () => (
    <div>
        <h2 className="text-2xl font-bold mb-4 text-center text-blue-400">Paso 2: Edita el Guion y Elige las Voces</h2>
        <div className="bg-gray-800 p-6 rounded-lg max-h-[50vh] overflow-y-auto mb-6 border border-gray-700">
            {script.map(line => (
                <div key={line.id} className="mb-4">
                    <label className={`font-bold block mb-1 ${line.speaker === 'Efecto de Sonido' ? 'text-gray-400 italic' : line.speaker === 'Locutor 1' ? 'text-cyan-400' : 'text-purple-400'}`}>
                        {line.speaker}:
                    </label>
                    <textarea
                        value={line.line}
                        onChange={(e) => handleScriptChange(line.id, e.target.value)}
                        rows={Math.max(2, Math.ceil(line.line.length / 70))}
                        className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                </div>
            ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <label htmlFor="voice1" className="block text-lg font-medium mb-2 text-cyan-400">Voz Locutor 1</label>
                <div className="flex items-center space-x-2">
                    <select id="voice1" value={voice1} onChange={e => setVoice1(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                        {availableVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                    <button onClick={() => handlePlaySample(voice1)} disabled={!!playingSample} className="bg-blue-500 p-2 rounded-full hover:bg-blue-600 disabled:bg-gray-500 text-lg flex items-center justify-center h-10 w-10">
                        {playingSample === voice1 ? '...' : '▶'}
                    </button>
                </div>
            </div>
             <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <label htmlFor="voice2" className="block text-lg font-medium mb-2 text-purple-400">Voz Locutor 2</label>
                <div className="flex items-center space-x-2">
                    <select id="voice2" value={voice2} onChange={e => setVoice2(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                        {availableVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                     <button onClick={() => handlePlaySample(voice2)} disabled={!!playingSample} className="bg-blue-500 p-2 rounded-full hover:bg-blue-600 disabled:bg-gray-500 text-lg flex items-center justify-center h-10 w-10">
                        {playingSample === voice2 ? '...' : '▶'}
                    </button>
                </div>
            </div>
        </div>
        <div className="text-center">
            <button
                onClick={handleGenerateAudio}
                disabled={isLoadingAudio}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300 transform hover:scale-105 disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
                {isLoadingAudio ? 'Sintetizando Audio...' : '3. Generar Audio'}
            </button>
             {isLoadingAudio && <Spinner />}
        </div>
    </div>
  );

  const renderAudioStep = () => (
    <div className="text-center">
        <h2 className="text-2xl font-bold mb-4 text-blue-400">¡Tu Noticiero está Listo!</h2>
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            {audioUrl && (
                <>
                    <audio ref={audioRef} src={audioUrl} controls className="w-full mb-4"></audio>
                    <p className="text-lg mb-4">Duración: {formatTime(audioDuration)}</p>
                    <a
                        href={audioUrl}
                        download={`radionoticiero-sonica-${new Date().toISOString()}.wav`}
                        className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300"
                    >
                        Descargar Audio (.wav)
                    </a>
                </>
            )}
        </div>
        <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4 mt-8">
             <button
                onClick={handleBackToScript}
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300 w-full sm:w-auto"
            >
                Volver a Editar Guion
            </button>
            <button
                onClick={handleReset}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300 w-full sm:w-auto"
            >
                Crear un nuevo noticiero
            </button>
        </div>
    </div>
  );

  const renderContent = () => {
    switch(currentStep) {
        case 'start': return renderStartStep();
        case 'news': return renderNewsStep();
        case 'script': return renderScriptStep();
        case 'audio': return renderAudioStep();
        default: return renderStartStep();
    }
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans flex items-center justify-center">
      <div className="container mx-auto p-4 md:p-8 max-w-4xl w-full bg-gray-800/30 rounded-2xl shadow-2xl border border-gray-700">
        <Logo />
        <div className="my-8 h-px bg-gray-700"></div>

        {error ? (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6 text-center">
              <strong className="font-bold text-lg block mb-2">¡Oops! Ocurrió un Error</strong>
              <span className="block">{error}</span>
              <button
                onClick={handleReset}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300"
              >
                Volver a Empezar
              </button>
          </div>
        ) : renderContent()
        }

        <div className="text-center mt-12 text-xs text-gray-500">
            <p>Potenciado por la API de Google Gemini.</p>
            <p>Creado por David de León.</p>
        </div>
      </div>
    </div>
  );
};

export default App;