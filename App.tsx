import React, { useState, useCallback } from 'react';
import { GoogleGenAI, Modality, type GenerateContentResponse } from "@google/genai";

// Helper Function to convert a file to a base64 string
const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const mimeType = result.substring(result.indexOf(':') + 1, result.indexOf(';'));
      resolve({ base64: result, mimeType });
    };
    reader.onerror = (error) => reject(error);
  });
};

// Helper function to parse the Gemini API response for an image
const parseImageResponse = (response: GenerateContentResponse): { data: string, mimeType: string } => {
  const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

  if (imagePart?.inlineData) {
    return {
      data: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType
    };
  }

  if (response.promptFeedback?.blockReason) {
    throw new Error(`Запрос заблокирован: ${response.promptFeedback.blockReason}.`);
  }
  
  let text = '';
  try {
      text = response.text;
  } catch(e) {}

  if (text) {
    throw new Error(`Модель вернула текст вместо изображения: ${text}`);
  }

  throw new Error("Не удалось найти данные изображения в ответе. Модель не смогла выполнить запрос.");
};


// Gemini Service for editing an image with a prompt
const editImageWithPrompt = async (
  base64Image: string,
  mimeType: string,
  prompt: string
): Promise<{ data: string; mimeType: string }> => {
  if (!process.env.API_KEY) {
    throw new Error("API ключ не настроен. Пожалуйста, установите переменную окружения API_KEY.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const imagePart = {
    inlineData: {
      data: base64Image.split(',')[1],
      mimeType: mimeType,
    },
  };

  const textPart = {
    text: prompt,
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [imagePart, textPart],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    return parseImageResponse(response);
  } catch (error) {
    console.error("Ошибка при редактировании изображения:", error);
    const errorMessage = error instanceof Error ? error.message : "Произошла неизвестная ошибка.";
    throw new Error(`Не удалось сгенерировать изображение: ${errorMessage}`);
  }
};

// Gemini Service for generating an image from a prompt
const generateImageFromPrompt = async (
  prompt: string
): Promise<{ data: string; mimeType: string }> => {
  if (!process.env.API_KEY) {
    throw new Error("API ключ не настроен. Пожалуйста, установите переменную окружения API_KEY.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const textPart = {
    text: prompt,
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [textPart],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    return parseImageResponse(response);
  } catch (error) {
    console.error("Ошибка при генерации изображения:", error);
    const errorMessage = error instanceof Error ? error.message : "Произошла неизвестная ошибка.";
    throw new Error(`Не удалось сгенерировать изображение: ${errorMessage}`);
  }
};

// Icon Components
const UploadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
);

const MagicWandIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18L12 22M12 2L12 6M6 12H2M22 12H18M4.929 4.929L7.05 7.05M16.95 16.95L19.071 19.071M4.929 19.071L7.05 16.95M16.95 7.05L19.071 4.929M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);


const LoadingSpinner = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const ErrorIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-300" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
);

// Type Definitions
interface ImageFile {
  base64: string;
  mimeType: string;
  name: string;
}

interface ImageDisplayProps {
  title: string;
  imageSrc?: string;
  isLoading?: boolean;
}

// UI Components
const ImageDisplay: React.FC<ImageDisplayProps> = ({ title, imageSrc, isLoading }) => (
  <div className="w-full flex flex-col items-center">
    <h2 className="text-xl font-semibold text-gray-300 mb-4">{title}</h2>
    <div className="w-full aspect-square bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl flex items-center justify-center overflow-hidden shadow-lg">
      {isLoading ? (
        <div className="flex flex-col items-center text-gray-400">
           <LoadingSpinner />
           <span className="mt-2 text-lg font-light">Магия в процессе...</span>
        </div>
      ) : imageSrc ? (
        <img src={imageSrc} alt={title} className="w-full h-full object-contain" />
      ) : (
        <span className="text-gray-500 p-4 text-center font-light">Ваше изображение появится здесь</span>
      )}
    </div>
  </div>
);

