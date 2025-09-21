import React, { useState, useRef } from 'react';
import { Camera, Upload, Calendar, CheckCircle, AlertCircle, Edit3, Download, X } from 'lucide-react';

const EventPosterScanner = () => {
  const [image, setImage] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [eventDetails, setEventDetails] = useState(null);
  const [multipleEvents, setMultipleEvents] = useState([]);
  const [isMultiEvent, setIsMultiEvent] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Initialize camera
  const startCamera = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera on mobile
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
      ctx.drawImage(video, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg');
      setImage(imageData);
      stopCamera();
      setCurrentStep(2);
      performOCR(imageData);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target.result);
        setCurrentStep(2);
        setError('');
        performOCR(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Real OCR implementation with Tesseract.js
  const performOCR = async (imageData) => {
    setIsProcessing(true);
    setError('');
    
    try {
      // Try to load and use Tesseract.js
      await loadTesseract();
      
      // Initialize Tesseract worker
      const worker = await window.Tesseract.createWorker('eng');
      
      // Recognize text with better options
      const { data: { text } } = await worker.recognize(imageData, {
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?@#$%&*()+-=:;',
        preserve_interword_spaces: '1',
      });
      
      await worker.terminate();
      
      if (!text || text.trim().length < 5) {
        throw new Error('No meaningful text extracted from image');
      }
      
      setExtractedText(text);
      setCurrentStep(3);
      await parseEventDetails(text);
    } catch (err) {
      console.error('OCR Error:', err);
      
      // Fallback: Use mock data for demonstration or let user enter manually
      const shouldUseFallback = confirm(
        'OCR processing failed. Would you like to:\n\n' +
        'OK - Use demo data to see how the app works\n' +
        'Cancel - Enter event details manually'
      );
      
      if (shouldUseFallback) {
        // Use demo extracted text
        const demoText = `SUMMER MUSIC FESTIVAL
Join us for an amazing night of live music!

Date: Saturday, July 15, 2024
Time: 7:00 PM - 11:00 PM
Venue: Central Park Amphitheater
123 Park Avenue, New York, NY 10001

Featuring:
- The Electric Dreamers
- Jazz Fusion Collective
- Local Artist Showcase

Tickets: $25 - Available at the door
Food trucks and beverages available`;
        
        setExtractedText(demoText);
        setCurrentStep(3);
        await parseEventDetails(demoText);
      } else {
        // Skip to manual entry
        setEventDetails({
          title: "Event Title",
          date: new Date().toISOString().split('T')[0],
          startTime: "19:00",
          endTime: "21:00",
          location: "Event Location",
          description: "Event Description"
        });
        setCurrentStep(4);
        setIsEditing(true);
        setError('Please fill in the event details manually.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Load Tesseract.js dynamically with better error handling
  const loadTesseract = () => {
    return new Promise((resolve, reject) => {
      if (window.Tesseract) {
        resolve();
        return;
      }
      
      // Try multiple CDN sources
      const cdnUrls = [
        'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js',
        'https://unpkg.com/tesseract.js@4.1.1/dist/tesseract.min.js'
      ];
      
      let currentCdnIndex = 0;
      
      const tryLoadScript = () => {
        if (currentCdnIndex >= cdnUrls.length) {
          reject(new Error('Could not load Tesseract.js from any CDN'));
          return;
        }
        
        const script = document.createElement('script');
        script.src = cdnUrls[currentCdnIndex];
        script.onload = () => {
          // Wait a bit for Tesseract to initialize
          setTimeout(resolve, 500);
        };
        script.onerror = () => {
          currentCdnIndex++;
          tryLoadScript();
        };
        document.head.appendChild(script);
      };
      
      tryLoadScript();
    });
  };

  // Real Claude API integration for multi-event parsing
  const parseEventDetails = async (text) => {
    setIsProcessing(true);
    
    try {
      // Note: In a production app, you would need to provide your own API key
      // For now, we'll simulate the API call and provide fallback functionality
      
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // In production, you would add: "x-api-key": "your-api-key-here"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: `Analyze this event poster text and determine if it's a single event or multiple events. Respond ONLY with valid JSON in this format:

For SINGLE events:
{
  "eventType": "single",
  "event": {
    "title": "event name",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM", 
    "location": "venue/address",
    "description": "event description"
  }
}

For MULTIPLE events (festivals, conferences, multi-day events):
{
  "eventType": "multiple",
  "mainTitle": "overall event/festival name",
  "venue": "main venue/location",
  "events": [
    {
      "title": "sub-event name",
      "date": "YYYY-MM-DD",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "location": "specific venue if different from main",
      "description": "sub-event description"
    }
  ]
}

Guidelines:
- Look for multiple dates, times, or sub-events
- Check for words like "Day 1", "Schedule", "Lineup", "Sessions"
- For festivals: separate each day/performance
- For conferences: separate each session/talk
- Use 24-hour format for times
- Convert relative dates to actual dates
- If missing info, use reasonable defaults

DO NOT include any text outside the JSON object.

Text to analyze:
${text}`
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      let responseText = data.content[0].text;
      
      // Clean up response
      responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      const parsedData = JSON.parse(responseText);
      
      if (parsedData.eventType === 'multiple') {
        setIsMultiEvent(true);
        setMultipleEvents(parsedData.events || []);
        setEventDetails({
          mainTitle: parsedData.mainTitle || "Multi-Day Event",
          venue: parsedData.venue || "Event Venue"
        });
      } else {
        setIsMultiEvent(false);
        setEventDetails(parsedData.event || {});
        setMultipleEvents([]);
      }
      
      setCurrentStep(4);
    } catch (err) {
      console.error('API Parsing Error:', err);
      
      // Show user-friendly error and offer alternatives
      const shouldUseDemo = confirm(
        `Claude API parsing failed (${err.message}).\n\n` +
        'This could be due to:\n' +
        '• Missing API key\n' +
        '• Network issues\n' +
        '• API rate limits\n\n' +
        'Would you like to:\n\n' +
        'OK - Try parsing the text manually (recommended)\n' +
        'Cancel - Use demo data to see how the app works'
      );
      
      if (shouldUseDemo) {
        // Manual parsing - analyze the text for common patterns
        const manualParsedData = parseTextManually(text);
        
        if (manualParsedData.eventType === 'multiple') {
          setIsMultiEvent(true);
          setMultipleEvents(manualParsedData.events || []);
          setEventDetails({
            mainTitle: manualParsedData.mainTitle || "Multi-Day Event",
            venue: manualParsedData.venue || "Event Venue"
          });
        } else {
          setIsMultiEvent(false);
          setEventDetails(manualParsedData.event || {});
          setMultipleEvents([]);
        }
      } else {
        // Use demo data
        setIsMultiEvent(true);
        setEventDetails({
          mainTitle: "Summer Music Festival 2024",
          venue: "Central Park Amphitheater"
        });
        setMultipleEvents([
          {
            title: "Opening Night - The Electric Dreamers",
            date: "2024-07-15",
            startTime: "19:00",
            endTime: "21:00",
            location: "Main Stage",
            description: "Kick off the festival with high-energy electronic music"
          },
          {
            title: "Jazz Fusion Collective",
            date: "2024-07-16",
            startTime: "20:00",
            endTime: "22:00", 
            location: "Jazz Lounge",
            description: "Smooth jazz and fusion performances"
          },
          {
            title: "Local Artist Showcase",
            date: "2024-07-17",
            startTime: "18:00",
            endTime: "23:00",
            location: "Multiple Stages",
            description: "Featuring the best local talent"
          }
        ]);
      }
      
      setCurrentStep(4);
      setIsEditing(true);
      setError('AI parsing unavailable. Please review and edit the extracted details.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Manual text parsing fallback
  const parseTextManually = (text) => {
    const lines = text.toLowerCase().split('\n').filter(line => line.trim());
    
    // Look for multiple date patterns or event indicators
    const dateMatches = text.match(/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\w+day|\d{1,2}\s+\w+\s+\d{2,4}/gi) || [];
    const timeMatches = text.match(/\d{1,2}:\d{2}\s*(am|pm)?/gi) || [];
    const multiEventIndicators = ['day 1', 'day 2', 'schedule', 'lineup', 'program', 'agenda', 'session'];
    
    const hasMultipleEvents = dateMatches.length > 1 || 
                            multiEventIndicators.some(indicator => text.toLowerCase().includes(indicator));
    
    if (hasMultipleEvents) {
      // Try to extract main title (usually first or largest text)
      const titleMatch = text.match(/^(.{3,50})/m);
      const mainTitle = titleMatch ? titleMatch[1].trim() : "Multi-Day Event";
      
      // Create sample events based on found patterns
      const events = [];
      for (let i = 0; i < Math.min(dateMatches.length, 3); i++) {
        events.push({
          title: `Event ${i + 1}`,
          date: new Date(Date.now() + (i * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
          startTime: timeMatches[i * 2] ? timeMatches[i * 2].replace(/[^\d:]/g, '') : "19:00",
          endTime: timeMatches[i * 2 + 1] ? timeMatches[i * 2 + 1].replace(/[^\d:]/g, '') : "21:00",
          location: "Event Venue",
          description: "Please edit this event description"
        });
      }
      
      return {
        eventType: "multiple",
        mainTitle: mainTitle,
        venue: "Event Venue",
        events: events.length > 0 ? events : [{
          title: "Event 1",
          date: new Date().toISOString().split('T')[0],
          startTime: "19:00",
          endTime: "21:00",
          location: "Event Venue",
          description: "Please edit this event description"
        }]
      };
    } else {
      // Single event
      const titleMatch = text.match(/^(.{3,100})/m);
      return {
        eventType: "single",
        event: {
          title: titleMatch ? titleMatch[1].trim() : "Event Title",
          date: dateMatches[0] ? new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          startTime: timeMatches[0] ? timeMatches[0].replace(/[^\d:]/g, '') : "19:00",
          endTime: timeMatches[1] ? timeMatches[1].replace(/[^\d:]/g, '') : "21:00",
          location: "Event Location",
          description: "Please edit this event description"
        }
      };
    }
  };

  const handleDetailChange = (field, value, eventIndex = null) => {
    if (isMultiEvent && eventIndex !== null) {
      // Update specific sub-event
      setMultipleEvents(prev => 
        prev.map((event, index) => 
          index === eventIndex ? { ...event, [field]: value } : event
        )
      );
    } else if (isMultiEvent) {
      // Update main event details
      setEventDetails(prev => ({
        ...prev,
        [field]: value
      }));
    } else {
      // Update single event
      setEventDetails(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const addSubEvent = () => {
    const newEvent = {
      title: "New Sub-Event",
      date: new Date().toISOString().split('T')[0],
      startTime: "19:00",
      endTime: "21:00",
      location: eventDetails.venue || "Event Location",
      description: "Event Description"
    };
    setMultipleEvents(prev => [...prev, newEvent]);
  };

  const removeSubEvent = (index) => {
    setMultipleEvents(prev => prev.filter((_, i) => i !== index));
  };

  const generateCalendarFile = () => {
    if (!eventDetails) return;

    const formatDate = (date, time) => {
      const dateTime = new Date(`${date}T${time}:00`);
      return dateTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Event Poster Scanner//EN
`;

    if (isMultiEvent && multipleEvents.length > 0) {
      // Generate multiple events
      multipleEvents.forEach((event, index) => {
        const startDateTime = formatDate(event.date, event.startTime);
        const endDateTime = formatDate(event.date, event.endTime);
        
        icsContent += `BEGIN:VEVENT
UID:${Date.now()}-${index}@eventscanner.com
DTSTART:${startDateTime}
DTEND:${endDateTime}
SUMMARY:${event.title}
LOCATION:${event.location}
DESCRIPTION:${event.description}
END:VEVENT
`;
      });
    } else {
      // Generate single event
      const startDateTime = formatDate(eventDetails.date, eventDetails.startTime);
      const endDateTime = formatDate(eventDetails.date, eventDetails.endTime);
      
      icsContent += `BEGIN:VEVENT
UID:${Date.now()}@eventscanner.com
DTSTART:${startDateTime}
DTEND:${endDateTime}
SUMMARY:${eventDetails.title}
LOCATION:${eventDetails.location}
DESCRIPTION:${eventDetails.description}
END:VEVENT
`;
    }

    icsContent += `END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const fileName = isMultiEvent 
      ? `${eventDetails.mainTitle?.replace(/\s+/g, '_') || 'Multi_Event'}.ics`
      : `${eventDetails.title?.replace(/\s+/g, '_') || 'Event'}.ics`;
    
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Event Poster Scanner</h1>
          <p className="text-gray-600">Extract event details from posters and add them to your calendar</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${currentStep >= step ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
                  {step}
                </div>
                {step < 4 && (
                  <div className={`w-16 h-1 mx-2 
                    ${currentStep > step ? 'bg-blue-500' : 'bg-gray-300'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Camera Modal */}
          {showCamera && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-4 max-w-md w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Take Photo</h3>
                  <button onClick={stopCamera} className="text-gray-500 hover:text-gray-700">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="relative">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline
                    className="w-full rounded-lg"
                  />
                  <button
                    onClick={capturePhoto}
                    className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white rounded-full p-4 hover:bg-blue-600"
                  >
                    <Camera className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Hidden canvas for photo capture */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Step 1: Upload Image */}
          {currentStep === 1 && (
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-6">Upload Event Poster</h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600 mb-6">Choose an image of an event poster</p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload from Gallery
                  </button>
                  
                  <button
                    onClick={startCamera}
                    className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Take Photo
                  </button>
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700">
                    <strong>Tip:</strong> For best results, ensure your poster image has good lighting, clear text, and minimal background clutter. 
                    The app will automatically extract text and identify event details using AI.
                  </p>
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

          {/* Step 2: Processing OCR */}
          {currentStep === 2 && (
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-6">Processing Image</h2>
              {image && (
                <div className="mb-6">
                  <img src={image} alt="Uploaded poster" className="max-w-md mx-auto rounded-lg shadow-md" />
                </div>
              )}
              {isProcessing && (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                  <span className="text-gray-600">Extracting text from image...</span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Parsing Event Details */}
          {currentStep === 3 && (
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-6">Analyzing Event Details</h2>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold mb-2">Extracted Text:</h3>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap text-left max-h-64 overflow-y-auto">{extractedText}</pre>
              </div>
              {isProcessing && (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                  <span className="text-gray-600">Parsing event details with AI...</span>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review and Save */}
          {currentStep === 4 && eventDetails && (
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold">
                  {isMultiEvent ? 'Multi-Event Details' : 'Event Details'}
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    {isEditing ? 'Save Changes' : 'Edit'}
                  </button>
                  <button
                    onClick={generateCalendarFile}
                    className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download .ics
                  </button>
                </div>
              </div>

              {/* Multi-Event Display */}
              {isMultiEvent ? (
                <div className="space-y-6">
                  {/* Main Event Info */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-800 mb-3">Main Event Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Event/Festival Name</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={eventDetails.mainTitle || ''}
                            onChange={(e) => handleDetailChange('mainTitle', e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        ) : (
                          <div className="p-3 bg-white rounded-lg">{eventDetails.mainTitle}</div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Main Venue</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={eventDetails.venue || ''}
                            onChange={(e) => handleDetailChange('venue', e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        ) : (
                          <div className="p-3 bg-white rounded-lg">{eventDetails.venue}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sub-Events */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Sub-Events ({multipleEvents.length})</h3>
                      {isEditing && (
                        <button
                          onClick={addSubEvent}
                          className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                        >
                          Add Event
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      {multipleEvents.map((event, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4 border">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-medium text-gray-800">Event #{index + 1}</h4>
                            {isEditing && (
                              <button
                                onClick={() => removeSubEvent(index)}
                                className="text-red-500 hover:text-red-700 text-sm"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-3">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={event.title}
                                  onChange={(e) => handleDetailChange('title', e.target.value, index)}
                                  className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                />
                              ) : (
                                <div className="p-2 bg-white rounded text-sm">{event.title}</div>
                              )}
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                              {isEditing ? (
                                <input
                                  type="date"
                                  value={event.date}
                                  onChange={(e) => handleDetailChange('date', e.target.value, index)}
                                  className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                />
                              ) : (
                                <div className="p-2 bg-white rounded text-sm">{event.date}</div>
                              )}
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                              {isEditing ? (
                                <input
                                  type="time"
                                  value={event.startTime}
                                  onChange={(e) => handleDetailChange('startTime', e.target.value, index)}
                                  className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                />
                              ) : (
                                <div className="p-2 bg-white rounded text-sm">{event.startTime}</div>
                              )}
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
                              {isEditing ? (
                                <input
                                  type="time"
                                  value={event.endTime}
                                  onChange={(e) => handleDetailChange('endTime', e.target.value, index)}
                                  className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                />
                              ) : (
                                <div className="p-2 bg-white rounded text-sm">{event.endTime}</div>
                              )}
                            </div>
                            
                            <div className="md:col-span-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={event.location}
                                  onChange={(e) => handleDetailChange('location', e.target.value, index)}
                                  className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                />
                              ) : (
                                <div className="p-2 bg-white rounded text-sm">{event.location}</div>
                              )}
                            </div>
                            
                            <div className="md:col-span-3">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                              {isEditing ? (
                                <textarea
                                  value={event.description}
                                  onChange={(e) => handleDetailChange('description', e.target.value, index)}
                                  rows={2}
                                  className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                />
                              ) : (
                                <div className="p-2 bg-white rounded text-sm">{event.description}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Single Event Display */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Event Title</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={eventDetails.title || ''}
                        onChange={(e) => handleDetailChange('title', e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <div className="p-3 bg-gray-50 rounded-lg">{eventDetails.title}</div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={eventDetails.date || ''}
                        onChange={(e) => handleDetailChange('date', e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <div className="p-3 bg-gray-50 rounded-lg">{eventDetails.date}</div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                    {isEditing ? (
                      <input
                        type="time"
                        value={eventDetails.startTime || ''}
                        onChange={(e) => handleDetailChange('startTime', e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <div className="p-3 bg-gray-50 rounded-lg">{eventDetails.startTime}</div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                    {isEditing ? (
                      <input
                        type="time"
                        value={eventDetails.endTime || ''}
                        onChange={(e) => handleDetailChange('endTime', e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <div className="p-3 bg-gray-50 rounded-lg">{eventDetails.endTime}</div>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={eventDetails.location || ''}
                        onChange={(e) => handleDetailChange('location', e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <div className="p-3 bg-gray-50 rounded-lg">{eventDetails.location}</div>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    {isEditing ? (
                      <textarea
                        value={eventDetails.description || ''}
                        onChange={(e) => handleDetailChange('description', e.target.value)}
                        rows={4}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <div className="p-3 bg-gray-50 rounded-lg">{eventDetails.description}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Success Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-blue-700 font-medium">
                    {isMultiEvent 
                      ? `Ready to add ${multipleEvents.length} events to calendar!`
                      : 'Ready to add to calendar!'
                    }
                  </span>
                </div>
                <p className="text-blue-600 text-sm mt-1">
                  {isMultiEvent 
                    ? 'Click "Download .ics" to save all events as a single calendar file.'
                    : 'Click "Download .ics" to save the event.'
                  } This file works with Apple Calendar, Google Calendar, Outlook, and other calendar apps.
                </p>
              </div>

              <button
                onClick={resetApp}
                className="w-full bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Scan Another Poster
              </button>
            </div>
          )}      onChange={(e) => handleDetailChange('startTime', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-lg">{eventDetails.startTime}</div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                  {isEditing ? (
                    <input
                      type="time"
                      value={eventDetails.endTime}
                      onChange={(e) => handleDetailChange('endTime', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-lg">{eventDetails.endTime}</div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={eventDetails.location}
                      onChange={(e) => handleDetailChange('location', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-lg">{eventDetails.location}</div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  {isEditing ? (
                    <textarea
                      value={eventDetails.description}
                      onChange={(e) => handleDetailChange('description', e.target.value)}
                      rows={4}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-lg">{eventDetails.description}</div>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-blue-700 font-medium">Ready to add to calendar!</span>
                </div>
                <p className="text-blue-600 text-sm mt-1">
                  Click "Download .ics" to save the event. This file works with Apple Calendar, Google Calendar, Outlook, and other calendar apps.
                </p>
              </div>

              <button
                onClick={resetApp}
                className="w-full bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Scan Another Poster
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventPosterScanner;
