import React, { useState, useRef } from 'react';

// SVG Icons
const IconDownload = ({ size = 24, className = "" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>;
const IconTrash = ({ size = 24, className = "" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>;
const IconCode = ({ size = 24, className = "" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
const IconCheck = ({ size = 24, className = "" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>;
const IconVideo = ({ size = 24, className = "" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2" ry="2"/></svg>;
const IconUpload = ({ size = 24, className = "" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 16 4-4 4 4"/></svg>;
const IconSparkles = ({ size = 24, className = "" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>;
const IconLoader = ({ size = 24, className = "" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;

interface Point { x: number; y: number; }
interface FrameData { time: number; path: Point[]; }
type TrackDictionary = { [trackId: string]: FrameData[] };

const TRACK_COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#a855f7', '#ec4899'];

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [vidDim, setVidDim] = useState({ w: 1920, h: 1080 }); 
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoTracks, setVideoTracks] = useState<TrackDictionary>({});
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setVideoTracks({}); 
      setSelectedTracks([]);
    }
  };

  const clearVideo = () => {
    setVideoFile(null);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setVideoTracks({});
    setSelectedTracks([]);
  };

  const toggleTrackSelection = (trackId: string) => {
    setSelectedTracks(prev => 
      prev.includes(trackId) ? prev.filter(id => id !== trackId) : [...prev, trackId]
    );
  };

  const extractVideoMotion = async () => {
    if (!videoFile) return;
    setIsProcessingVideo(true);
    setVideoTracks({});
    setSelectedTracks([]);
    
    const formData = new FormData();
    formData.append("file", videoFile);

    try {
      const response = await fetch("https://animator-w0mr.onrender.com/api/track", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      
      if (data.tracks && Object.keys(data.tracks).length > 0) {
        setVideoTracks(data.tracks);
        setSelectedTracks(Object.keys(data.tracks)); 
      } else {
        alert("No clear shapes were detected.");
      }
    } catch (error) {
      console.error("API Error:", error);
      alert("Failed to connect to backend! Is your Python server running?");
    } finally {
      setIsProcessingVideo(false);
    }
  };

  const generateJSX = (tracksData: TrackDictionary, selectedIds: string[]) => {
    const tracksToProcess = Object.entries(tracksData).filter(([id]) => selectedIds.includes(id));
    if (tracksToProcess.length === 0) return "// Waiting for shape tracking data...";

    let scriptContent = `// Auto-Generated Shape Paths
app.beginUndoGroup("Apply Animated Shapes");

try {
    var comp = app.project.activeItem;
    if (comp !== null && (comp instanceof CompItem)) {
        var compTime = comp.time; 
`;

    tracksToProcess.forEach(([trackId, frames], tIdx) => {
      scriptContent += `
        // --- Shape Layer ${trackId} ---
        var shapeLayer_${tIdx} = comp.layers.addShape();
        shapeLayer_${tIdx}.name = "AI Extracted Shape ${trackId}";
        
        // Align position to [0,0] so it matches absolute video coordinates
        shapeLayer_${tIdx}.property("ADBE Transform Group").property("ADBE Position").setValue([0, 0]);
        
        // 1. ADD ALL LAYER PROPERTIES FIRST (To prevent AE Structural Invalidation)
        shapeLayer_${tIdx}.property("ADBE Root Vectors Group").addProperty("ADBE Vector Shape - Group");
        var strokeProp_${tIdx} = shapeLayer_${tIdx}.property("ADBE Root Vectors Group").addProperty("ADBE Vector Graphic - Stroke");
        
        // 2. CONFIGURE STROKE
        strokeProp_${tIdx}.property("ADBE Vector Stroke Color").setValue([1, 1, 1]); // White
        strokeProp_${tIdx}.property("ADBE Vector Stroke Width").setValue(8);
        
        // 3. FETCH PATH REFERENCE SAFELY AFTER LAYER STRUCTURE IS LOCKED
        var pathProp_${tIdx} = shapeLayer_${tIdx}.property("ADBE Root Vectors Group").property("ADBE Vector Shape - Group").property("ADBE Vector Shape");
`;
      
      frames.forEach((frame, index) => {
        const timeOffset = frame.time.toFixed(3);
        const verticesStr = frame.path.map(pt => `[${pt.x}, ${pt.y}]`).join(", ");
        
        // Create a uniquely named shape object for every single keyframe
        scriptContent += `
        var s_${tIdx}_${index} = new Shape();
        s_${tIdx}_${index}.vertices = [${verticesStr}];
        s_${tIdx}_${index}.closed = true;
        pathProp_${tIdx}.setValueAtTime(compTime + ${timeOffset}, s_${tIdx}_${index});
`;
      });
    });

    scriptContent += `
    } else {
        alert("Please open a composition first!");
    }
} catch(err) {
    alert("Auto-Animator Script Error at line " + err.line + "\\n\\n" + err.toString());
}

app.endUndoGroup();
`;
    return scriptContent;
  };

  const currentJSX = generateJSX(videoTracks, selectedTracks);
  const hasData = selectedTracks.length > 0;

  const handleDownload = () => {
    if (!hasData) return;
    const blob = new Blob([currentJSX], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-shape-animations.jsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentJSX);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white flex items-center gap-3">
            <IconVideo className="text-blue-500" size={32} />
            Auto-Animator Pro: Shape Extractor
          </h1>
          <p className="text-neutral-400 text-lg">
            Isolates organic shapes from video and generates fully editable animated After Effects paths.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-neutral-300">1. Target Video</h2>
              {videoFile && <button onClick={clearVideo} className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded-md transition-colors"><IconTrash size={16} /></button>}
            </div>

            {!videoFile ? (
              <div onClick={() => fileInputRef.current?.click()} className="relative w-full aspect-[4/3] bg-neutral-900/50 hover:bg-neutral-900 border-2 border-dashed border-neutral-700 hover:border-blue-500/50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group">
                <input type="file" ref={fileInputRef} onChange={handleVideoUpload} accept="video/mp4,video/quicktime" className="hidden" />
                <IconUpload size={48} className="text-neutral-600 group-hover:text-blue-400 mb-4 transition-colors" />
                <p className="text-neutral-300 font-medium text-lg">Select Reference Video</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border border-neutral-800 shadow-xl">
                  <video 
                    ref={videoRef} 
                    src={videoUrl!}  
                    controls  
                    className="w-full h-full object-contain" 
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        setVidDim({ w: videoRef.current.videoWidth, h: videoRef.current.videoHeight });
                      }
                    }}
                  />
                  
                  {Object.keys(videoTracks).length > 0 && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <svg 
                          className="w-full h-full opacity-80"
                          viewBox={`0 0 ${vidDim.w} ${vidDim.h}`}
                          preserveAspectRatio="xMidYMid meet"
                        >
                          {Object.entries(videoTracks).map(([id, frames], idx) => {
                            if (!selectedTracks.includes(id) || frames.length === 0) return null;
                            const color = TRACK_COLORS[idx % TRACK_COLORS.length];
                            
                            // We draw the SVG polygon based on the FIRST frame's shape for visualization
                            const firstFramePoints = frames[0].path.map(pt => `${pt.x},${pt.y}`).join(' ');
                            
                            return (
                              <g key={id}>
                                <polygon 
                                  points={firstFramePoints} 
                                  fill="none"
                                  stroke={color} strokeWidth="4" strokeLinejoin="round"
                                />
                              </g>
                            );
                          })}
                        </svg>
                    </div>
                  )}
                </div>

                {Object.keys(videoTracks).length === 0 ? (
                  <button onClick={extractVideoMotion} disabled={isProcessingVideo} className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 text-white rounded-lg font-semibold flex justify-center gap-2">
                    {isProcessingVideo ? <><IconLoader size={18} className="animate-spin" /> Extracting Vector Shapes...</> : <><IconSparkles size={18} /> Isolate Animated Shapes</>}
                  </button>
                ) : (
                  <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium text-neutral-400">Isolated Shapes (Toggle to export):</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(videoTracks).map((id, idx) => {
                        const isSelected = selectedTracks.includes(id);
                        const color = TRACK_COLORS[idx % TRACK_COLORS.length];
                        return (
                          <button
                            key={id}
                            onClick={() => toggleTrackSelection(id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-all ${
                              isSelected ? 'bg-neutral-800 text-white' : 'bg-transparent text-neutral-500 border-neutral-800'
                            }`}
                            style={{ borderColor: isSelected ? color : undefined }}
                          >
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: isSelected ? color : '#525252' }} />
                            Shape ID: {id}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <h2 className="text-xl font-semibold text-neutral-300">2. Generated After Effects Script</h2>
              <div className="flex gap-3">
                <button onClick={handleCopy} disabled={!hasData} className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                  {copied ? <IconCheck size={16} className="text-green-400" /> : <IconCode size={16} />} {copied ? 'Copied!' : 'Copy'}
                </button>
                <button onClick={handleDownload} disabled={!hasData} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 text-white rounded-lg text-sm font-medium">
                  <IconDownload size={16} /> Download
                </button>
              </div>
            </div>

            <div className="bg-[#1e1e1e] rounded-xl overflow-hidden border border-neutral-800 shadow-2xl">
              <div className="flex items-center px-4 py-2 bg-[#2d2d2d] border-b border-neutral-800 gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <div className="p-4 h-[440px] overflow-y-auto custom-scrollbar relative">
                <pre className="text-sm font-mono text-neutral-300">
                  <code className={!hasData ? "text-neutral-600" : ""}>{currentJSX}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}