// Main App Component
const App: React.FC = () => {
    const [originalImage, setOriginalImage] = useState<ImageFile | null>(null);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setError(null);
            setEditedImage(null);
            try {
                const { base64, mimeType } = await fileToBase64(file);
                setOriginalImage({ base64, mimeType, name: file.name });
            } catch (err) {
                setError("Не удалось загрузить изображение. Попробуйте другой файл.");
            }
        }
    }, []);

    const handleSubmit = async () => {
        if (!prompt) {
            setError("Пожалуйста, введите текстовую подсказку.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setEditedImage(null);

        try {
            let result: { data: string; mimeType: string };
            if (originalImage) {
                 result = await editImageWithPrompt(
                    originalImage.base64,
                    originalImage.mimeType,
                    prompt
                );
            } else {
                 result = await generateImageFromPrompt(prompt);
            }
            setEditedImage(`data:${result.mimeType};base64,${result.data}`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Произошла неизвестная ошибка";
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        setOriginalImage(null);
        setEditedImage(null);
        setPrompt('');
        setError(null);
        const fileInput = document.getElementById('image-upload') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
    };
    
    const isButtonDisabled = isLoading || !prompt;

    return (
        <div className="min-h-screen flex flex-col p-4 sm:p-6 lg:p-8 font-sans">
            <header className="text-center mb-10">
                <h1 className="text-5xl md:text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 to-orange-400">
                    Бананчик
                </h1>
                <p className="text-gray-400 mt-3 max-w-2xl mx-auto font-light">
                  Создавайте и редактируйте изображения с помощью текста. Волшебство Gemini у вас под рукой.
                </p>
            </header>

            <main className="flex-grow flex flex-col lg:flex-row gap-8">
                <div className="w-full lg:w-1/3 xl:w-1/4 bg-white/5 backdrop-blur-xl p-6 rounded-2xl shadow-2xl flex flex-col space-y-6 border border-white/10 h-fit lg:sticky lg:top-8">
                    <div>
                        <label className="block text-lg font-medium text-gray-300 mb-3">1. Загрузите фото (или пропустите)</label>
                        <label htmlFor="image-upload" className="relative cursor-pointer group flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/20 rounded-xl hover:border-yellow-400/50 transition-colors duration-300">
                            {originalImage ? (
                                <img src={originalImage.base64} alt="Preview" className="h-24 w-24 object-cover rounded-lg shadow-md" />
                            ) : (
                                <div className="text-center">
                                    <UploadIcon />
                                    <p className="mt-2 text-sm text-gray-400">
                                        <span className="font-semibold text-yellow-300">Нажмите</span>, чтобы загрузить
                                    </p>
                                    <p className="text-xs text-gray-500">PNG, JPG, WEBP</p>
                                </div>
                            )}
                             <input id="image-upload" name="image-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageUpload} />
                        </label>
                         {originalImage && <p className="text-xs text-gray-400 truncate w-full text-center mt-2" title={originalImage.name}>{originalImage.name}</p>}
                    </div>

                    <div>
                        <label htmlFor="prompt" className="block text-lg font-medium text-gray-300">2. Опишите, что сделать</label>
                        <textarea
                            id="prompt"
                            name="prompt"
                            rows={4}
                            className="mt-2 block w-full text-sm border-white/20 rounded-lg bg-white/5 text-gray-200 focus:ring-yellow-400 focus:border-yellow-400 placeholder-gray-500 transition-colors duration-300 shadow-inner"
                            placeholder={originalImage ? "например, 'Добавь эффект акварели'" : "например, 'Фото футуристичного города ночью'"}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                        />
                    </div>
                    
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-lg flex items-start" role="alert">
                           <ErrorIcon />
                           <span className="block sm:inline ml-3 text-sm font-light">{error}</span>
                        </div>
                    )}

                    <div className="flex flex-col space-y-3 pt-2">
                         <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isButtonDisabled}
                            className={`inline-flex items-center justify-center px-4 py-3 border border-transparent text-base font-semibold rounded-lg shadow-lg text-black ${isButtonDisabled ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-300 to-orange-400 hover:from-yellow-400 hover:to-orange-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-yellow-400 transform hover:scale-105'} transition-all duration-300`}
                        >
                            {isLoading ? <LoadingSpinner /> : <MagicWandIcon />}
                            <span className="ml-2">{isLoading ? 'Генерация...' : 'Создать'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleClear}
                          className="inline-flex items-center justify-center px-4 py-2 border border-white/20 text-sm font-medium rounded-lg shadow-sm text-gray-300 bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-white/50 transition-all duration-300"
                        >
                          Очистить все
                        </button>
                    </div>
                </div>

                <div className="w-full lg:w-2/3 xl:w-3/4 flex-grow grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                   <ImageDisplay title="Оригинал" imageSrc={originalImage?.base64} />
                   <ImageDisplay title="Результат" imageSrc={editedImage ?? undefined} isLoading={isLoading} />
                </div>
            </main>
        </div>
    );
};

export default App;
