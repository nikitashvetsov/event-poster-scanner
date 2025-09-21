import React, { useState, useRef, ChangeEvent } from 'react';
import { Camera, Upload, Calendar, CheckCircle, AlertCircle, Edit3, Download, X } from 'lucide-react';

// Define the structure of an event object for TypeScript
interface IEvent {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
}

// Define the structure for the main details of a multi-event
interface IMainEvent {
  mainTitle: string;
  venue: string;
}

const EventPosterScanner = () => {
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
  
  // Add types for useRef hooks
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      // Try to load and use Tesseract.js
      await loadTesseract();
      
      // Initialize Tesseract worker
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore Tesseract is loaded from CDN
      const worker = await Tesseract.createWorker('eng');
      
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
    return new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (window.Tesseract) {
        resolve();
        return;
      }
      
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
          setTimeout(() => resolve(), 500);
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
  const parseEventDetails = async (text: string) => {
    setIsProcessing(true);
    
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307", // Using a faster model for cost-effectiveness
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
- If info is missing, use reasonable defaults or empty strings.
- DO NOT include any text outside the JSON object.

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
      
      const errorMsg = err instanceof Error ? err.message : 'An unknown error occurred';
      const shouldUseManual = confirm(
        `AI parsing failed (${errorMsg}). This might be due to a missing API key or network issues.\n\n` +
        'OK - Parse text with a simpler, local method\n' +
        'Cancel - Use pre-filled demo data'
      );
      
      if (shouldUseManual) {
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
