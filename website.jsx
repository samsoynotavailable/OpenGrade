import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, FileText, Plus, CheckCircle, Home, Printer, Settings, ArrowLeft, Trash2, Edit3, User, BookOpen, QrCode } from 'lucide-react';

// --- Core Logic & Math Engine ---

// Generates the relative coordinates (0.0 to 1.0) for every bubble on the sheet.
// This exact same coordinate map is used to DRAW the printable sheet and to SCAN the captured image.
const getBubbleCoordinates = (numQuestions) => {
  const coords = {};
  const maxRows = Math.ceil(numQuestions / 2);
  const headerH = 0.18; // Leave top 18% for Name/Date/Score
  const footerH = 0.04;
  const availableH = 1.0 - headerH - footerH;
  const rowH = availableH / Math.max(maxRows, 15); // Scale row height based on count, min 15 rows for spacing

  const options = ['A', 'B', 'C', 'D', 'E', 'F'];

  for (let i = 0; i < numQuestions; i++) {
    const col = i < maxRows ? 0 : 1;
    const row = i % maxRows;

    const colStartX = col === 0 ? 0.05 : 0.55;
    const colWidth = 0.40;

    const qCoords = {};
    options.forEach((opt, idx) => {
      const optRelX = 0.20 + (idx * 0.15); // Relative X within the column
      const rx = colStartX + (optRelX * colWidth);
      const ry = headerH + (row * rowH) + (rowH / 2);
      qCoords[opt] = { rx, ry };
    });
    coords[i + 1] = qCoords;
  }
  return coords;
};

// --- Extracted Views (To fix React Hook Rules) ---

