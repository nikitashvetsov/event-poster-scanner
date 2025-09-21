import React, { useState, useRef, ChangeEvent } from 'react';
import { Camera, Upload, Calendar, CheckCircle, AlertCircle, Edit3, Download, X } from 'lucide-react';

// Define the "blueprint" for a single event object
interface IEvent {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
}

// Define the "blueprint" for the main details of a multi-event
interface IMainEvent {
  mainTitle: string;
  venue: string;
}

const EventPosterScanner = () => {
  // Add explicit types to our state variables
  const [image, setImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [eventDetails, setEventDetails] = useState<IEvent | IMainEvent | null>(null);
  const [multipleEvents, setMultipleEvents] = useState<IEvent[]>([]);
  const [isMultiEvent, setIsMultiEvent] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState('');
  const [showCamera, setShowCamera] = useState(false);

  // Add types for useRef hooks to know they are HTML elements
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize camera
  const startCamera = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (err) {
      setError('Could not access camera. Please use file upload instead.');
    }
  };

  // Capture photo from camera
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');
        setImage(imageData);
        stopCamera();
        setCurrentStep(2);
        performOCR(imageData);
      }
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  // Add type for the browser event
  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImage(result);
        setCurrentStep(2);
        setError('');
        performOCR(result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Real OCR implementation with Tesseract.js
  const performOCR = async (imageData: string) => {
    setIsProcessing(true);
    setError('');

    try {
      // @ts-ignore Tesseract is loaded from a script tag on the page
      if (typeof Tesseract === 'undefined') {
        await new Promise<void>((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/tesseract.js@5.0.0/dist/tesseract.min.js';
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }
      
      // @ts-ignore
      const worker = await Tesseract.createWorker('eng');
      const { data: { text } } = await worker.recognize(imageData);
      await worker.terminate();

      if (!text || text.trim().length < 5) {
        throw new Error('No meaningful text extracted from image');
      }

      setExtractedText(text);
      setCurrentStep(3);
      parseTextManually(text); // Fallback to manual parsing as API is not set up
    } catch (err) {
      console.error('OCR Error:', err);
      setError('Failed to extract text from the image. Please try again with a clearer image.');
      setCurrentStep(1); // Go back to upload step
    } finally {
      setIsProcessing(false);
    }
  };

  // Simplified local text parsing
  const parseTextManually = (text: string) => {
    const multiEventIndicators = ['day 1', 'day 2', 'schedule', 'lineup', 'program', 'agenda', 'session'];
    const hasMultipleEvents = multiEventIndicators.some(indicator => text.toLowerCase().includes(indicator));

    if (hasMultipleEvents) {
      setIsMultiEvent(true);
      setEventDetails({
        mainTitle: "Multi-Day Event (Edit Me)",
        venue: "Event Venue (Edit Me)",
      });
      setMultipleEvents([{
        title: "Event 1 (Edit Me)",
        date: new Date().toISOString().split('T')[0],
        startTime: "19:00",
        endTime: "21:00",
        location: "Event Venue",
        description: "Please edit this description"
      }]);
    } else {
      setIsMultiEvent(false);
      setEventDetails({
        title: "Event Title (Edit Me)",
        date: new Date().toISOString().split('T')[0],
        startTime: "19:00",
        endTime: "21:00",
        location: "Event Location",
        description: "Please edit this description"
      });
    }
    setCurrentStep(4);
    setIsEditing(true);
  };
  
  // Add types for function parameters
  const handleDetailChange = (field: string, value: string, eventIndex: number | null = null) => {
    if (isMultiEvent && eventIndex !== null) {
      setMultipleEvents(prev =>
        prev.map((event, index) =>
          index === eventIndex ? { ...event, [field]: value } : event
        )
      );
    } else {
      setEventDetails(prev => prev ? { ...prev, [field]: value } : prev);
    }
  };

  const addSubEvent = () => {
    const newEvent: IEvent = {
      title: "New Sub-Event",
      date: new Date().toISOString().split('T')[0],
      startTime: "19:00",
      endTime: "21:00",
      location: (eventDetails as IMainEvent)?.venue || "Event Location",
      description: "Event Description"
    };
    setMultipleEvents(prev => [...prev, newEvent]);
  };

  const removeSubEvent = (indexToRemove: number) => {
    setMultipleEvents(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const generateCalendarFile = () => {
    if (!eventDetails) return;

    const formatDate = (date: string, time: string) => {
      if (!date || !time) return '';
      const dateTime = new Date(`${date}T${time}:00`);
      return dateTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    let icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Event Poster Scanner//EN\n`;

    if (isMultiEvent && multipleEvents.length > 0) {
      multipleEvents.forEach((event, index) => {
        icsContent += `BEGIN:VEVENT\n`;
        icsContent += `UID:${Date.now()}-${index}@eventscanner.com\n`;
        icsContent += `DTSTART:${formatDate(event.date, event.startTime)}\n`;
        icsContent += `DTEND:${formatDate(event.date, event.endTime)}\n`;
        icsContent += `SUMMARY:${event.title}\n`;
        icsContent += `LOCATION:${event.location}\n`;
        icsContent += `DESCRIPTION:${event.description}\n`;
        icsContent += `END:VEVENT\n`;
      });
    } else if (!isMultiEvent) {
      const singleEvent = eventDetails as IEvent;
      icsContent += `BEGIN:VEVENT\n`;
      icsContent += `UID:${Date.now()}@eventscanner.com\n`;
      icsContent += `DTSTART:${formatDate(singleEvent.date, singleEvent.startTime)}\n`;
      icsContent += `DTEND:${formatDate(singleEvent.date, singleEvent.endTime)}\n`;
      icsContent += `SUMMARY:${singleEvent.title}\n`;
      icsContent += `LOCATION:${singleEvent.location}\n`;
      icsContent += `DESCRIPTION:${singleEvent.description}\n`;
      icsContent += `END:VEVENT\n`;
    }

    icsContent += `END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const fileName = isMultiEvent
      ? `${(eventDetails as IMainEvent).mainTitle?.replace(/\s+/g, '_') || 'Multi_Event'}.ics`
      : `${(eventDetails as IEvent).title?.replace(/\s+/g, '_') || 'Event'}.ics`;

    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetApp = () => {
    setImage(null);
    setExtractedText('');
    setEventDetails(null);
    setMultipleEvents([]);
    setIsMultiEvent(false);
    setCurrentStep(1);
    setIsEditing(false);
    setError('');
    stopCamera();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Use type assertion to safely access properties in JSX
  const singleEvent = eventDetails as IEvent;
  const mainEvent = eventDetails as IMainEvent;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Event Poster Scanner</h1>
          <p className="text-gray-600">Extract event details from posters and add them to your calendar</p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${currentStep >= step ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
                  {step}
                </div>
                {step < 4 && <div className={`w-16 h-1 mx-2 ${currentStep > step ? 'bg-blue-500' : 'bg-gray-300'}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          {showCamera && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-4 max-w-md w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Take Photo</h3>
                  <button onClick={stopCamera} className="text-gray-500 hover:text-gray-700"><X className="h-6 w-6" /></button>
                </div>
                <div className="relative">
                  <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" />
                  <button onClick={capturePhoto} className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white rounded-full p-4 hover:bg-blue-600">
                    <Camera className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {currentStep === 1 && (
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-6">Upload Event Poster</h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600 mb-6">Choose an image of an event poster</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center">
                    <Upload className="h-4 w-4 mr-2" /> Upload from Gallery
                  </button>
                  <button onClick={startCamera} className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center">
                    <Camera className="h-4 w-4 mr-2" /> Take Photo
                  </button>
                </div>
              </div>
              {error && (
                <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-red-700">{error}</span>
                </div>
              )}
            </div>
          )}

          {(currentStep === 2 || currentStep === 3) && (
             <div className="text-center">
               <h2 className="text-2xl font-semibold mb-6">{currentStep === 2 ? 'Processing Image' : 'Analyzing Event Details'}</h2>
               {currentStep === 2 && image && <div className="mb-6"><img src={image} alt="Uploaded poster" className="max-w-md mx-auto rounded-lg shadow-md" /></div>}
               {currentStep === 3 && (
                 <div className="bg-gray-50 rounded-lg p-4 mb-6">
                   <h3 className="text-lg font-semibold mb-2">Extracted Text:</h3>
                   <pre className="text-sm text-gray-700 whitespace-pre-wrap text-left max-h-64 overflow-y-auto">{extractedText}</pre>
                 </div>
               )}
               {isProcessing && (
                 <div className="flex items-center justify-center">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                   <span className="text-gray-600">{currentStep === 2 ? 'Extracting text...' : 'Parsing details...'}</span>
                 </div>
               )}
             </div>
           )}

          {currentStep === 4 && eventDetails && (
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold">{isMultiEvent ? 'Multi-Event Details' : 'Event Details'}</h2>
                <div className="flex space-x-2">
                  <button onClick={() => setIsEditing(!isEditing)} className="flex items-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
                    <Edit3 className="h-4 w-4 mr-2" /> {isEditing ? 'Save' : 'Edit'}
                  </button>
                  <button onClick={generateCalendarFile} className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                    <Download className="h-4 w-4 mr-2" /> Download .ics
                  </button>
                </div>
              </div>

              {isMultiEvent ? (
                <div className="space-y-6">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Event/Festival Name</label>
                        {isEditing ? <input type="text" value={mainEvent.mainTitle || ''} onChange={(e) => handleDetailChange('mainTitle', e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" /> : <div className="p-3 bg-white rounded-lg">{mainEvent.mainTitle}</div>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Main Venue</label>
                        {isEditing ? <input type="text" value={mainEvent.venue || ''} onChange={(e) => handleDetailChange('venue', e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" /> : <div className="p-3 bg-white rounded-lg">{mainEvent.venue}</div>}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                      {multipleEvents.map((event, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4 border">
                           <div className="flex justify-between items-start mb-3">
                            <h4 className="font-medium text-gray-800">Sub-Event #{index + 1}</h4>
                            {isEditing && <button onClick={() => removeSubEvent(index)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Title</label>{isEditing ? <input type="text" value={event.title} onChange={(e) => handleDetailChange('title', e.target.value, index)} className="w-full p-2 border border-gray-300 rounded"/> : <div className="p-2 bg-white rounded text-sm">{event.title}</div>}</div>
                            <div><label className="block text-xs font-medium text-gray-600 mb-1">Date</label>{isEditing ? <input type="date" value={event.date} onChange={(e) => handleDetailChange('date', e.target.value, index)} className="w-full p-2 border border-gray-300 rounded"/> : <div className="p-2 bg-white rounded text-sm">{event.date}</div>}</div>
                            <div><label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>{isEditing ? <input type="time" value={event.startTime} onChange={(e) => handleDetailChange('startTime', e.target.value, index)} className="w-full p-2 border border-gray-300 rounded"/> : <div className="p-2 bg-white rounded text-sm">{event.startTime}</div>}</div>
                            <div><label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>{isEditing ? <input type="time" value={event.endTime} onChange={(e) => handleDetailChange('endTime', e.target.value, index)} className="w-full p-2 border border-gray-300 rounded"/> : <div className="p-2 bg-white rounded text-sm">{event.endTime}</div>}</div>
                            <div><label className="block text-xs font-medium text-gray-600 mb-1">Location</label>{isEditing ? <input type="text" value={event.location} onChange={(e) => handleDetailChange('location', e.target.value, index)} className="w-full p-2 border border-gray-300 rounded"/> : <div className="p-2 bg-white rounded text-sm">{event.location}</div>}</div>
                            <div className="md:col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Description</label>{isEditing ? <textarea value={event.description} onChange={(e) => handleDetailChange('description', e.target.value, index)} rows={2} className="w-full p-2 border border-gray-300 rounded"/> : <div className="p-2 bg-white rounded text-sm">{event.description}</div>}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                  {isEditing && <button onClick={addSubEvent} className="w-full bg-blue-100 text-blue-800 py-2 rounded-lg hover:bg-blue-200">Add Sub-Event</button>}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">Event Title</label>{isEditing ? <input type="text" value={singleEvent.title || ''} onChange={(e) => handleDetailChange('title', e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg"/> : <div className="p-3 bg-gray-50 rounded-lg">{singleEvent.title}</div>}</div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">Date</label>{isEditing ? <input type="date" value={singleEvent.date || ''} onChange={(e) => handleDetailChange('date', e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg"/> : <div className="p-3 bg-gray-50 rounded-lg">{singleEvent.date}</div>}</div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>{isEditing ? <input type="time" value={singleEvent.startTime || ''} onChange={(e) => handleDetailChange('startTime', e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg"/> : <div className="p-3 bg-gray-50 rounded-lg">{singleEvent.startTime}</div>}</div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>{isEditing ? <input type="time" value={singleEvent.endTime || ''} onChange={(e) => handleDetailChange('endTime', e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg"/> : <div className="p-3 bg-gray-50 rounded-lg">{singleEvent.endTime}</div>}</div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-2">Location</label>{isEditing ? <input type="text" value={singleEvent.location || ''} onChange={(e) => handleDetailChange('location', e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg"/> : <div className="p-3 bg-gray-50 rounded-lg">{singleEvent.location}</div>}</div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-2">Description</label>{isEditing ? <textarea value={singleEvent.description || ''} onChange={(e) => handleDetailChange('description', e.target.value)} rows={4} className="w-full p-3 border border-gray-300 rounded-lg"/> : <div className="p-3 bg-gray-50 rounded-lg">{singleEvent.description}</div>}</div>
                </div>
              )}
              <button onClick={resetApp} className="w-full mt-4 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition-colors">Scan Another Poster</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventPosterScanner;
