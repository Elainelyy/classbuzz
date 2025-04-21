import React, { useState, useEffect, useRef } from 'react';

// Assume Cropper and pdfjsLib are available globally from the script tags in index.html

export default function PollEditor({ poll, onSave, onCancel }) {
    // --- State Management ---
    const [question, setQuestion] = useState(poll ? poll.question : '');
    const [options, setOptions] = useState(poll ? poll.options : ['', '']);
    const [pollType, setPollType] = useState(poll ? poll.poll_type : 'single_choice');
    
    // Image/PDF state
    const [image, setImage] = useState(null); // Stores the source image/pdf page data URL
    const [imagePreview, setImagePreview] = useState(poll && poll.image_url ? poll.image_url : null); // Stores the final image data URL (cropped or original)
    const [isCropping, setIsCropping] = useState(false);
    const [fileType, setFileType] = useState(null);
    const [completedCrop, setCompletedCrop] = useState(null); // Used to enable/disable crop button
    const [pdfDoc, setPdfDoc] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [isRenderingPdf, setIsRenderingPdf] = useState(false);
    
    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // --- Refs ---
    const fileInputRef = useRef(null);
    const cropperImageRef = useRef(null);
    const cropperInstanceRef = useRef(null);
    
    // --- Effects ---
    // Initialize with poll data if editing
    useEffect(() => {
      if (poll) {
        setQuestion(poll.question || '');
        setOptions(poll.options?.length ? poll.options : ['', '']);
        setPollType(poll.poll_type || 'single_choice');
        setImagePreview(poll.image_url || null);
        
        // Clean up if poll changes
        handleRemoveImage(); // Ensure image state is reset
      } else {
        // Reset for new poll
        setQuestion('');
        setOptions(['', '']);
        setPollType('single_choice');
        handleRemoveImage();
      }
    }, [poll]);

    // Function to initialize CropperJS
    const initializeCropper = () => {
      if (typeof Cropper === 'undefined') {
        console.error("CropperJS is not loaded");
        setError("Image cropping library failed to load. Please refresh.");
        return;
      }
      // Destroy previous instance if it exists
      if (cropperInstanceRef.current) {
        cropperInstanceRef.current.destroy();
        cropperInstanceRef.current = null;
      }
      
      // Make sure the image element is available
      if (!cropperImageRef.current) return;
      
      // Give time for the image to load
      setTimeout(() => {
        try {
          cropperInstanceRef.current = new Cropper(cropperImageRef.current, {
            viewMode: 1,
            dragMode: 'crop',
            autoCrop: false,
            zoomable: true,
            scalable: false,
            movable: true,
            background: false,
            ready() {
              console.log("Cropper is ready");
              if (cropperImageRef.current) {
                cropperImageRef.current.classList.add('loaded');
              }
              // Start with a crop box enabled
              this.cropper.crop();
              setCompletedCrop(true); // Enable button initially
            },
            crop(event) {
              // Enable apply crop button when a valid crop area is selected
              const data = event.detail;
              setCompletedCrop(data.width > 0 && data.height > 0);
            }
          });
        } catch (err) {
          console.error("Error initializing cropper:", err);
          setError("Could not initialize image cropper. Please try again.");
        }
      }, 100);
    };

    // PDF Page Rendering
    const renderPdfPage = async (pdfDocument, pageNum) => {
      if (!pdfDocument || isRenderingPdf) return;
      if (typeof pdfjsLib === 'undefined') {
        console.error("PDF.js is not loaded");
        setError("PDF rendering library failed to load. Please refresh.");
        return;
      }
      setIsRenderingPdf(true);
      setError(null); // Clear previous errors

      try {
        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        await page.render(renderContext).promise;

        const pageDataUrl = canvas.toDataURL('image/png');
        setImage(pageDataUrl);
        setImagePreview(null);
        setCurrentPage(pageNum);
        setIsCropping(true);
        setFileType('image/png');
        
        // Reset crop state when page changes
        setCompletedCrop(null);
        
        // Initialize cropper on next render
        setTimeout(() => {
          if (cropperImageRef.current) {
            cropperImageRef.current.src = pageDataUrl;
            cropperImageRef.current.style.display = 'block';
            initializeCropper();
          }
        }, 100);

      } catch (pdfError) {
        console.error('Error rendering PDF page:', pdfError);
        setError(`Failed to render PDF page ${pageNum}. Please try another file.`);
        handleRemoveImage();
      } finally {
        setIsRenderingPdf(false);
      }
    };

    const handlePrevPage = () => {
      if (currentPage > 1) {
        renderPdfPage(pdfDoc, currentPage - 1);
      }
    };

    const handleNextPage = () => {
      if (currentPage < totalPages) {
        renderPdfPage(pdfDoc, currentPage + 1);
      }
    };

    // Image/Upload Handling
    const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Clean up previous state
      handleRemoveImage();
      setFileType(file.type);

      if (file.type === 'application/pdf') {
        if (!window.pdfjsLib) {
          setError("PDF library not available.");
          return;
        }
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const loadingTask = window.pdfjsLib.getDocument({ data: event.target.result });
            const pdf = await loadingTask.promise;
            setPdfDoc(pdf);
            setTotalPages(pdf.numPages);
            renderPdfPage(pdf, 1); // Render the first page immediately
          } catch (pdfError) {
            console.error('Error loading PDF:', pdfError);
            setError('Failed to load PDF. The file might be corrupted or invalid.');
            handleRemoveImage();
          }
        };
        reader.onerror = () => {
           setError('Failed to read the PDF file.');
           handleRemoveImage();
        }
        reader.readAsArrayBuffer(file);
      } else if (file.type.startsWith('image/')) {
        // Handle image files
        setPdfDoc(null);
        setTotalPages(0);
        setCurrentPage(1);
        
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageDataUrl = e.target.result;
          setImage(imageDataUrl);
          setImagePreview(null);
          setIsCropping(true);
          
          // Initialize cropper on next render
          setTimeout(() => {
            if (cropperImageRef.current) {
              cropperImageRef.current.src = imageDataUrl;
              cropperImageRef.current.style.display = 'block';
              initializeCropper();
            }
          }, 100);
        };
        reader.onerror = () => {
          setError('Failed to read the image file.');
          handleRemoveImage();
        };
        reader.readAsDataURL(file);
      } else {
        alert('Please upload an image (JPEG, PNG, GIF) or PDF file');
        handleRemoveImage();
      }
    };

    const handleRemoveImage = () => {
      if (image && image.startsWith('blob:')) {
        URL.revokeObjectURL(image);
      }
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }

      if (cropperInstanceRef.current) {
        cropperInstanceRef.current.destroy();
        cropperInstanceRef.current = null;
      }

      setImage(null);
      // Retain existing image URL if editing
      if (!poll?.image_url || (poll?.image_url && image)) {
        setImagePreview(null);
      } else {
         setImagePreview(poll.image_url);
      }

      setFileType(null);
      setIsCropping(false);
      setPdfDoc(null);
      setCurrentPage(1);
      setTotalPages(0);
      setCompletedCrop(null);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      if (cropperImageRef.current) {
        cropperImageRef.current.src = '';
        cropperImageRef.current.style.display = 'none';
        cropperImageRef.current.classList.remove('loaded');
      }
    };

    const handleCropComplete = () => {
      if (!cropperInstanceRef.current) {
        setError("Cropper not initialized.");
        return;
      }
      
      try {
        const croppedCanvas = cropperInstanceRef.current.getCroppedCanvas({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
          maxWidth: 1000,
          maxHeight: 1000,
          fillColor: '#fff'
        });
        
        if (!croppedCanvas) {
          setError("Could not get cropped image. Please try again.");
          return;
        }
        
        const croppedImageDataUrl = croppedCanvas.toDataURL('image/jpeg', 0.8);
        console.log("Generated cropped image:", 
                  "Size:", Math.round(croppedImageDataUrl.length/1024), "KB",
                  "Format:", croppedImageDataUrl.substring(0, 30) + "...");
                  
        setImagePreview(croppedImageDataUrl);
        setImage(null);
        setIsCropping(false);
        setCompletedCrop(true);
        
        if (cropperInstanceRef.current) {
          cropperInstanceRef.current.destroy();
          cropperInstanceRef.current = null;
        }
        
        setPdfDoc(null);
        setTotalPages(0);
        setCurrentPage(1);
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (e) {
        console.error("Error creating cropped image:", e);
        setError("Failed to generate cropped image. Please try again.");
      }
    };

    // Make handleUseOriginalImage return a promise to support await in handleSubmit
    const handleUseOriginalImage = () => {
      return new Promise((resolve) => {
        if (!image) {
          setError("No image available.");
          resolve(false);
          return;
        }
        
        setImagePreview(image); // Use the original source data URL
        setIsCropping(false);
        setCompletedCrop(true);
        
        if (cropperInstanceRef.current) {
          cropperInstanceRef.current.destroy();
          cropperInstanceRef.current = null;
        }
        
        resolve(true);
      });
    };

    // --- Form Handling ---
    const handleAddOption = () => {
      setOptions([...options, '']);
    };

    const handleRemoveOption = (index) => {
      if (options.length > 2) {
        setOptions(options.filter((_, i) => i !== index));
      }
    };

    const handleOptionChange = (index, value) => {
      const newOptions = [...options];
      newOptions[index] = value;
      setOptions(newOptions);
    };

    // Add an image compression function
    const compressImage = (dataUrl) => {
      return new Promise((resolve, reject) => {
        try {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDimension = 1000;
            
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const targetSize = 200 * 1024; // 200KB
            const inputSize = dataUrl.length;
            let quality = Math.min(0.9, Math.max(0.1, (targetSize / inputSize)));
            
            console.log("Compression calculation:", { "Input size": Math.round(inputSize/1024) + "KB", "Target size": "200KB", "Calculated quality": quality });
            
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            console.log("Final compression result:", { "Original size": Math.round(inputSize/1024) + "KB", "Compressed size": Math.round(compressedDataUrl.length/1024) + "KB", "Reduction": Math.round((1 - compressedDataUrl.length/inputSize) * 100) + "%", "Quality used": quality, "Final dimensions": `${width}x${height}` });
            
            resolve(compressedDataUrl);
          };
          img.onerror = () => reject(new Error("Failed to load image for compression"));
          img.src = dataUrl;
        } catch (err) {
          reject(err);
        }
      });
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      setIsLoading(true);
      setError(null);

      if (!question.trim() && !imagePreview && !image) {
         setError('Please provide a question or upload an image/PDF.');
         setIsLoading(false);
         return;
      }
      
      if (pollType !== 'open_ended') {
        const validOptions = options.filter(opt => opt.trim() !== '');
        if (validOptions.length < 2) {
          setError('Multiple choice/Single choice polls require at least two non-empty options.');
          setIsLoading(false);
          return;
        }
        if (new Set(validOptions).size !== validOptions.length) {
          setError('Duplicate options are not allowed.');
          setIsLoading(false);
          return;
        }
      }

      let finalImagePreview = imagePreview;
      // If currently cropping and source image exists but no final preview, use the original image
      if (isCropping && image && !finalImagePreview) {
        await handleUseOriginalImage();
        finalImagePreview = image; // Update local var after await
      }

      if (finalImagePreview) {
        console.log("Image data format check:", 
                   "Starts with data:image?", finalImagePreview.startsWith('data:image/'),
                   "Contains base64?", finalImagePreview.includes(';base64,'));
      }
      
      const pollData = {
        id: poll ? poll.id : null,
        question: question.trim(),
        options: pollType === 'open_ended' ? [] : options.map(opt => opt.trim()).filter(opt => opt !== ''),
        pollType: pollType
      };
      
      if (finalImagePreview && finalImagePreview.startsWith('data:')) {
        try {
          const compressedImage = await compressImage(finalImagePreview);
          pollData.imageDataUrl = compressedImage;
          console.log("Including compressed image data in request");
        } catch (err) {
          console.error("Error compressing image:", err);
          setError("Failed to compress image. The file may be too large.");
          setIsLoading(false);
          return;
        }
      } else if (poll && poll.image_url && finalImagePreview === poll.image_url) {
        // Keep the existing one if it wasn't changed/removed
        pollData.existingImageUrl = poll.image_url;
        console.log("Using existing image URL:", poll.image_url);
      } else if (finalImagePreview) {
        // If it's not a data URL but exists (e.g., direct URL entered or existing)
        pollData.existingImageUrl = finalImagePreview;
        console.log("Using direct/existing image URL:", finalImagePreview);
      }

      console.log("Sending poll data with question:", pollData.question, 
                 "Has image data:", !!pollData.imageDataUrl,
                 "Has existing URL:", !!pollData.existingImageUrl);

      try {
        await onSave(pollData);
        // Reset only if creating new poll successfully
        if (!poll) {
            setQuestion('');
            setOptions(['', '']);
            setPollType('single_choice');
            handleRemoveImage(); // Also sets preview to null
        }
      } catch (saveError) {
        console.error("Error saving poll:", saveError);
        setError(saveError.message || 'Failed to save poll');
      } finally {
        setIsLoading(false);
      }
    };

    // --- Render ---
    return (
      <div className="poll-editor">
        <h2>{poll ? 'Edit Poll' : 'Create New Poll'}</h2>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit}>
          {/* Question Input */}
          <div className="form-group">
            <label>Question:</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Enter poll question (optional if image/PDF provided)"
            />
          </div>

          {/* Image/PDF Upload and Crop Area */}
          <div className="form-group">
              <label>Image or PDF (optional if question provided):</label>
              <div
                  className={`image-upload-container ${isCropping ? 'cropping' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                  onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); }}
                  onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('drag-over');
                      const file = e.dataTransfer.files[0];
                      if (file) {
                          handleImageUpload({ target: { files: [file] } });
                      }
                  }}
              >
                  {!isCropping && imagePreview ? (
                      <div className="image-preview-container">
                          <img src={imagePreview} alt="Preview" className="image-preview" />
                      </div>
                  ) : isCropping && image ? (
                      <div className="image-crop-container">
                           {pdfDoc && totalPages > 0 && (
                               <div className="pdf-navigation">
                                  <button type="button" onClick={handlePrevPage} disabled={currentPage <= 1 || isRenderingPdf}>Previous</button>
                                  <span>Page {currentPage} of {totalPages}</span>
                                  <button type="button" onClick={handleNextPage} disabled={currentPage >= totalPages || isRenderingPdf}>Next</button>
                              </div>
                           )}
                           
                           <img 
                             ref={cropperImageRef} 
                             id="cropperImage" 
                             src={image} 
                             alt="Crop Source" 
                             style={{ display: isRenderingPdf ? 'none' : 'block' }} 
                           />
                           
                           {isRenderingPdf && <p>Loading PDF page...</p>}
                           <div className="crop-controls">
                               <button
                                   type="button"
                                   onClick={handleCropComplete}
                                   className="crop-button"
                                   disabled={!completedCrop || isRenderingPdf}
                               >
                                   Apply Crop
                               </button>
                               <button 
                                   type="button" 
                                   onClick={handleUseOriginalImage} 
                                   className="use-original-button"
                                   disabled={isRenderingPdf}
                               >
                                   Use Original
                               </button>
                               <button type="button" onClick={handleRemoveImage} className="cancel-crop-button">Cancel Upload</button>
                           </div>
                      </div>
                  ) : (
                      <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
                          <div className="upload-icon">📁</div>
                          <p>Drag and drop an image or PDF here</p>
                          <p>or</p>
                          <button type="button" className="upload-button">
                              Browse Files
                          </button>
                      </div>
                  )}

                  <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/jpeg,image/png,image/gif,application/pdf"
                      onChange={handleImageUpload}
                      className="hidden" // Use class instead of style
                  />

                  {(imagePreview && !isCropping) && (
                       <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="remove-image mt-10px" // Use class instead of style
                        >
                            Remove Image
                        </button>
                  )}
              </div>
          </div>

          {/* Poll Type Selection */}
          <div className="form-group">
            <label>Poll Type:</label>
            <select value={pollType} onChange={(e) => setPollType(e.target.value)}>
              <option value="single_choice">Single Choice</option>
              <option value="multiple_choice">Multiple Choice</option>
              <option value="open_ended">Open Ended</option>
            </select>
          </div>

          {/* Options (Conditional) */}
          {pollType !== 'open_ended' && (
            <div className="form-group">
              <label>Options:</label>
              {options.map((option, index) => (
                <div key={index} className="option-input">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    required
                  />
                  {options.length > 2 && (
                    <button type="button" onClick={() => handleRemoveOption(index)} className="remove-option">
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={handleAddOption} className="add-option">
                Add Option
              </button>
            </div>
          )}

          {/* Form Actions */}
          <div className="form-actions">
            <button type="button" onClick={onCancel} className="cancel-button" disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="save-button" disabled={isLoading || (isCropping && !completedCrop)}>
              {isLoading ? 'Saving...' : (poll ? 'Update Poll' : 'Create Poll')}
            </button>
          </div>
        </form>
      </div>
    );
} 