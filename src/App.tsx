import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@mantine/core';
import * as XLSX from 'xlsx';
import {
    ChatCompletionMessageParam,
    CreateWebWorkerEngine,
    EngineInterface,
    InitProgressReport,
    hasModelInCache,
} from '@mlc-ai/web-llm';

import './App.css';
import { appConfig } from './app-config';
import Progress from './components/Progress';
import { promt_description } from './prompt';

declare global {
    interface Window {
        chrome?: any;
    }
}

appConfig.useIndexedDBCache = true;

if (appConfig.useIndexedDBCache) {
    console.log('Using IndexedDB Cache');
} else {
    console.log('Using Cache API');
}

function App() {
    const selectedModel = 'CroissantLLMChat-v0.1-q0f16';
    const [engine, setEngine] = useState<EngineInterface | null>(null);
    const [progress, setProgress] = useState('Not loaded');
    const [progressPercentage, setProgressPercentage] = useState(0);
    const [isFetching, setIsFetching] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [runtimeStats, setRuntimeStats] = useState('');
    const [translations, setTranslations] = useState<{ input: string; output: string; id: number }[]>([]);
    const [modelInCache, setModelInCache] = useState<boolean | null>(null);
    const [errorBrowserMessage, setErrorBrowserMessage] = useState<string | null>(
        null
    );
	const [sourceColumn, setSourceColumn] = useState('B');
	const [destinationColumn, setDestinationColumn] = useState('C');
	const [startRow, setStartRow] = useState(2);
	const [currentRow, setCurrentRow] = useState(0);
	const [totalRows, setTotalRows] = useState(0);
	const isGeneratingRef = useRef(isGenerating);

    useEffect(() => {
        const compatibleBrowser = checkBrowser();
        checkModelInCache();
        if (!engine && compatibleBrowser) {
            loadEngine();
        }
    }, []);

	useEffect(() => {
		isGeneratingRef.current = isGenerating;
	}, [isGenerating]);

    let nextId = 0;

    const addTranslation = (input: string, output: string) => {
        setTranslations((prevTranslations) => {
            const updatedTranslations = [{ input, output, id: nextId++ }, ...prevTranslations];
            while (updatedTranslations.length > 40) {
				updatedTranslations.pop();
			}
            return updatedTranslations;
        });
    };

    /**
     * Check if the browser is compatible with WebGPU.
     */
    const checkBrowser = () => {
        const userAgent = navigator.userAgent;
        let compatibleBrowser = true;

        const isMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(
            userAgent
        );

        if (isMobile) {
            setErrorBrowserMessage(
                'Mobile phones are not compatible with WebGPU.'
            );
            compatibleBrowser = false;
        } else if (/firefox|fxios/i.test(userAgent)) {
            setErrorBrowserMessage("Firefox is not compatible with WebGPU.");
            compatibleBrowser = false;
        } else if (
            /safari/i.test(userAgent) &&
            !/chrome|crios|crmo/i.test(userAgent)
        ) {
            setErrorBrowserMessage("Safari is not compatible with WebGPU.");
            compatibleBrowser = false;
        } else if (!window.chrome) {
            setErrorBrowserMessage(
                "Your browser is not compatible with WebGPU."
            );
            compatibleBrowser = false;
        }
        return compatibleBrowser;
    };

    /**
     * Callback for the progress of the model initialization.
     */
    const initProgressCallback = (report: InitProgressReport) => {
        if (report.progress !== 0) {
            setProgressPercentage(report.progress);
        }
        if (report.progress === 1) {
            setProgressPercentage(0);
        }
        setProgress(report.text);
    };

    /**
     * Load the engine.
     */
    const loadEngine = async () => {
        setIsFetching(true);

        const engine: EngineInterface = await CreateWebWorkerEngine(
            new Worker(new URL('./worker.ts', import.meta.url), {
                type: 'module',
            }),
            selectedModel,
            { initProgressCallback: initProgressCallback, appConfig: appConfig }
        );
        setIsFetching(false);
        setEngine(engine);
        const isInCache = await hasModelInCache(selectedModel, appConfig);
        setModelInCache(isInCache);
        return engine;
    };

    /**
     * Send the input to the engine and get the output text translated.
     */
    const onSend = async (inputUser: string | number): Promise<string | undefined> => {
        if (inputUser === '') {
            return;
        }
		// If number or can be converted to number return it as string
		if (typeof inputUser === 'number' || !isNaN(Number(inputUser))) {
			return inputUser.toString();
		}

		// If only numbers, spaces, and/or special characters return it as string
		if (/^[0-9\s\W]+$/.test(inputUser)) {
			return inputUser;
		}

		// If there are no vowels, return it as string
		if (!/[aeiouy]/i.test(inputUser)) {
			return inputUser;
		}

        setIsGenerating(true);

        let loadedEngine = engine;

        if (!loadedEngine) {
            try {
                loadedEngine = await loadEngine();
            } catch (error) {
                setIsGenerating(false);
                console.log(error);
                setErrorBrowserMessage('Could not load the model because ' + error);
                return;
            }
        }

		const isUpperCase = (str: string) => str === str.toUpperCase();
		const isLowerCase = (str: string) => str === str.toLowerCase();
        const paragraphs = inputUser.toString().split('\n');

        try {
            await loadedEngine.resetChat();

            let assistantMessage = '';

            for (let i = 0; i < paragraphs.length; i++) {
                const paragraph = paragraphs[i];

                if (paragraph === '') {
                    assistantMessage += '\n';
                } else {
                    const words = paragraph.split(' ');
                    let prompt = '';
                    if (words.length > 5) {
                        prompt = promt_description.promptSentenceEnglishToFrench;
                    } else {
                        prompt = promt_description.promptEnglishToFrench;
                    }
                    const userMessage: ChatCompletionMessageParam = {
                        role: 'user',
                        content: prompt + paragraph,
                    };
                    const completion = await loadedEngine.chat.completions.create({
                        stream: true,
                        messages: [userMessage],
						temperature: 0.3,
						max_gen_len: paragraph.length + 50,
                    });
                    let translatedParagraph = '';

                    for await (const chunk of completion) {
                        const curDelta = chunk.choices[0].delta.content;
                        if (curDelta) {
                            translatedParagraph += curDelta;
                        }
                    }

                    if (i < paragraphs.length - 1) {
                        assistantMessage += translatedParagraph + '\n';
                    } else {
                        assistantMessage += translatedParagraph;
                    }
                }
            }

			// if our output contains more than triple the input, it's likely a mistake
			if (assistantMessage.length > 3 * inputUser.length) {
				console.warn('Output is too long, likely a mistake', inputUser, assistantMessage);
				assistantMessage = inputUser.toString();
			}

			if (isUpperCase(inputUser)) {
				assistantMessage = assistantMessage.toUpperCase();
			} else if (isLowerCase(inputUser)) {
				assistantMessage = assistantMessage.toLowerCase();
			}

			// if the output contains punctuation, and the input doesn't, it's likely a mistake, remove it
			if (/[.,!?]/.test(assistantMessage) && !/[.,!?]/.test(inputUser)) {
				console.warn('Output contains punctuation, likely a mistake', inputUser, assistantMessage);
				assistantMessage = assistantMessage.replace(/[.,!?]/g, '');
			}

            //setIsGenerating(false);
            setRuntimeStats(await loadedEngine.runtimeStatsText());
            return assistantMessage;
        } catch (error) {
            setIsGenerating(false);
            console.log('EXCEPTION');
            console.log(error);
            setErrorBrowserMessage('Error. Please try again.');
            return;
        }
    };

    /**
     * Stop the generation.
     */
    const onStop = () => {
        if (!engine) {
            console.log('Engine not loaded');
            return;
        }

        setIsGenerating(false);
        engine.interruptGenerate();
    };

    /**
     * Check if the model is in the cache.
     */
    const checkModelInCache = async () => {
        const isInCache = await hasModelInCache(selectedModel, appConfig);
        setModelInCache(isInCache);
        console.log(`${selectedModel} in cache : ${isInCache}`);
    };

    /**
     * Handle file upload and process the Excel file.
     */
	const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}
	
		const reader = new FileReader();
		reader.onload = async (e) => {
			setIsGenerating(true);
			isGeneratingRef.current = true;
	
			const data = new Uint8Array(e.target?.result as ArrayBuffer);
			const workbook = XLSX.read(data, { type: 'array' });
			const sheetName = workbook.SheetNames[0];
			const worksheet = workbook.Sheets[sheetName];
			const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
	
			// Get the index of the columns
			const sourceColumnIndex = sourceColumn.charCodeAt(0) - 'A'.charCodeAt(0);
			const destinationColumnIndex = destinationColumn.charCodeAt(0) - 'A'.charCodeAt(0);

			setTotalRows(jsonData.length)
			for (let i = startRow - 1; i < jsonData.length; i++) {
				if (!isGeneratingRef.current) {
					break;
				}
				const row = jsonData[i] as string[];
				const value = row[sourceColumnIndex]; // Get the value from the source column
				if (value) {
					const response = await onSend(value);
					row[destinationColumnIndex] = response || ''; // Save the generated message to the destination column
					
					addTranslation(value, response || '');
				}
				setCurrentRow(i + 1);
			}
	
			// Update the worksheet with the new data
			const newWorksheet = XLSX.utils.json_to_sheet(jsonData, { skipHeader: true });
			workbook.Sheets[sheetName] = newWorksheet;
	
			// Generate a new Excel file with the updated data
			const updatedExcel = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
			const blob = new Blob([updatedExcel], { type: 'application/octet-stream' });
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'updated_file.xlsx';
			a.click();
			window.URL.revokeObjectURL(url);
			setIsGenerating(false);
		};
		reader.readAsArrayBuffer(file);
	};
	

    return (
        <>
            <h1>Bulk Excel English-to-French Translator</h1>
            <h2>LLM-Powered Translations for the Masses</h2>
            <p>
                This translation is processed locally in your browser. Your data does not leave your computer and does not transit through any server.
				LLMs are large language models that can generate human-like text based on the input you provide.
				they are trained on a large corpus of text data and can generate text in multiple languages.
				They are not perfect and may generate incorrect or inappropriate text. Please review the generated text before using it.
            </p>
            {errorBrowserMessage && (
                <p className='text-error'>
                    {errorBrowserMessage} Please check{' '}
                    <a href='https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API#browser_compatibility'>
                        <span className='underline'>this page</span>
                    </a>{' '}
                    for browser compatibility.
                </p>
            )}

            {modelInCache !== null && (
                <p>
                    Model downloaded in your browser cache: {modelInCache === true ? '✅' : '❌'}
                </p>
            )}

			<div className='textbox-container'>
				<div className="input-container">
					<input
						type="text"
						value={sourceColumn}
						onChange={(e) => setSourceColumn(e.target.value.toUpperCase())}
						placeholder="Source Column"
					/>
					<input
						type="text"
						value={destinationColumn}
						onChange={(e) => setDestinationColumn(e.target.value.toUpperCase())}
						placeholder="Destination Column"
					/>
					<input
						type="number"
						value={startRow}
						onChange={(e) => setStartRow(Number(e.target.value))}
						placeholder="Start Row"
					/>
				</div>
			</div>

            <div className='button-container'>
                <Button
                    variant='light'
                    onClick={onStop}
                    color='black'
                    disabled={!isGenerating}
                    loading={isFetching}
                >
                    Stop
                </Button>

                <Button
                    variant='light'
                    color='black'
                    component='label'
					disabled={isGenerating}
					loading={isFetching}
                >
					{currentRow > 0 && totalRows > 0 ? `Converting Excel File (${currentRow}/${totalRows})` : 'Upload Excel File'}
                    <input
                        type='file'
                        hidden
                        accept='.xlsx, .xls'					
                        onChange={handleFileUpload}
                    />
                </Button>
            </div>

            {progressPercentage !== 0 && (
                <div className='progress-bars-container'>
                    <Progress percentage={progressPercentage} />
                </div>
            )}

            <div className='progress-text'>{progress}</div>
            {runtimeStats && <p>Performance: {runtimeStats}</p>}
            <p>
                Powered by{' '}
                <a href='https://huggingface.co/croissantllm' target='_blank'>
                    🥐CroissantLLM
                </a>
                , a sovereign LLM by CentraleSupélec.
            </p>

            <div className='translations'>
                {translations.map((translation, index) => (
                    <div key={translation.id} className={`translation-row ${translations.length > 20 && index > translations.length / 4? 'fade' : ''}`}>
                        <div className='translation-input'>
                            {translation.input}
                        </div>
						<div className="translation-separator">
							➡️
						</div>
                        <div className='translation-output'>
                            {translation.output}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

export default App;
