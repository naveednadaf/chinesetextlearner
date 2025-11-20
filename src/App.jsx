import { useState, useRef, useEffect } from 'react';
import './App.css';
// import pinyin from 'chinese-to-pinyin';
// import Cedict from '@tykok/cedict-dictionary'

function App() {
  const [chineseText, setChineseText] = useState('');
  const [processedText, setProcessedText] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [revealedMeanings, setRevealedMeanings] = useState({});
  const [dict, setDict] = useState({});
  const [dictLoading, setDictLoading] = useState(true);

  const synthRef = useRef(null);
  const utteranceRef = useRef(null);
  const timerRef = useRef(null);

  // Tone mapping for pinyin conversion
  const toneMap = {
    a: ["ā","á","ǎ","à","a"],
    e: ["ē","é","ě","è","e"],
    i: ["ī","í","ǐ","ì","i"],
    o: ["ō","ó","ǒ","ò","o"],
    u: ["ū","ú","ǔ","ù","u"],
    v: ["ǖ","ǘ","ǚ","ǜ","ü"],
  };

  // Convert numbered pinyin to tone marked pinyin
  function numberToTone(pinyin) {
    return pinyin.replace(/([a-zü]+?)([1-5])/gi, (match, syllable, tone) => {
      tone = parseInt(tone) - 1;
      syllable = syllable.replace(/u:/g, "v").replace(/ü/g, "v");
      let vowelPos = syllable.search(/[aeiouv]/);
      if (vowelPos === -1) return syllable;
      let vowel = syllable[vowelPos];
      let marked = toneMap[vowel]?.[tone];
      if (!marked) return syllable;
      return syllable.slice(0, vowelPos) + marked + syllable.slice(vowelPos + 1);
    });
  }

  // Load dictionary from cedict file
  useEffect(() => {
    console.log("Attempting to load dictionary...");
    setDictLoading(true);
    fetch("/cedict_ts.u8")
      .then(res => {
        console.log("Fetch response status:", res.status);
        return res.text();
      })
      .then(text => {
        console.log("Dictionary file loaded, size:", text.length);
        const lines = text.split("\n");
        const data = {};
        let entryCount = 0;
        lines.forEach((line, index) => {
          // Skip comments and empty lines
          if (line.startsWith("#") || line.trim() === "") return;
          
          // Parse dictionary entries - updated regex to capture traditional and simplified
          const match = line.match(/^(\S+)\s+(\S+)\s+\[(.*?)\]\s+\/(.*?)\//);
          if (!match) return;

          const traditional = match[1].trim();
          const simplified = match[2].trim();
          const rawPinyin = match[3].trim();
          const english = match[4].trim();

          const pinyin = rawPinyin
            .split(/\s+/)
            .map(numberToTone)
            .join(" ");

          // Store entries for both traditional and simplified characters
          data[traditional] = { traditional, simplified, pinyin, english };
          data[simplified] = { traditional, simplified, pinyin, english };
          
          entryCount++;
          
          // Log first few entries for debugging
          if (entryCount <= 5) {
            console.log("Dictionary entry", entryCount, ":", traditional, simplified, pinyin, english);
          }
        });
        console.log("Dictionary loaded with entries:", entryCount);
        setDict(data);
        setDictLoading(false);
      })
      .catch(error => {
        console.error("Failed to load dictionary:", error);
        setDictLoading(false);
      });
  }, []);

  // Lookup function for dictionary
  function lookup(word) {
    console.log("Looking up word:", word);
    const result = dict[word] || null;
    console.log("Lookup result:", result);
    if (result) {
      console.log("Result type:", typeof result);
      console.log("Result keys:", Object.keys(result));
    }
    return result;
  }

  // Function to convert Chinese text to pinyin and get meanings
  const convertToPinyin = (text) => {
    console.log("Converting text to pinyin:", text);
    const result = [];
    
    // Split text into lines to preserve line breaks
    const lines = text.split('\n');
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      // Process each character in the line
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        // Handle all characters including punctuation
        let meaning = '';
        let pinyinResult = '';
        
        // Check if it's a Chinese character
        const isChinese = /[\u4e00-\u9fff]/.test(char);
        console.log("Processing character:", char, "isChinese:", isChinese);
        
        if (isChinese) {
          try {
            // Get meaning from dictionary
            const dictResult = lookup(char);
            if (dictResult) {
              console.log("Dict result structure:", typeof dictResult, dictResult);
              // Check if dictResult has the expected properties
              if (typeof dictResult === 'object' && dictResult !== null) {
                if (dictResult.english) {
                  meaning = dictResult.english;
                } else {
                  console.log("No english property found in dictResult");
                  meaning = 'Definition not available';
                }
                
                // If we have a better pinyin from the dictionary, use it
                if (dictResult.pinyin) {
                  pinyinResult = dictResult.pinyin;
                } else {
                  console.log("No pinyin property found in dictResult");
                }
              } else {
                console.log("Dict result is not an object:", dictResult);
                meaning = 'Definition not available';
              }
              console.log("Dictionary meaning:", meaning);
            } else {
              meaning = 'Definition not available';
            }
          } catch (error) {
            console.log('Processing failed for:', char, error);
            pinyinResult = 'Pinyin error';
            meaning = 'Processing error';
          }
        } else {
          // For non-Chinese characters, set appropriate values
          meaning = '';
          pinyinResult = '';
        }
        
        result.push({
          char: char,
          pinyin: pinyinResult,
          meaning: meaning,
          id: `${lineIndex}-${i}`,
          isChinese: isChinese
        });
      }
      
      // Add newline character if not the last line
      if (lineIndex < lines.length - 1) {
        result.push({
          char: '\n',
          pinyin: '',
          meaning: '',
          id: `newline-${lineIndex}`,
          isChinese: false,
          isLineBreak: true
        });
      }
    }
    
    console.log("Conversion result:", result);
    return result;
  };

  const handleConvert = () => {
    if (chineseText.trim()) {
      // Check if dictionary is loaded
      if (Object.keys(dict).length === 0) {
        console.log("Dictionary not yet loaded, waiting...");
        alert("Dictionary is still loading, please try again in a moment.");
        return;
      }
      const result = convertToPinyin(chineseText);
      setProcessedText(result);
      // Reset revealed meanings when new text is processed
      setRevealedMeanings({});
    }
  };

  const revealMeaning = (id) => {
    setRevealedMeanings(prev => ({
      ...prev,
      [id]: true
    }));
  };

  const handleSpeak = (text) => {
    // Cancel any ongoing speech
    if (synthRef.current && synthRef.current.speaking) {
      synthRef.current.cancel();
    }
    
    // Using the Web Speech API for text-to-speech
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN'; // Chinese language
      utterance.rate = playbackRate;
      
      utterance.onstart = () => {
        setIsPlaying(true);
        setTotalTime(text.length * 0.2); // Estimate: 0.2 seconds per character
        setCurrentTime(0);
        
        // Simulate progress
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setCurrentTime(prev => {
            if (prev >= totalTime) {
              clearInterval(timerRef.current);
              return totalTime;
            }
            return prev + 0.1;
          });
        }, 100);
      };
      
      utterance.onend = () => {
        setIsPlaying(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
      
      utterance.onerror = () => {
        setIsPlaying(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
      
      synthRef.current.speak(utterance);
      utteranceRef.current = utterance;
    } else {
      alert('Sorry, your browser does not support text-to-speech.');
    }
  };

  const handleSpeakAll = () => {
    if (processedText.length > 0) {
      // Join characters, but skip line breaks for speech
      const fullText = processedText
        .filter(item => !item.isLineBreak)
        .map(item => item.char)
        .join('');
      handleSpeak(fullText);
    }
  };

  const handlePause = () => {
    if (synthRef.current && synthRef.current.speaking) {
      if (isPlaying) {
        synthRef.current.pause();
        setIsPlaying(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      } else {
        synthRef.current.resume();
        setIsPlaying(true);
        
        // Resume progress simulation
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setCurrentTime(prev => {
            if (prev >= totalTime) {
              clearInterval(timerRef.current);
              return totalTime;
            }
            return prev + 0.1;
          });
        }, 100);
      }
    }
  };

  const handleStop = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsPlaying(false);
      setCurrentTime(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handlePlaybackRateChange = (rate) => {
    setPlaybackRate(rate);
    if (utteranceRef.current) {
      utteranceRef.current.rate = rate;
    }
  };

  const handleSeek = (time) => {
    // Seeking in speech synthesis is not directly supported
    // We'll stop and restart from the approximate position
    const charIndex = Math.floor((time / totalTime) * chineseText.length);
    const newText = chineseText.substring(charIndex);
    
    if (newText) {
      handleStop();
      setTimeout(() => {
        handleSpeak(newText);
      }, 100);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  return (
    <div className="app">
      <h1>Chinese Text Learner</h1>
      {dictLoading && <p>Loading dictionary...</p>}
      <div className="input-section">
        <textarea
          value={chineseText}
          onChange={(e) => setChineseText(e.target.value)}
          placeholder="Enter Chinese text here (essays, paragraphs, etc.)..."
          rows="6"
          cols="50"
        />
        <button onClick={handleConvert} disabled={dictLoading}>Convert to Pinyin</button>
      </div>

      {processedText.length > 0 && (
        <div className="output-section">
          {/* Audio Controls */}
          <div className="audio-controls">
            <div className="control-buttons">
              <button onClick={handleSpeakAll} disabled={isPlaying && synthRef.current?.speaking}>
                ▶️ Play All
              </button>
              <button onClick={handlePause} disabled={!synthRef.current?.speaking}>
                {isPlaying ? '⏸️ Pause' : '▶️ Resume'}
              </button>
              <button onClick={handleStop} disabled={!synthRef.current?.speaking}>
                ⏹️ Stop
              </button>
            </div>
            
            <div className="playback-controls">
              <label>Speed: </label>
              <select 
                value={playbackRate} 
                onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
              >
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1">1x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
              </select>
            </div>
            
            <div className="progress-container">
              <input
                type="range"
                min="0"
                max={totalTime}
                step="0.1"
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="progress-slider"
              />
              <div className="time-display">
                {currentTime.toFixed(1)}s / {totalTime.toFixed(1)}s
              </div>
            </div>
          </div>
          
          {/* Paragraph-style display with preserved spacing */}
          <div className="text-display">
            {processedText.map((item, index) => (
              <span 
                key={item.id} 
                className={`character-wrapper ${item.isChinese ? 'chinese-char' : 'non-chinese'} ${item.isLineBreak ? 'line-break' : ''}`}
              >
                {item.isLineBreak ? (
                  <br />
                ) : item.char === ' ' ? (
                  <span className="space-char"> </span>
                ) : (
                  <>
                    <span 
                      className="character"
                      onClick={() => handleSpeak(item.char)}
                    >
                      {item.char}
                    </span>
                    {item.isChinese && (
                      <span className="hover-info">
                        {item.pinyin && item.pinyin !== 'Pinyin error' && (
                          <span className="pinyin-tooltip">{item.pinyin}</span>
                        )}
                        {(revealedMeanings[item.id]) && item.meaning && item.meaning !== 'Definition not available' && item.meaning !== 'Processing error' && (
                          <span className="meaning-tooltip">
                            {item.meaning}
                          </span>
                        )}
                      </span>
                    )}
                    {item.isChinese && item.meaning && item.meaning !== 'Definition not available' && item.meaning !== 'Processing error' && !revealedMeanings[item.id] && (
                      <button 
                        className="reveal-btn"
                        onClick={() => revealMeaning(item.id)}
                      >
                        English
                      </button>
                    )}
                  </>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;