const CreateQuizView = ({ setView, handleCreateQuiz }) => {
  const [name, setName] = useState('');
  const [num, setNum] = useState(20);

  return (
    <div className="p-6 max-w-md mx-auto">
      <button onClick={() => setView('home')} className="mb-6 flex items-center text-slate-500 hover:text-slate-800">
        <ArrowLeft size={20} className="mr-1" /> Back
      </button>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Create New Quiz</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Quiz Name</label>
          <input 
            type="text" 
            value={name} 
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Midterm Exam"
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Number of Questions (1-50)</label>
          <input 
            type="number" 
            min="1" max="50"
            value={num} 
            onChange={e => setNum(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <button 
          disabled={!name || num < 1 || num > 50}
          onClick={() => handleCreateQuiz(name, num)}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white p-3 rounded-lg font-bold mt-4 transition-colors"
        >
          Create & Generate Sheet
        </button>
      </div>
    </div>
  );
};

const ManualKeyView = ({ activeQuiz, setView, updateQuizKey }) => {
  if (!activeQuiz) return null;
  const [localKey, setLocalKey] = useState(activeQuiz.key || {});

  const toggleBubble = (qNum, opt) => {
    const currentAns = localKey[qNum] || [];
    const newAns = currentAns.includes(opt) 
      ? currentAns.filter(a => a !== opt) 
      : [...currentAns, opt];
    
    setLocalKey({ ...localKey, [qNum]: newAns });
  };

  const handleSave = () => {
    updateQuizKey(activeQuiz.id, localKey);
    setView('quiz_detail');
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
       <div className="flex justify-between items-center mb-6">
        <button onClick={() => setView('quiz_detail')} className="flex items-center text-slate-500 hover:text-slate-800">
          <ArrowLeft size={20} className="mr-1" /> Back
        </button>
        <button onClick={handleSave} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700">
          Save Key
        </button>
      </div>
      
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Answer Key: {activeQuiz.name}</h2>
        <p className="text-slate-500 mb-6">Tap bubbles to set correct answers. Multiple answers allowed.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
           {Array.from({length: activeQuiz.numQuestions}).map((_, i) => {
             const qNum = i + 1;
             const selected = localKey[qNum] || [];
             return (
               <div key={qNum} className="flex items-center gap-4 p-2 hover:bg-slate-50 rounded">
                 <span className="font-bold w-6 text-right">{qNum}.</span>
                 <div className="flex gap-2">
                   {['A', 'B', 'C', 'D', 'E', 'F'].map(opt => {
                     const isSelected = selected.includes(opt);
                     return (
                       <button
                         key={opt}
                         onClick={() => toggleBubble(qNum, opt)}
                         className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold transition-colors ${
                           isSelected 
                            ? 'bg-blue-600 border-blue-600 text-white' 
                            : 'bg-white border-slate-300 text-slate-400 hover:border-blue-400'
                         }`}
                       >
                         {opt}
                       </button>
                     )
                   })}
                 </div>
               </div>
             )
           })}
        </div>
      </div>
    </div>
  );
};

// --- QR Code Views ---
const ShareQRView = ({ activeQuiz, setView }) => {
  if (!activeQuiz) return null;
  
  // We strip out the "results" array to keep the QR code data small and easy to scan
  const exportData = {
    name: activeQuiz.name,
    numQuestions: activeQuiz.numQuestions,
    key: activeQuiz.key
  };
  const jsonString = encodeURIComponent(JSON.stringify(exportData));
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${jsonString}`;

  return (
    <div className="p-6 max-w-md mx-auto flex flex-col items-center">
      <button onClick={() => setView('quiz_detail')} className="mb-6 self-start flex items-center text-slate-500 hover:text-slate-800">
        <ArrowLeft size={20} className="mr-1" /> Back
      </button>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Share "{activeQuiz.name}"</h2>
      <p className="text-slate-500 mb-8 text-center">Scan this code from another device to import the quiz and its answer key.</p>
      
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-md">
        <img src={qrUrl} alt="Quiz QR Code" width={256} height={256} />
      </div>
    </div>
  );
};

const ScanQRView = ({ setView, onImportQuiz }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load jsQR dynamically to avoid bundle errors
    if (!window.jsQR) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.async = true;
      document.body.appendChild(script);
    }

    let stream = null;
    let animationFrameId = null;

    const startScan = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", true); // Required for iOS
          videoRef.current.play();
          requestAnimationFrame(tick);
        }
      } catch (err) {
        setError('Camera access denied. Please ensure permissions are granted.');
      }
    };

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Scan for QR Code
        if (window.jsQR) {
          const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code) {
            try {
              const quizData = JSON.parse(code.data);
              // Verify it has the properties of our quiz object
              if (quizData && quizData.name && quizData.numQuestions) {
                onImportQuiz(quizData);
                return; // Stop scanning once we find a valid code
              }
            } catch (e) {
              // Not valid JSON, keep scanning
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    startScan();

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [onImportQuiz]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="bg-black/50 p-4 flex justify-between items-center text-white z-20 absolute top-0 w-full">
        <button onClick={() => setView('home')} className="flex items-center gap-2 font-medium">
          <ArrowLeft size={20} /> Cancel
        </button>
        <div className="font-bold">Scan Quiz QR</div>
        <div className="w-20"></div>
      </div>
      <div className="relative flex-1 w-full flex items-center justify-center">
        {error && <div className="absolute top-20 text-white bg-red-500 p-4 rounded z-30">{error}</div>}
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        {/* QR Targeting Box */}
        <div className="relative z-10 w-64 h-64 border-4 border-blue-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] flex items-center justify-center">
          <div className="bg-blue-500/20 w-full h-full animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};

// --- Camera & Scanning Logic ---
const ScannerView = ({ activeQuiz, scannerMode, setView, updateQuizKey, saveScanResult }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null); // Hidden canvas for processing
  const overlayRef = useRef(null);
  const [cameraError, setCameraError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanOverlayData, setScanOverlayData] = useState(null); // Visual feedback

  // Start Camera
  useEffect(() => {
    let stream = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setCameraError('Camera access denied or unavailable. Please ensure permissions are granted.');
      }
    };
    startCamera();
    
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const processScan = useCallback(() => {
    if (!videoRef.current || !overlayRef.current) return;
    setIsProcessing(true);

    const video = videoRef.current;
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // 1. Draw full video native resolution to hidden canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 2. Calculate DOM bounds to extract just the overlay box area
    const videoRect = video.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();

    // Because video is object-fit: cover, we need to map DOM rects to video intrinsic resolution
    const scale = Math.max(videoRect.width / canvas.width, videoRect.height / canvas.height);
    const displayedWidth = canvas.width * scale;
    const displayedHeight = canvas.height * scale;
    const offsetX = (videoRect.width - displayedWidth) / 2;
    const offsetY = (videoRect.height - displayedHeight) / 2;

    const overlayX_in_video = overlayRect.left - videoRect.left - offsetX;
    const overlayY_in_video = overlayRect.top - videoRect.top - offsetY;

    const cropX = overlayX_in_video / scale;
    const cropY = overlayY_in_video / scale;
    const cropW = overlayRect.width / scale;
    const cropH = overlayRect.height / scale;

    // Extract image data for the scanned sheet
    let imageData;
    try {
      imageData = ctx.getImageData(cropX, cropY, cropW, cropH);
    } catch (e) {
      setIsProcessing(false);
      alert("Failed to capture image. Ensure the whole box is visible.");
      return;
    }

    // 3. Analyze Bubbles
    const { width, height, data } = imageData;
    const coords = getBubbleCoordinates(activeQuiz.numQuestions);
    
    // Calculate average luminance of the whole crop to act as a dynamic threshold
    // This handles shadows and poor lighting dynamically
    let totalLuma = 0;
    let samples = 0;
    for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel for speed
      totalLuma += (data[i] + data[i+1] + data[i+2]) / 3;
      samples++;
    }
    const avgLuma = totalLuma / samples;
    const darkThreshold = avgLuma * 0.65; // Mark as filled if 35% darker than background

    const getBlockLuma = (cx, cy) => {
      let sum = 0;
      let count = 0;
      const radius = Math.floor(width * 0.005); // dynamic sample size based on image res
      for(let y = cy - radius; y <= cy + radius; y++) {
          for(let x = cx - radius; x <= cx + radius; x++) {
              if(x >=0 && x < width && y >=0 && y < height) {
                  const idx = (y * width + x) * 4;
                  sum += (data[idx] + data[idx+1] + data[idx+2]) / 3;
                  count++;
              }
          }
      }
      return sum / count;
    };

    const detectedAnswers = {};
    const visualOverlay = []; // For rendering feedback dots

    for (let q = 1; q <= activeQuiz.numQuestions; q++) {
      detectedAnswers[q] = [];
      const opts = coords[q];
      for (const [opt, {rx, ry}] of Object.entries(opts)) {
          const px = Math.floor(rx * width);
          const py = Math.floor(ry * height);
          const luma = getBlockLuma(px, py);

          if (luma < darkThreshold) {
            detectedAnswers[q].push(opt);
            visualOverlay.push({ rx, ry, type: 'filled' });
          } else {
            visualOverlay.push({ rx, ry, type: 'empty' });
          }
      }
    }

    // Show visual feedback briefly
    setScanOverlayData(visualOverlay);

    setTimeout(() => {
      setIsProcessing(false);
      setScanOverlayData(null);
      
      // 4. Handle Result based on mode
      if (scannerMode === 'key') {
        updateQuizKey(activeQuiz.id, detectedAnswers);
        alert("Answer Key captured successfully!");
        setView('quiz_detail');
      } else {
        // Grading logic
        let score = 0;
        for (let q = 1; q <= activeQuiz.numQuestions; q++) {
          const studentAns = detectedAnswers[q].sort().join(',');
          const correctAns = (activeQuiz.key[q] || []).sort().join(',');
          if (studentAns === correctAns && studentAns !== "") {
            score++;
          }
        }
        
        const studentName = prompt(`Scan Successful!\nScore: ${score}/${activeQuiz.numQuestions}\n\nEnter student name to save:`);
        if (studentName) {
           saveScanResult(activeQuiz.id, studentName, score, activeQuiz.numQuestions, detectedAnswers);
        }
      }
    }, 1000);

  }, [activeQuiz, scannerMode, setView, updateQuizKey, saveScanResult]);


  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Hidden Canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Bar */}
      <div className="bg-black/50 p-4 flex justify-between items-center text-white z-20 absolute top-0 w-full">
        <button onClick={() => setView('quiz_detail')} className="flex items-center gap-2 font-medium">
          <ArrowLeft size={20} /> Cancel
        </button>
        <div className="font-bold">
          {scannerMode === 'key' ? 'Scanning Key' : 'Grading Paper'}
        </div>
        <div className="w-20"></div> {/* Spacer */}
      </div>

      {/* Camera View */}
      <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden">
        {cameraError ? (
          <div className="text-red-500 bg-white p-4 rounded text-center m-4">
            {cameraError}
          </div>
        ) : (
          <>
            {/* Video Element */}
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className="absolute inset-0 w-full h-full object-cover" 
            />
            
            {/* Overlay / Reticle (3:4 aspect ratio) */}
            <div 
              ref={overlayRef}
              className={`relative z-10 w-[85%] max-w-[500px] aspect-[3/4] border-4 transition-colors duration-300 ${isProcessing ? 'border-blue-500 bg-blue-500/20' : 'border-green-500 bg-transparent'} shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] flex items-center justify-center`}
            >
              {/* Visual Guidelines */}
              {!isProcessing && !scanOverlayData && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 text-center px-4">
                  <p className="text-xl font-bold mb-2">Align Paper Here</p>
                  <p className="text-sm">Match the thick black border of the printed sheet with this green box.</p>
                </div>
              )}

              {/* Scan Feedback Dots */}
              {scanOverlayData && scanOverlayData.map((dot, i) => (
                <div 
                  key={i}
                  className={`absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2 ${dot.type === 'filled' ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,1)]' : 'bg-red-500/50'}`}
                  style={{ left: `${dot.rx * 100}%`, top: `${dot.ry * 100}%` }}
                />
              ))}

              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white"></div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="bg-black p-6 pb-12 z-20 flex justify-center items-center">
        <button 
          onClick={processScan}
          disabled={isProcessing || !!cameraError}
          className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center ${isProcessing ? 'bg-slate-300' : 'bg-white/20 hover:bg-white/40'}`}
        >
          <div className={`w-16 h-16 rounded-full ${isProcessing ? 'bg-blue-500 animate-pulse' : 'bg-white'}`}></div>
        </button>
      </div>
    </div>
  );
};


// --- Main Application Component ---

export default function App() {
  // State Management
  const [view, setView] = useState('home'); // home, quiz_detail, create_quiz, print, manual_key, scanner
  const [quizzes, setQuizzes] = useState([
    { id: 1, name: 'Sample Biology Quiz', numQuestions: 15, key: { 1: ['A'], 2: ['C'] }, results: [] }
  ]);
  const [activeQuizId, setActiveQuizId] = useState(null);
  
  // Scanner State
  const [scannerMode, setScannerMode] = useState('grade'); // 'grade' or 'key'
  const [scanResult, setScanResult] = useState(null);

  const activeQuiz = quizzes.find(q => q.id === activeQuizId);

  // Handlers
  const handleCreateQuiz = (name, numQuestions) => {
    const newQuiz = {
      id: Date.now(),
      name,
      numQuestions: parseInt(numQuestions, 10),
      key: {},
      results: []
    };
    setQuizzes([...quizzes, newQuiz]);
    setActiveQuizId(newQuiz.id);
    setView('quiz_detail');
  };

  const updateQuizKey = (quizId, newKey) => {
    setQuizzes(quizzes.map(q => q.id === quizId ? { ...q, key: newKey } : q));
  };

  const handleImportQuiz = (quizData) => {
    const newQuiz = {
      id: Date.now(),
      name: quizData.name,
      numQuestions: parseInt(quizData.numQuestions, 10),
      key: quizData.key || {},
      results: []
    };
    setQuizzes([...quizzes, newQuiz]);
    setActiveQuizId(newQuiz.id);
    setView('quiz_detail');
  };

  const saveScanResult = (quizId, studentName, score, total, rawAnswers) => {
    setQuizzes(quizzes.map(q => {
      if (q.id === quizId) {
        return {
          ...q,
          results: [{ studentName, score, total, rawAnswers, date: new Date().toLocaleString() }, ...q.results]
        };
      }
      return q;
    }));
  };

  // --- Views ---

  const renderHome = () => (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle className="text-blue-600" size={32} />
            QuickGrade
          </h1>
          <p className="text-slate-500">Camera-based bubble sheet grading</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setView('scan_qr')}
            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <QrCode size={20} /> Import
          </button>
          <button 
            onClick={() => setView('create_quiz')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <Plus size={20} /> New Quiz
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {quizzes.length === 0 ? (
          <div className="text-center p-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-slate-500">
            No quizzes yet. Create one to get started!
          </div>
        ) : (
          quizzes.map(quiz => (
            <div 
              key={quiz.id} 
              onClick={() => { setActiveQuizId(quiz.id); setView('quiz_detail'); }}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all flex items-center justify-between group"
            >
              <div>
                <h3 className="text-lg font-bold text-slate-800">{quiz.name}</h3>
                <p className="text-sm text-slate-500">{quiz.numQuestions} Questions • {quiz.results.length} Graded</p>
              </div>
              <BookOpen className="text-slate-300 group-hover:text-blue-500 transition-colors" size={24} />
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderQuizDetail = () => {
    if (!activeQuiz) return null;
    const isKeySet = Object.keys(activeQuiz.key).length > 0;

    return (
      <div className="p-6 max-w-2xl mx-auto">
        <button onClick={() => setView('home')} className="mb-6 flex items-center text-slate-500 hover:text-slate-800">
          <ArrowLeft size={20} className="mr-1" /> Dashboard
        </button>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
          <h2 className="text-2xl font-bold text-slate-800">{activeQuiz.name}</h2>
          <p className="text-slate-500 mb-6">{activeQuiz.numQuestions} Questions</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => setView('print')}
              className="flex items-center justify-center gap-2 p-4 border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors font-medium text-slate-700"
            >
              <Printer size={20} /> Print Bubble Sheets
            </button>
            
            <button 
              onClick={() => setView('manual_key')}
              className="flex items-center justify-center gap-2 p-4 border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors font-medium text-slate-700"
            >
              <Edit3 size={20} /> {isKeySet ? 'Edit Answer Key' : 'Set Answer Key Manually'}
            </button>

            <button 
              onClick={() => { setScannerMode('key'); setView('scanner'); }}
              className="flex items-center justify-center gap-2 p-4 border-2 border-slate-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-colors font-medium text-slate-700"
            >
              <Camera size={20} /> Scan Sheet as Key
            </button>

            <button 
              onClick={() => setView('share_qr')}
              className="flex items-center justify-center gap-2 p-4 border-2 border-slate-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-colors font-medium text-slate-700"
            >
              <QrCode size={20} /> Share via QR
            </button>

            <button 
              disabled={!isKeySet}
              onClick={() => { setScannerMode('grade'); setView('scanner'); }}
              className={`flex items-center justify-center gap-2 p-4 rounded-xl font-bold text-white transition-colors ${isKeySet ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-300 cursor-not-allowed'}`}
            >
              <CheckCircle size={20} /> Grade Papers
            </button>
          </div>
          {!isKeySet && <p className="text-orange-500 text-sm mt-4 text-center">⚠️ You must set an answer key before grading.</p>}
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Results ({activeQuiz.results.length})</h3>
          {activeQuiz.results.length === 0 ? (
            <p className="text-slate-500 italic text-center py-4">No papers graded yet.</p>
          ) : (
            <div className="space-y-3">
              {activeQuiz.results.map((res, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div>
                    <p className="font-bold text-slate-800">{res.studentName}</p>
                    <p className="text-xs text-slate-500">{res.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-blue-600">{res.score} / {res.total}</p>
                    <p className="text-xs text-slate-500">{((res.score/res.total)*100).toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPrintView = () => {
    if (!activeQuiz) return null;
    const coords = getBubbleCoordinates(activeQuiz.numQuestions);

    return (
      <div className="min-h-screen bg-slate-100 p-4 flex flex-col items-center">
        <style>
          {`
            @media print {
              body * { visibility: hidden; }
              #printable-area, #printable-area * { visibility: visible; }
              #printable-area {
                position: absolute; left: 50%; top: 0;
                transform: translateX(-50%);
                width: 7.5in !important; height: 10in !important; /* 3:4 Aspect Ratio */
                margin: 0; padding: 0;
              }
              .no-print { display: none !important; }
            }
          `}
        </style>
        
        <div className="mb-4 flex gap-4 no-print">
          <button onClick={() => setView('quiz_detail')} className="px-4 py-2 bg-white border border-slate-300 rounded-lg font-medium hover:bg-slate-50">Back</button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2">
            <Printer size={18} /> Print Now
          </button>
        </div>

        <div className="bg-white shadow-xl p-8 rounded border border-slate-200 no-print mb-4 text-center max-w-lg">
          <h3 className="font-bold text-lg mb-2">Printing Instructions</h3>
          <p className="text-slate-600 text-sm">Ensure "Background Graphics" is enabled in your print dialog so the black alignment border prints. The printed area must be exactly as shown for the camera to read it properly.</p>
        </div>

        {/* This is the actual printable area. It maintains a strict 3:4 aspect ratio. */}
        <div id="printable-area" className="bg-white relative border-[12px] border-black" style={{ width: '750px', height: '1000px' }}>
          
          {/* Header */}
          <div className="absolute top-[3%] left-[5%] right-[5%] flex justify-between border-b-2 border-black pb-4">
            <div className="flex-1 space-y-4">
              <h1 className="text-2xl font-bold uppercase tracking-wider">{activeQuiz.name}</h1>
              <div className="flex items-end gap-2"><span className="font-bold">Name:</span><div className="flex-1 border-b border-black"></div></div>
              <div className="flex items-end gap-2"><span className="font-bold">Date:</span><div className="flex-1 border-b border-black"></div></div>
            </div>
            <div className="w-32 h-32 border-2 border-black ml-4 flex flex-col">
              <div className="bg-black text-white text-center font-bold py-1">SCORE</div>
              <div className="flex-1"></div>
            </div>
          </div>

          {/* Bubbles */}
          {Object.entries(coords).map(([qNum, options]) => (
            <React.Fragment key={`q${qNum}`}>
              {/* Question Number */}
              <div 
                className="absolute font-bold text-lg right-2 text-right"
                style={{ 
                  left: `${(parseFloat(options['A'].rx) - 0.10) * 100}%`, 
                  top: `${options['A'].ry * 100}%`,
                  transform: 'translateY(-50%)',
                  width: '30px'
                }}
              >
                {qNum}.
              </div>
              
              {/* Options */}
              {Object.entries(options).map(([opt, {rx, ry}]) => (
                <div 
                  key={`${qNum}-${opt}`}
                  className="absolute w-[24px] h-[24px] border-[2px] border-black rounded-full flex items-center justify-center text-[10px] font-bold text-slate-400 bg-white"
                  style={{ 
                    left: `${rx * 100}%`, 
                    top: `${ry * 100}%`,
                    transform: 'translate(-50%, -50%)' 
                  }}
                >
                  {opt}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  // --- Router ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {view === 'home' && renderHome()}
      {view === 'create_quiz' && <CreateQuizView setView={setView} handleCreateQuiz={handleCreateQuiz} />}
      {view === 'quiz_detail' && renderQuizDetail()}
      {view === 'print' && renderPrintView()}
      {view === 'share_qr' && <ShareQRView activeQuiz={activeQuiz} setView={setView} />}
      {view === 'scan_qr' && <ScanQRView setView={setView} onImportQuiz={handleImportQuiz} />}
      {view === 'manual_key' && <ManualKeyView activeQuiz={activeQuiz} setView={setView} updateQuizKey={updateQuizKey} />}
      {view === 'scanner' && <ScannerView activeQuiz={activeQuiz} scannerMode={scannerMode} setView={setView} updateQuizKey={updateQuizKey} saveScanResult={saveScanResult} />}
    </div>
  );
}
