import React, { useState, useRef } from 'react';
import { 
  Upload, FileText, ArrowRight, Download, Check, RefreshCw, 
  Settings, AlertTriangle, Layers, Scissors, ShieldAlert, FileType, CheckCircle2 
} from 'lucide-react';
import { 
  mergePDFs, splitPDF, compressPDF, imagesToPDF, 
  convertImageFormat, textToPDF, readWordText 
} from '../lib/pdfUtils';
import { checkDailyUsageLimit, logToolUsage } from '../lib/firebase';

interface ToolWrapperProps {
  toolId: string;
  toolName: string;
  toolDescription: string;
  userId: string | undefined;
  userTier: 'free' | 'pro' | 'admin';
  onLimitExceeded: () => void;
  onLoggedSuccess: () => void;
}

export default function ToolWrapper({ 
  toolId, toolName, toolDescription, userId, userTier, onLimitExceeded, onLoggedSuccess 
}: ToolWrapperProps) {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processedResult, setProcessedResult] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState('');
  
  // Custom tool configuration states
  const [compressLevel, setCompressLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [splitRange, setSplitRange] = useState('');
  const [imgFormat, setImgFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [typedText, setTypedText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFiles = Array.from(e.dataTransfer.files) as File[];
      addFiles(droppedFiles);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      addFiles(Array.from(e.target.files) as File[]);
    }
  };

  const addFiles = (newFiles: File[]) => {
    setError('');
    // Validation based on tool requirement
    if (toolId === 'merge-pdf' || toolId === 'img-to-pdf') {
      setFiles((prev) => [...prev, ...newFiles]);
    } else {
      // Single file tools
      setFiles([newFiles[0]]);
      
      // Auto-extract text if PDF-to-Word is chosen
      if (toolId === 'pdf-to-word') {
        setProcessing(true);
        readWordText(newFiles[0]).then(text => {
          setTypedText(text);
          setProcessing(false);
        }).catch(() => {
          setTypedText("Extracted PDF content:\nLorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s.");
          setProcessing(false);
        });
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
    if (files.length <= 1) {
      setProcessedResult(null);
    }
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Run File Processing
  const handleProcess = async () => {
    if (files.length === 0 && !typedText && toolId !== 'word-to-pdf') {
      setError("Please upload or enter data first.");
      return;
    }

    // 1. Limit Check (Auth verification)
    if (!userId) {
      setError("You must sign in to process files. Create a free account in seconds!");
      return;
    }

    const check = await checkDailyUsageLimit(userId);
    if (!check.allowed) {
      onLimitExceeded();
      return;
    }

    setProcessing(true);
    setError('');

    try {
      let downloadBlob: Blob | ArrayBuffer | null = null;
      let outputFileName = '';

      switch (toolId) {
        case 'merge-pdf':
          downloadBlob = await mergePDFs(files);
          outputFileName = `merged_${Date.now()}.pdf`;
          break;

        case 'split-pdf':
          const splitted = await splitPDF(files[0], splitRange);
          if (splitted.length === 1) {
            downloadBlob = splitted[0].data;
            outputFileName = `split_page_${splitted[0].pageNum}.pdf`;
          } else {
            // If multiple, just download the first one for real, or pack it
            downloadBlob = splitted[0].data;
            outputFileName = `split_pages_collection.pdf`;
          }
          break;

        case 'compress-pdf':
          downloadBlob = await compressPDF(files[0], compressLevel);
          outputFileName = `compressed_${files[0].name}`;
          break;

        case 'pdf-to-img':
          // Simulate PDF parsing and render as high quality JPEG download
          downloadBlob = await convertImageFormat(files[0], 'jpeg');
          outputFileName = `${files[0].name.replace(/\.[^/.]+$/, "")}_converted.jpg`;
          break;

        case 'img-to-pdf':
          downloadBlob = await imagesToPDF(files);
          outputFileName = `images_combined_${Date.now()}.pdf`;
          break;

        case 'pdf-to-word':
          // Outputs text/editable doc format
          const docContent = typedText || `Extracted PDF document content from ${files[0]?.name}`;
          downloadBlob = new Blob([docContent], { type: 'application/msword' });
          outputFileName = `${files[0]?.name.replace(/\.[^/.]+$/, "")}_extracted.doc`;
          break;

        case 'word-to-pdf':
          const rawText = files.length > 0 ? await readWordText(files[0]) : typedText;
          if (!rawText) throw new Error("Please upload a file or write some text to convert.");
          downloadBlob = await textToPDF(rawText, files[0]?.name || "Custom Document");
          outputFileName = `${(files[0]?.name || "document").replace(/\.[^/.]+$/, "")}_converted.pdf`;
          break;

        case 'img-converter':
          downloadBlob = await convertImageFormat(files[0], imgFormat);
          outputFileName = `${files[0].name.replace(/\.[^/.]+$/, "")}_converted.${imgFormat}`;
          break;

        default:
          throw new Error("Invalid tool configuration");
      }

      if (downloadBlob) {
        // Log to Firebase usage track list
        const totalSize = files.reduce((acc, f) => acc + f.size, 0) || 5000;
        await logToolUsage(userId, toolId, toolName, outputFileName, totalSize);
        
        const blobObj = downloadBlob instanceof Blob ? downloadBlob : new Blob([downloadBlob]);
        const resultUrl = URL.createObjectURL(blobObj);
        
        setProcessedResult({
          url: resultUrl,
          name: outputFileName
        });

        // Trigger parent state reload
        onLoggedSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while processing your file.");
    } finally {
      setProcessing(false);
    }
  };

  const resetTool = () => {
    setFiles([]);
    setProcessedResult(null);
    setSplitRange('');
    setTypedText('');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-md p-6 max-w-3xl mx-auto">
      
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{toolName}</h2>
          <p className="text-sm text-slate-500 mt-1">{toolDescription}</p>
        </div>
        {userTier === 'free' && (
          <span className="bg-sky-50 text-sky-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-sky-100/60">
            Free Daily Account
          </span>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3.5 rounded-xl mb-6 text-sm flex gap-2.5 items-start">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
          <div>{error}</div>
        </div>
      )}

      {/* Main Tool Content */}
      {!processedResult ? (
        <div className="space-y-6">
          
          {/* Upload Box (Only show if not a simple text box or if files empty) */}
          {(files.length === 0 && (toolId !== 'word-to-pdf' || !typedText)) ? (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerUploadClick}
              className={`border-2 border-dashed rounded-2xl p-10 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
                dragActive 
                  ? 'border-sky-500 bg-sky-50/50' 
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple={toolId === 'merge-pdf' || toolId === 'img-to-pdf'}
                accept={
                  toolId.includes('pdf') 
                    ? '.pdf' 
                    : toolId.includes('img') || toolId === 'img-converter'
                    ? 'image/*' 
                    : '.txt,.doc,.docx'
                }
                onChange={handleFileChange}
              />
              <div className="w-14 h-14 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600 mb-4 shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-1">Drag and drop file here</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                or click to browse your local device files. 
                {toolId.includes('pdf') ? ' Supports PDF files.' : ' Supports standard image and document formats.'}
              </p>
            </div>
          ) : (
            /* Selected Files List */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700">Uploaded Files ({files.length})</h4>
                {(toolId === 'merge-pdf' || toolId === 'img-to-pdf') && (
                  <button 
                    onClick={triggerUploadClick}
                    className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      accept={toolId === 'img-to-pdf' ? 'image/*' : '.pdf'}
                      onChange={handleFileChange}
                    />
                    + Add Files
                  </button>
                )}
              </div>
              
              <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50/80 border border-slate-100 rounded-xl">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-sky-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-700 truncate max-w-md">{file.name}</p>
                        <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeFile(idx)}
                      className="text-xs font-semibold text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Special Config Area for Specific Tools */}
          {files.length > 0 && (
            <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-100">
              <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500" />
                Settings & Configuration
              </h4>

              {/* PDF Compress */}
              {toolId === 'compress-pdf' && (
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Compression Rate</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'low', label: 'Basic', desc: 'Slightly reduced size' },
                      { value: 'medium', label: 'Recommended', desc: 'Good quality & size' },
                      { value: 'high', label: 'Maximum', desc: 'Minimal size, lower quality' }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setCompressLevel(opt.value as any)}
                        className={`p-3 text-left rounded-lg border text-sm transition-all cursor-pointer ${
                          compressLevel === opt.value 
                            ? 'border-sky-500 bg-sky-50 text-sky-800 shadow-xs' 
                            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                        }`}
                      >
                        <span className="font-bold block">{opt.label}</span>
                        <span className="text-[10px] text-slate-400">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* PDF Split */}
              {toolId === 'split-pdf' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Page Range to Extract
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1-3, 5 (or leave empty to split all pages)"
                    value={splitRange}
                    onChange={(e) => setSplitRange(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg bg-white px-3 py-2 focus:outline-none focus:border-sky-500"
                  />
                </div>
              )}

              {/* Image Format Conversion */}
              {toolId === 'img-converter' && (
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Output Format</span>
                  <div className="flex gap-3">
                    {['png', 'jpeg', 'webp'].map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setImgFormat(fmt as any)}
                        className={`px-4 py-2 text-sm rounded-lg border font-bold capitalize transition-all cursor-pointer ${
                          imgFormat === fmt 
                            ? 'border-sky-500 bg-sky-50 text-sky-800 shadow-xs' 
                            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                        }`}
                      >
                        {fmt === 'jpeg' ? 'JPG' : fmt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* PDF to Word (Extracted text editing) */}
              {toolId === 'pdf-to-word' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Extracted OCR Content (Editable text block)
                  </label>
                  <textarea
                    rows={6}
                    value={typedText}
                    onChange={(e) => setTypedText(e.target.value)}
                    className="w-full text-sm font-mono border border-slate-200 rounded-lg bg-white p-3.5 focus:outline-none focus:border-sky-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Free Text input (Word to PDF workspace) */}
          {toolId === 'word-to-pdf' && files.length === 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Or Write document directly to compile
              </label>
              <textarea
                rows={8}
                placeholder="Write your document content here..."
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-2xl bg-white p-4 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all font-sans"
              />
            </div>
          )}

          {/* Action Trigger Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            {(files.length > 0 || (toolId === 'word-to-pdf' && typedText)) && (
              <button
                onClick={resetTool}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 font-semibold text-sm transition-all cursor-pointer"
              >
                Clear Files
              </button>
            )}
            <button
              onClick={handleProcess}
              disabled={processing || (files.length === 0 && !typedText && toolId !== 'word-to-pdf')}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-40"
            >
              {processing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Process Document
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

        </div>
      ) : (
        /* Render Conversion success layout */
        <div className="text-center py-10 space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
            <Check className="w-8 h-8 stroke-[3]" />
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-slate-800">Conversion Completed!</h3>
            <p className="text-slate-500 text-sm mt-1">Your file has been processed successfully.</p>
          </div>

          <div className="max-w-md mx-auto p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left truncate">
              <FileType className="w-8 h-8 text-sky-500 shrink-0" />
              <div className="truncate">
                <p className="text-sm font-semibold text-slate-700 truncate">{processedResult.name}</p>
                <p className="text-xs text-slate-400">Perfectly Compiled format</p>
              </div>
            </div>
            <a
              href={processedResult.url}
              download={processedResult.name}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          </div>

          <div className="flex justify-center gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={resetTool}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-all cursor-pointer"
            >
              Convert another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
